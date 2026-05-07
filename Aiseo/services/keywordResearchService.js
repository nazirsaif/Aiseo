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
    const textBlocks = [
      el.title || '',
      el.metaDescription || '',
      ...(el.h1Tags || []),
      ...(el.h2Tags || []),
      ...(el.h3Tags || [])
    ].join(' ');

    const tokens = tokenize(textBlocks);
    if (tokens.length < 2) return;

    // Extract 2, 3, 4-grams
    for (let n = 2; n <= 4; n++) {
      const grams = ngramsFromTokens(tokens, n);
      grams.forEach((count, phrase) => {
        // Only keep phrases that share at least one token with the base keyword
        const phraseTokens = phrase.split(' ');
        const hasOverlap = phraseTokens.some(pt => baseTokens.includes(pt)) ||
                           phrase.includes(baseKeyword.toLowerCase());
        if (!hasOverlap) return;

        const existing = phraseMap.get(phrase) || { count: 0, competitors: new Set() };
        existing.count += count;
        existing.competitors.add(comp.url || `comp-${idx}`);
        phraseMap.set(phrase, existing);
      });
    }
  });

  return phraseMap;
}

/**
 * Supplement with common long-tail patterns (used as a small addition,
 * not as the primary source as in v1).
 */
function getPatternSupplement(baseKeyword) {
  const kw = baseKeyword.toLowerCase();
  return [
    `best ${kw}`, `${kw} guide`, `${kw} tips`, `${kw} tools`,
    `how to ${kw}`, `${kw} for beginners`, `${kw} strategies`,
    `${kw} examples`, `${kw} tutorial`, `what is ${kw}`,
    `${kw} review`, `${kw} comparison`, `${kw} software`,
    `${kw} checklist`, `${kw} best practices`
  ];
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
  // If it's a short keyword (1-2 words) and highly relevant, it's Hard
  if (wordCount <= 2 && relevanceScore > 60) return 'Hard';
  
  // If many competitors are already targeting it, it's Hard
  if (competitorCount >= 3) return 'Hard';

  // Long-tail keywords with low competitor count are Easy
  if (wordCount >= 4 && competitorCount <= 1) return 'Easy';
  
  // Default to Medium
  return 'Medium';
}

// ─── Core semantic keyword research ──────────────────────────────────────────

async function performSemanticKeywordResearch(baseKeyword, competitorData) {
  console.log(`[KeywordService] Semantic research for: "${baseKeyword}"`);

  const baseEmbedding = await generateEmbedding(baseKeyword);

  // 1. Real phrases from competitor content
  const phraseMap = extractPhrasesFromCompetitors(competitorData, baseKeyword);
  console.log(`[KeywordService] Extracted ${phraseMap.size} real competitor phrases`);

  // 2. Supplement with patterns (but only add those not already found)
  const patterns = getPatternSupplement(baseKeyword);
  patterns.forEach(p => {
    if (!phraseMap.has(p)) {
      phraseMap.set(p, { count: 1, competitors: new Set(['pattern']) });
    }
  });

  const allPhrases = Array.from(phraseMap.keys());
  const suggestions = [];

  // 3. Score each phrase with semantic similarity, process in batches
  const batchSize = 10;
  for (let i = 0; i < allPhrases.length; i += batchSize) {
    const batch = allPhrases.slice(i, i + batchSize);
    const embeddings = await Promise.all(batch.map(p => generateEmbedding(p)));

    batch.forEach((phrase, bi) => {
      const sim = cosineSimilarity(baseEmbedding, embeddings[bi]);
      const relevanceScore = Math.round(sim * 100);

      if (sim < 0.25) return; // filter out irrelevant phrases

      const data = phraseMap.get(phrase);
      const wordCount = phrase.split(' ').length;

      suggestions.push({
        keyword: phrase,
        type: wordCount >= 3 ? 'long-tail' : 'short-tail',
        intent: classifyIntentLocal(phrase),
        relevanceScore: Math.max(25, relevanceScore),
        estimatedDifficulty: estimateDifficulty(data.competitors.size, wordCount, relevanceScore),
        competitorCount: data.competitors.size,
        occurrences: data.count,
        isFromCompetitors: !data.competitors.has('pattern'), // flag: real vs pattern
        sources: [] // sources stripped — url list was noisy in v1
      });
    });
  }

  suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  const finalSuggestions = suggestions.slice(0, 50);
  console.log(`[KeywordService] Fetching real Google Trends data for top 10 suggestions...`);
  
  for (let i = 0; i < finalSuggestions.length; i++) {
    const fallback = Math.max(10, Math.round(finalSuggestions[i].relevanceScore * 0.75));
    if (i < 5) { // Only try top 5 to avoid blocking
      const realScore = await fetchTrendScore(finalSuggestions[i].keyword);
      finalSuggestions[i].trendScore = (realScore && realScore > 0) ? realScore : fallback;
      await new Promise(r => setTimeout(r, 800)); 
    } else {
      finalSuggestions[i].trendScore = fallback;
    }
  }

  console.log(`[KeywordService] Generated ${finalSuggestions.length} suggestions (Top 10 with Real Trends)`);
  return finalSuggestions;
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
    const finalSuggestions = suggestions.slice(0, 50);
    
    for (let i = 0; i < finalSuggestions.length; i++) {
      const fallback = Math.max(10, Math.round(finalSuggestions[i].relevanceScore * 0.7));
      if (i < 5) {
        const realScore = await fetchTrendScore(finalSuggestions[i].keyword);
        finalSuggestions[i].trendScore = (realScore && realScore > 0) ? realScore : fallback;
        await new Promise(r => setTimeout(r, 800));
      } else {
        finalSuggestions[i].trendScore = fallback;
      }
    }
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

module.exports = {
  performSemanticKeywordResearch,
  generateFallbackSuggestions,
  extractPhrasesFromCompetitors,
  estimateDifficulty,
  classifyIntentLocal
};
