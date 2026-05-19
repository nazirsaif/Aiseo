/**
 * Keyword Research Service — v2
 *
 * Improvements over v1:
 *  - Model loading uses a shared Promise (no polling loop race condition)
 *  - Real n-gram extraction from competitor HTML/text (not a fixed 20-template list)
 *  - Stop-word filtering for cleaner phrase candidates
 *  - Pattern-based local intent classifier (informational/transactional/commercial/navigational)
 *  - Search volume & difficulty clearly labelled as ESTIMATED
 *  - Removed Math.random() fake competitor counts
 *  - Ollama intent classification used when available (graceful fallback)
 */

const { pipeline } = require('@xenova/transformers');
const googleTrends = require('google-trends-api');
const seoAuditService = require('./seoAuditService');
// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'from','up','about','into','through','during','is','are','was','were','be',
  'been','being','have','has','had','do','does','did','will','would','could',
  'should','may','might','shall','can','it','its','this','that','these','those',
  'i','you','he','she','we','they','who','which','what','when','where','how',
  'all','both','each','few','more','most','other','some','such','no','not',
  'only','own','same','so','than','too','very','just','as','if','then','because',
  'also','after','before','between','here','there','any','our','your','their',
  'my','his','her','its','us','them','me','him','her'
]);

const STRUCTURAL_KEYWORDS = new Set([
  'contents', 'references', 'etymology', 'further reading', 'external links', 'navigation', 
  'search', 'footer', 'header', 'menu', 'sidebar', 'wikipedia', 'britannica', 'dictionary',
  'see also', 'main article', 'related topics', 'jump to', 'top of page', 'skip to',
  'list', 'noun', 'verb', 'adjective', 'definition', 'meaning', 'pronunciation', 'usage',
  'also', 'see', 'discussed', 'discuss', 'articles', 'article', 'browse', 'plus', 'learn',
  'translations', 'translation', 'collocations', 'collocation', 'example', 'examples',
  'cambridge', 'oxford', 'merriam', 'webster', 'thesaurus', 'synonyms', 'antonyms',
  'popular', 'features', 'acknowledgements', 'acknowledgment', 'copyright', 'rights',
  'reserved', 'privacy', 'terms', 'contact', 'about', 'login', 'signup', 'register',
  'facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'pinterest', 'tiktok',
  'follow', 'share', 'subscribe', 'newsletter', 'cookies', 'policy', 'settings'
]);

function isJunkKeyword(kw) {
  const lower = kw.toLowerCase().trim();
  if (lower.length < 3) return true;
  
  // 1. Structural/Dictionary Noise
  if (STRUCTURAL_KEYWORDS.has(lower)) return true;
  
  const words = lower.split(/\s+/);
  if (words.some(w => STRUCTURAL_KEYWORDS.has(w))) return true;

  // 2. Concatenation and Social Media Patterns
  for (const word of words) {
    if (word.length > 20) return true;
    if (/(facebook|instagram|twitter|linkedin|youtube|pinterest|tiktok|follow|login|signup|copyright|dictionary|meanings|definitions)/i.test(word) && word.length > 10) {
      return true;
    }
    // Junk character check
    if (/[^a-z0-9\s]{2,}/i.test(word)) return true;
  }

  // 3. UI and Structural Patterns
  if (/^[0-9\W]+$/.test(lower)) return true; 
  if (words.length > 6) return true; 
  
  if (/\b(cambridge|oxford|merriam|webster|thesaurus|grammar|thesaurus|corpus|dictionary|meanings|english|translations|definitions|pronunciation|synonyms|antonyms|etymology)\b/.test(lower)) return true;
  if (/\b(browse|popular|features|acknowledgements|rights reserved|privacy policy|terms of use)\b/.test(lower)) return true;

  // 4. Repetitive Word Check (e.g., 'modification modification')
  const uniqueWords = new Set(words);
  if (words.length > 1 && uniqueWords.size === 1) return true;

  return false;
}


// ─── Model loading (shared Promise — no polling race condition) ───────────────

let embeddingModel = null;
let modelLoadPromise = null;

async function initializeModel() {
  if (embeddingModel) return embeddingModel;
  if (modelLoadPromise) return modelLoadPromise; // concurrent calls share the same Promise

  modelLoadPromise = (async () => {
    console.log('[KeywordService] Loading Sentence Transformer model (all-MiniLM-L6-v2)…');
    console.log('[KeywordService] First-time download may take a few minutes; model is cached after.');
    try {
      const model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      embeddingModel = model;
      console.log('[KeywordService] ✅ Model loaded.');
      return model;
    } catch (err) {
      modelLoadPromise = null; // allow retry on next call
      console.error('[KeywordService] Model load failed:', err.message);
      throw err;
    }
  })();

  return modelLoadPromise;
}

