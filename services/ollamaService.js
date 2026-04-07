/**
 * Ollama Service - Local LLM integration (zero cost)
 * Requires Ollama running at localhost:11434
 * Install: https://ollama.ai  |  Model: ollama pull llama3.2
 *
 * All functions degrade gracefully if Ollama is not available —
 * the rest of the audit still works, just without LLM text.
 */

const axios = require('axios');

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

/**
 * Check if Ollama is running and the model is available
 */
async function isOllamaAvailable() {
  try {
    const res = await axios.get(`${OLLAMA_BASE}/api/tags`, { timeout: 3000 });
    const models = res.data?.models || [];
    // Accept any llama3.2 variant (llama3.2, llama3.2:3b, etc.)
    const hasModel = models.some(m => m.name && m.name.startsWith(OLLAMA_MODEL.split(':')[0]));
    return hasModel;
  } catch {
    return false;
  }
}

/**
 * Low-level generate call — shared by all public functions
 */
async function ollamaGenerate(prompt, maxTokens = 400) {
  const res = await axios.post(
    `${OLLAMA_BASE}/api/generate`,
    {
      model: OLLAMA_MODEL,
      prompt,
      stream: false,
      options: { temperature: 0.3, num_predict: maxTokens }
    },
    { timeout: 180000 }
  );
  return (res.data?.response || '').trim();
}

/**
 * Generate 3-5 specific, actionable SEO recommendations from audit data.
 * Returns { available: bool, recommendations: string|null }
 */
async function generateSEORecommendations(elements, auditResult) {
  const criticalIssues = (auditResult.issues || [])
    .filter(i => i.type === 'critical')
    .map(i => i.message)
    .slice(0, 4)
    .join('; ') || 'none';

  const prompt = `You are an SEO expert. Analyse these page metrics and give exactly 5 numbered, specific, actionable recommendations. No preamble — just the numbered list.

Title: "${elements.title || 'MISSING'}"
Meta description: "${elements.metaDescription ? elements.metaDescription.substring(0, 120) : 'MISSING'}"
H1 count: ${elements.h1Tags?.length ?? 0}  H2 count: ${elements.h2Count ?? 0}
Word count: ${elements.wordCount ?? 0}
Images missing alt text: ${elements.imagesWithoutAlt ?? 0}
Has canonical URL: ${elements.canonicalUrl ? 'yes' : 'no'}
Has viewport meta: ${elements.hasViewport ? 'yes' : 'no'}
Has Open Graph: ${elements.hasOpenGraph ? 'yes' : 'no'}
Has structured data (JSON-LD): ${elements.hasStructuredData ? 'yes' : 'no'}
Readability score: ${elements.readabilityScore ?? 'N/A'}/100
SEO score: ${auditResult.score}/100  Grade: ${auditResult.grade}
Critical issues: ${criticalIssues}

Provide 5 specific recommendations:`;

  try {
    const text = await ollamaGenerate(prompt, 450);
    return { available: true, recommendations: text };
  } catch (err) {
    console.warn('[Ollama] generateSEORecommendations failed:', err.message);
    return { available: false, recommendations: null };
  }
}

/**
 * Write a 2-sentence justification of the grade.
 * Returns { available: bool, justification: string|null }
 */
async function generateGradeJustification(score, grade, issues) {
  const critical = issues.filter(i => i.type === 'critical').map(i => i.message).join(', ') || 'none';
  const warnings = issues.filter(i => i.type === 'warning').map(i => i.message).slice(0, 3).join(', ') || 'none';

  const prompt = `An SEO audit scored a page ${score}/100 (Grade ${grade}).
Critical issues: ${critical}.
Warnings: ${warnings}.
Write exactly 2 concise sentences: first explain why this grade was given, second state the single most important fix. Be direct. No bullet points.`;

  try {
    const text = await ollamaGenerate(prompt, 150);
    return { available: true, justification: text };
  } catch (err) {
    console.warn('[Ollama] generateGradeJustification failed:', err.message);
    return { available: false, justification: null };
  }
}

