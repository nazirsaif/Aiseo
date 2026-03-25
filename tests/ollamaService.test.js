/**
 * Ollama Service — Unit Tests
 * Tests the service's graceful fallback behaviour when Ollama is not running.
 * Does NOT make real HTTP requests (Ollama availability is checked and skipped).
 * Run: node --test tests/ollamaService.test.js
 */

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const ollamaService = require('../services/ollamaService');

let ollamaAvailable = false;

before(async () => {
  ollamaAvailable = await ollamaService.isOllamaAvailable();
  if (!ollamaAvailable) {
    console.log('[ollamaService.test] Ollama not running — LLM tests will verify fallback behaviour only.');
  } else {
    console.log('[ollamaService.test] Ollama is available — LLM tests will call the model.');
  }
});

// ─── isOllamaAvailable ────────────────────────────────────────────────────────

describe('isOllamaAvailable', () => {
  test('returns a boolean', async () => {
    const result = await ollamaService.isOllamaAvailable();
    assert.ok(typeof result === 'boolean');
  });
});

// ─── generateSEORecommendations ───────────────────────────────────────────────

describe('generateSEORecommendations', () => {
  const mockElements = {
    title: 'Test Page',
    metaDescription: 'A test meta description that is long enough to pass the length check for SEO tools.',
    h1Tags: ['Test Heading'],
    h2Count: 2,
    wordCount: 500,
    imagesWithoutAlt: 1,
    canonicalUrl: null,
    hasViewport: true,
    hasOpenGraph: false,
    hasStructuredData: false,
    readabilityScore: 65
  };

  const mockAudit = {
    score: 72,
    grade: 'C',
    issues: [
      { type: 'info', category: 'canonical', message: 'No canonical URL tag' },
      { type: 'info', category: 'social', message: 'Missing Open Graph meta tags' }
    ]
  };

  test('returns object with available boolean and recommendations key', async () => {
    const result = await ollamaService.generateSEORecommendations(mockElements, mockAudit);
    assert.ok(typeof result.available === 'boolean');
    assert.ok('recommendations' in result);
  });

  test('when unavailable, recommendations is null', async () => {
    if (ollamaAvailable) return; // skip — Ollama is running, so it won't be null
    const result = await ollamaService.generateSEORecommendations(mockElements, mockAudit);
    assert.equal(result.available, false);
    assert.equal(result.recommendations, null);
  });

  test('when available, recommendations is a non-empty string', async () => {
    if (!ollamaAvailable) return; // skip — Ollama not running
    const result = await ollamaService.generateSEORecommendations(mockElements, mockAudit);
    assert.equal(result.available, true);
    assert.ok(typeof result.recommendations === 'string');
    assert.ok(result.recommendations.length > 20);
  });
});

// ─── generateGradeJustification ──────────────────────────────────────────────

describe('generateGradeJustification', () => {
  const mockIssues = [
    { type: 'critical', category: 'title', message: 'Missing page title' },
    { type: 'warning', category: 'content', message: 'Thin content — only 150 words' }
  ];

  test('returns object with available boolean and justification key', async () => {
    const result = await ollamaService.generateGradeJustification(55, 'D', mockIssues);
    assert.ok(typeof result.available === 'boolean');
    assert.ok('justification' in result);
  });

  test('when unavailable, justification is null', async () => {
    if (ollamaAvailable) return;
    const result = await ollamaService.generateGradeJustification(55, 'D', mockIssues);
    assert.equal(result.justification, null);
  });

  test('when available, justification is a non-empty string', async () => {
    if (!ollamaAvailable) return;
    const result = await ollamaService.generateGradeJustification(55, 'D', mockIssues);
    assert.ok(typeof result.justification === 'string');
    assert.ok(result.justification.length > 10);
  });
});

// ─── classifyKeywordIntents ───────────────────────────────────────────────────

describe('classifyKeywordIntents', () => {
  test('returns object with available boolean and intents key', async () => {
    const result = await ollamaService.classifyKeywordIntents(['best seo tools', 'buy backlinks']);
    assert.ok(typeof result.available === 'boolean');
    assert.ok(Array.isArray(result.intents));
  });

  test('returns empty array for empty keyword list', async () => {
    const result = await ollamaService.classifyKeywordIntents([]);
    assert.equal(result.available, false);
    assert.deepEqual(result.intents, []);
  });

  test('when available, returns intents with keyword and intent fields', async () => {
    if (!ollamaAvailable) return;
    const result = await ollamaService.classifyKeywordIntents(['best seo tools', 'buy seo software']);
    if (result.available && result.intents.length > 0) {
      const first = result.intents[0];
      assert.ok('keyword' in first);
      assert.ok('intent' in first);
      const valid = ['informational', 'transactional', 'commercial', 'navigational'];
      assert.ok(valid.includes(first.intent), `Unexpected intent: ${first.intent}`);
    }
  });
});