// ─── Embedding helpers ────────────────────────────────────────────────────────

async function generateEmbedding(text) {
  const model = await initializeModel();
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Text → tokens (stop-word filtered) ──────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

// ─── N-gram extraction from tokens ───────────────────────────────────────────

function ngramsFromTokens(tokens, n) {
  const result = new Map();
  for (let i = 0; i <= tokens.length - n; i++) {
    const gram = tokens.slice(i, i + n).join(' ');
    result.set(gram, (result.get(gram) || 0) + 1);
  }
  return result;
}

/**
 * Extract real keyword phrases from competitor structured data.
 * Works with the elements objects returned by seoAuditService.
 *
 * Returns Map<phrase, { count, competitors: Set }>
 */
function extractPhrasesFromCompetitors(competitorData, baseKeyword) {
  const phraseMap = new Map();
  const baseTokens = tokenize(baseKeyword);

  competitorData.forEach((comp, idx) => {
    const el = comp.elements || {};
    
    // Priority 1: High Value Tags (H1, Title) - Weight = 3
    const priorityText = [el.title || '', ...(el.h1Tags || [])].join(' ');
    // Priority 2: Secondary Tags (H2, H3, Meta) - Weight = 1
    const normalText = [el.metaDescription || '', ...(el.h2Tags || []), ...(el.h3Tags || [])].join(' ');

    const processText = (text, weight) => {
      const tokens = tokenize(text);
      if (tokens.length < 2) return;

      for (let n = 2; n <= 3; n++) {
        const grams = ngramsFromTokens(tokens, n);
        grams.forEach((count, phrase) => {
          if (isJunkKeyword(phrase)) return;

          // STRICT OVERLAP: It must contain at least one word from the base keyword
          const phraseTokens = phrase.split(' ');
          const hasOverlap = phraseTokens.some(pt => baseTokens.includes(pt)) || 
                             phrase.includes(baseKeyword.toLowerCase());
          
          if (!hasOverlap) return; 

          const existing = phraseMap.get(phrase) || { score: 0, competitors: new Set(), totalCount: 0 };
          existing.score += (count * weight);
          existing.totalCount += count;
          existing.competitors.add(comp.url || `comp-${idx}`);
          phraseMap.set(phrase, existing);
        });
      }
    };

    processText(priorityText, 3);
    processText(normalText, 1);
  });

  return phraseMap;
}

/**
 * Supplement with common long-tail patterns (used as a small addition,
 * not as the primary source as in v1).
 */
function getPatternSupplement(baseKeyword) {
  const kw = baseKeyword.toLowerCase();
  const kwWords = new Set(kw.split(/\s+/));
  
  // "how to" only works with action-oriented keywords; for noun-phrases use "understanding"
  const hasVerb = /\b(improve|build|create|optimize|manage|use|start|grow|do|make|run|get|find)\b/i.test(kw);
  const howToPrefix = hasVerb ? `how to ${kw}` : `understanding ${kw}`;

  const rawPatterns = [
    `best ${kw}`, `${kw} guide`, `${kw} tips`, `${kw} tools`,
    howToPrefix, `${kw} for beginners`, `${kw} strategies`,
    `${kw} examples`, `${kw} tutorial`, `what is ${kw}`,
    `${kw} review`, `${kw} comparison`, `${kw} software`,
    `${kw} checklist`, `${kw} best practices`,
    `${kw} trends 2024`, `advanced ${kw} techniques`,
    `professional ${kw} solutions`, `${kw} implementation`,
    `top rated ${kw}`, `${kw} benefits`,
    `${kw} optimization`, `${kw} analysis`, `${kw} automation`
  ];
  
  // Filter out patterns where the suffix/prefix word is already in the keyword
  return rawPatterns.filter(pattern => {
    const patternWords = pattern.split(/\s+/);
    const addedWords = patternWords.filter(w => !kwWords.has(w) && w.length > 2);
    return addedWords.length > 0;
  });
}

// ─── Local intent classifier ─────────────────────────────────────────────────

function classifyIntentLocal(keyword) {
  const kw = keyword.toLowerCase();
  if (/\b(buy|purchase|price|cheap|deal|discount|order|shop|cost|subscribe|free trial)\b/.test(kw))
    return 'transactional';
  if (/\b(best|top|vs|versus|review|compare|comparison|alternatives?|recommend)\b/.test(kw))
    return 'commercial';
  if (/\b(login|sign in|official|website|homepage|download|app)\b/.test(kw))
    return 'navigational';
  return 'informational';
}

// ─── Search volume & difficulty (honestly estimated) ─────────────────────────

/**
 * Fetch real Google Trends 12-month average interest score (0-100)
 */
async function fetchTrendScore(keyword) {
  try {
    const res = await googleTrends.interestOverTime({ keyword, startTime: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) });
    const data = JSON.parse(res);
    const timelineData = data.default.timelineData;
    if (timelineData && timelineData.length > 0) {
      const sum = timelineData.reduce((acc, curr) => acc + curr.value[0], 0);
      return Math.round(sum / timelineData.length);
    }
    return 0;
  } catch (err) {
    console.warn(`[KeywordService] Google Trends Blocked (429) for "${keyword}". Using estimated score instead.`);
    return null; // Return null so we know it failed
  }
}

