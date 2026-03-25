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
const ollamaService = require('./ollamaService');

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
 * Volume is estimated from word count only — clearly labelled as such.
 * These are rough heuristic ranges, not real data.
 */
function estimateSearchVolume(keyword) {
  const wc = keyword.split(' ').length;
  if (wc === 1) return { low: 1000,  high: 50000 };
  if (wc === 2) return { low: 500,   high: 10000 };
  if (wc === 3) return { low: 100,   high: 3000  };
  return              { low: 10,    high: 500   };
}

/**
 * Difficulty estimated from competitor saturation and keyword length.
 * Short, high-frequency keywords = harder; long-tail = easier.
 */
function estimateDifficulty(competitorCount, wordCount) {
  if (wordCount >= 4) return 'Easy';
  if (competitorCount >= 5) return 'Hard';
  if (competitorCount >= 3 || wordCount <= 2) return 'Medium';
  return 'Easy';
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
      const vol = estimateSearchVolume(phrase);

      suggestions.push({
        keyword: phrase,
        type: wordCount >= 3 ? 'long-tail' : 'short-tail',
        intent: classifyIntentLocal(phrase),
        relevanceScore: Math.max(25, relevanceScore),
        estimatedSearchVolume: vol,          // { low, high } — not a single fake number
        estimatedDifficulty: estimateDifficulty(data.competitors.size, wordCount),
        competitorCount: data.competitors.size,
        occurrences: data.count,
        isFromCompetitors: !data.competitors.has('pattern'), // flag: real vs pattern
        sources: [] // sources stripped — url list was noisy in v1
      });
    });
  }

  // 4. Try Ollama intent enrichment (replaces local classifier where available)
  const topKeywords = suggestions.slice(0, 20).map(s => s.keyword);
  const ollamaIntents = await ollamaService.classifyKeywordIntents(topKeywords);
  if (ollamaIntents.available && ollamaIntents.intents.length > 0) {
    const intentMap = new Map(ollamaIntents.intents.map(i => [i.keyword, i.intent]));
    suggestions.forEach(s => {
      if (intentMap.has(s.keyword)) s.intent = intentMap.get(s.keyword);
    });
    console.log(`[KeywordService] Ollama intent classification applied to top ${topKeywords.length} keywords`);
  }

  suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  console.log(`[KeywordService] Generated ${suggestions.length} suggestions`);
  return suggestions;
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
        const vol = estimateSearchVolume(phrase);
        suggestions.push({
          keyword: phrase,
          type: wc >= 3 ? 'long-tail' : 'short-tail',
          intent: classifyIntentLocal(phrase),
          relevanceScore: Math.max(40, Math.round(sim * 100)),
          estimatedSearchVolume: vol,
          estimatedDifficulty: estimateDifficulty(0, wc),
          competitorCount: 0,
          occurrences: 0,
          isFromCompetitors: false
        });
      });
    }

    suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return suggestions;
  } catch (err) {
    console.error('[KeywordService] Fallback generation failed:', err.message);
    // Last-resort static fallback
    return getPatternSupplement(baseKeyword).map((kw, i) => ({
      keyword: kw,
      type: 'long-tail',
      intent: classifyIntentLocal(kw),
      relevanceScore: 70 - i * 2,
      estimatedSearchVolume: { low: 50, high: 500 },
      estimatedDifficulty: 'Medium',
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
  estimateSearchVolume,
  estimateDifficulty,
  classifyIntentLocal
};