/**
 * Classify a list of keywords by search intent using the LLM.
 * Falls back to the local pattern-based classifier if unavailable.
 * Returns { available: bool, intents: Array<{keyword, intent}> }
 */
async function classifyKeywordIntents(keywords) {
  if (!keywords || keywords.length === 0) return { available: false, intents: [] };

  const list = keywords.slice(0, 25).join('\n');
  const prompt = `Classify each keyword by search intent. Reply with a JSON array only — no other text.
Intent values: "informational", "transactional", "commercial", "navigational"

Keywords:
${list}

JSON array format: [{"keyword":"...","intent":"..."}]`;

  try {
    const text = await ollamaGenerate(prompt, 600);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return { available: true, intents: [] };
    const intents = JSON.parse(match[0]);
    return { available: true, intents };
  } catch (err) {
    console.warn('[Ollama] classifyKeywordIntents failed:', err.message);
    return { available: false, intents: [] };
  }
}

/**
 * Analyse a competitor gap: given user page elements and competitor data,
 * return a short plain-text paragraph describing what topics competitors
 * cover that the user's page is missing.
 * Returns { available: bool, gapAnalysis: string|null }
 */
async function generateCompetitorGapAnalysis(userElements, topCompetitors) {
  const userTopics = [
    userElements.title,
    userElements.metaDescription,
    ...(userElements.h1Tags || []),
    ...(userElements.h2Tags || [])
  ].filter(Boolean).join(', ');

  const competitorTopics = topCompetitors
    .slice(0, 4)
    .map(c => {
      const el = c.elements || {};
      return [el.title, ...(el.h1Tags || []), ...(el.h2Tags || [])].filter(Boolean).join(', ');
    })
    .join(' | ');

  const prompt = `You are an SEO content strategist. Based on the user's page topics and competitor topics, identify 3 content gaps — topics competitors cover that the user's page is missing. Be concise, 2-3 sentences.

User page topics: ${userTopics || 'unknown'}
Competitor topics: ${competitorTopics || 'unknown'}

Content gaps:`;

  try {
    const text = await ollamaGenerate(prompt, 200);
    return { available: true, gapAnalysis: text };
  } catch (err) {
    console.warn('[Ollama] generateCompetitorGapAnalysis failed:', err.message);
    return { available: false, gapAnalysis: null };
  }
}

/**
 * Generate 3 dashboard-level AI suggestions based on user overview metrics.
 * Returns { available: bool, suggestions: Array<{priority, title, description}> }
 */
async function generateDashboardSuggestions(overview) {
  const prompt = `You are an SEO expert evaluating a website. The user's dashboard metrics are: SEO Score: ${overview.seoScore}/100, Content Gaps: ${overview.contentGaps}, Keyword Clusters: ${overview.keywordClusters}.
Generate exactly 3 actionable SEO suggestions based on these metrics. Assign one High priority, one Medium priority, and one Low priority.
Reply ONLY with a valid JSON array of objects. No introductory text, no markdown code blocks.
Format exactly like this:
[{"priority":"High","title":"Optimize meta tags","description":"Fix missing tags to improve CTR."},{"priority":"Medium","title":"...","description":"..."},{"priority":"Low","title":"...","description":"..."}]`;

  try {
    const text = await ollamaGenerate(prompt, 400);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return { available: true, suggestions: [] };
    const suggestions = JSON.parse(match[0]);
    return { available: true, suggestions };
  } catch (err) {
    console.warn('[Ollama] generateDashboardSuggestions failed:', err.message);
    return { available: false, suggestions: [] };
  }
}

module.exports = {
  isOllamaAvailable,
  generateSEORecommendations,
  generateGradeJustification,
  classifyKeywordIntents,
  generateCompetitorGapAnalysis,
  generateDashboardSuggestions
};