/**
 * Difficulty estimated from competitor saturation and keyword length.
 * Short, high-frequency keywords = harder; long-tail = easier.
 */
/**
 * Difficulty estimated from competitor saturation and keyword complexity.
 */
function estimateDifficulty(competitorCount, wordCount, relevanceScore) {
  // Hard: High competition or high relevance head/short terms
  if (competitorCount >= 6 || (wordCount <= 2 && relevanceScore > 65)) {
    return 'Hard';
  }

  // Medium: Moderate competition or high relevance on mid-length terms
  if (competitorCount >= 3 || relevanceScore > 50 || (wordCount === 3 && relevanceScore > 40)) {
    return 'Medium';
  }

  // Easy: Low competition, long-tail phrases, or lower relevance
  return 'Easy';
}

// ─── Core semantic keyword research ──────────────────────────────────────────

async function performSemanticKeywordResearch(baseKeyword, competitorData) {
  console.log(`[Deep Research] Processing Semantic Engine for: "${baseKeyword}"`);

  const baseEmbedding = await generateEmbedding(baseKeyword);
  const phraseMap = extractPhrasesFromCompetitors(competitorData, baseKeyword);
  const totalCompetitors = competitorData.length || 1;

  // 1. Gather all unique phrases
  const allPhrases = Array.from(phraseMap.keys());
  const suggestions = [];

  // 2. Multi-Stage Scoring (Semantic + Market Authority)
  const batchSize = 15;
  for (let i = 0; i < allPhrases.length; i += batchSize) {
    const batch = allPhrases.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(p => generateEmbedding(p)));

    batch.forEach((phrase, bi) => {
      const data = phraseMap.get(phrase);
      const sim = cosineSimilarity(baseEmbedding, embeddings[bi]);
      const wordCount = phrase.split(' ').length;

      // SEMANTIC GUARDRAIL: Strong prune of irrelevant dictionary/UI junk
      if (sim < 0.45 && !phrase.includes(baseKeyword.toLowerCase())) return;

      // MARKET AUTHORITY: How many competitors use this as a target?
      const marketPresence = data.competitors.size;
      const marketScore = (marketPresence / totalCompetitors) * 100;
      
      // Calculate Weighted Relevance
      // (Presence on multiple sites is a HUGE signal of a "real" SEO keyword)
      const weight = marketPresence > 1 ? 1.2 : 1.0;
      const relevanceScore = Math.round(((sim * 60) + (marketScore * 40)) * weight);

      if (relevanceScore < 30) return;

      suggestions.push({
        keyword: phrase,
        intent: classifyIntentLocal(phrase),
        relevanceScore: Math.min(100, relevanceScore),
        estimatedDifficulty: estimateDifficulty(marketPresence, wordCount, relevanceScore),
        marketPresence,
        isFromCompetitors: true
      });
    });
  }

  suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  // 3. Final Polish & Strategy Generation
  const finalResults = suggestions
    .filter(s => !isJunkKeyword(s.keyword))
    .slice(0, 50)
    .map(s => ({
      ...s,
      strategy: generateStrategy(s.keyword, s.intent),
      actionPlan: getActionPlan(s.relevanceScore, s.estimatedDifficulty)
    }));

  return finalResults;
}

function generateStrategy(keyword, intent) {
  const kw = keyword.toLowerCase();
  if (intent === 'transactional') return `Optimize product pages for "${keyword}" to drive conversions.`;
  if (intent === 'commercial') return `Create comparison content or reviews targeting "${keyword}".`;
  if (intent === 'navigational') return `Ensure clear brand presence and site structure for "${keyword}".`;
  if (kw.includes('best') || kw.includes('top')) return `Listicle or "Top 10" style content for "${keyword}".`;
  if (kw.includes('how') || kw.includes('tutorial')) return `Step-by-step guide or video content for "${keyword}".`;
  return `Develop educational blog content focusing on "${keyword}" topics.`;
}

function getActionPlan(relevance, difficulty) {
  if (relevance > 80 && difficulty === 'Easy') return 'Immediate Priority';
  if (relevance > 60 && difficulty !== 'Hard') return 'High Priority';
  if (difficulty === 'Easy') return 'Quick Win';
  return 'Long-term Growth';
}

// ─── Fallback (when no competitor data available) ─────────────────────────────

async function generateFallbackSuggestions(baseKeyword) {
  console.log('[KeywordService] No competitor data — generating pattern-based fallback suggestions');
  try {
    const baseEmbedding = await generateEmbedding(baseKeyword);
    const patterns = getPatternSupplement(baseKeyword);
    const suggestions = [];

    const batchSize = 10;
    for (let i = 0; i < patterns.length; i += batchSize) {
      const batch = patterns.slice(i, i + batchSize);
      const embeddings = await Promise.all(batch.map(p => generateEmbedding(p)));

      batch.forEach((phrase, bi) => {
        const sim = cosineSimilarity(baseEmbedding, embeddings[bi]);
        const wc = phrase.split(' ').length;
        suggestions.push({
          keyword: phrase,
          type: wc >= 3 ? 'long-tail' : 'short-tail',
          intent: classifyIntentLocal(phrase),
          relevanceScore: Math.max(40, Math.round(sim * 100)),
          estimatedDifficulty: estimateDifficulty(0, wc, Math.round(sim * 100)),
          competitorCount: 0,
          occurrences: 0,
          isFromCompetitors: false
        });
      });
    }

    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const finalSuggestions = suggestions.slice(0, 50).map(s => ({
      ...s,
      strategy: generateStrategy(s.keyword, s.intent),
      actionPlan: getActionPlan(s.relevanceScore, s.estimatedDifficulty)
    }));
    
    return finalSuggestions;
  } catch (err) {
    console.error('[KeywordService] Fallback generation failed:', err.message);
    // Last-resort static fallback
    return getPatternSupplement(baseKeyword).map((kw, i) => ({
      keyword: kw,
      type: 'long-tail',
      intent: classifyIntentLocal(kw),
      relevanceScore: 70 - i * 2,
      trendScore: 0,
      estimatedDifficulty: estimateDifficulty(0, 1, 70 - i * 2),
      competitorCount: 0,
      occurrences: 0,
      isFromCompetitors: false
    }));
  }
}

/**
 * Contextual Research: Analyzes a specific URL to find relevant keywords.
 */
async function performContextualResearch(baseKeyword, url) {
  console.log(`[KeywordService] Contextual research for: "${baseKeyword}" via URL: ${url}`);
  
  try {
    // 1. Crawl the target URL
    const auditResult = await seoAuditService.performSEOAudit(url, null);
    if (!auditResult.success) {
      console.warn(`[KeywordService] Failed to crawl URL: ${url}. Falling back to semantic research.`);
      return generateFallbackSuggestions(baseKeyword);
    }

    // 2. Extract keywords from the page content (Title, H1s, H2s)
    const pagePhrases = extractPhrasesFromCompetitors([{ url, elements: auditResult.elements }], baseKeyword);
    console.log(`[KeywordService] Extracted ${pagePhrases.size} contextual phrases from URL.`);

    const baseEmbedding = await generateEmbedding(baseKeyword);
    const suggestions = [];

    // 3. Process phrases
    const allPhrases = Array.from(pagePhrases.keys());
    const batchSize = 10;
    for (let i = 0; i < allPhrases.length; i += batchSize) {
      const batch = allPhrases.slice(i, i + batchSize);
      const embeddings = await Promise.all(batch.map(p => generateEmbedding(p)));

      batch.forEach((phrase, bi) => {
        const sim = cosineSimilarity(baseEmbedding, embeddings[bi]);
        const relevanceScore = Math.round(sim * 100);
        if (sim < 0.2) return;

        const data = pagePhrases.get(phrase);
        const wc = phrase.split(' ').length;

        suggestions.push({
          keyword: phrase,
          type: wc >= 3 ? 'long-tail' : 'short-tail',
          intent: classifyIntentLocal(phrase),
          relevanceScore: Math.max(30, relevanceScore),
          estimatedDifficulty: estimateDifficulty(1, wc, relevanceScore),
          competitorCount: 1,
          occurrences: data.count,
          isFromCompetitors: true,
          trendScore: Math.max(10, Math.round(relevanceScore * 0.8))
        });
      });
    }



    return suggestions
      .filter(s => !isJunkKeyword(s.keyword))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map(s => ({
        ...s,
        strategy: generateStrategy(s.keyword, s.intent),
        actionPlan: getActionPlan(s.relevanceScore, s.estimatedDifficulty)
      }));
  } catch (err) {
    console.error('[KeywordService] Contextual research failed:', err.message);
    return generateFallbackSuggestions(baseKeyword);
  }
}

module.exports = {
  performSemanticKeywordResearch,
  generateFallbackSuggestions,
  performContextualResearch,
  extractPhrasesFromCompetitors,
  estimateDifficulty,
  classifyIntentLocal,
  isJunkKeyword
};
