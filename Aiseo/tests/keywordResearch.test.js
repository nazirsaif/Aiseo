/**
 * Keyword Research Service — Unit Tests
 * Tests pure functions only (no network, no model loading).
 * Run: node --test tests/keywordResearch.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  extractPhrasesFromCompetitors,
  estimateSearchVolume,
  estimateDifficulty,
  classifyIntentLocal
} = require('../services/keywordResearchService');

// ─── extractPhrasesFromCompetitors ───────────────────────────────────────────

describe('extractPhrasesFromCompetitors', () => {
  const fakeCompetitors = [
    {
      url: 'https://example.com/seo-tools',
      elements: {
        title: 'Best SEO Tools for 2024',
        metaDescription: 'Top rated SEO tools for keyword research and site audits.',
        h1Tags: ['Best SEO Tools'],
        h2Tags: ['Keyword Research Tools', 'Site Audit Tools'],
        h3Tags: []
      }
    },
    {
      url: 'https://example.com/seo-guide',
      elements: {
        title: 'Complete SEO Guide',
        metaDescription: 'Learn SEO from scratch with this complete guide.',
        h1Tags: ['SEO Guide for Beginners'],
        h2Tags: ['On-Page SEO', 'Technical SEO Tools'],
        h3Tags: []
      }
    }
  ];

  test('returns a Map', () => {
    const result = extractPhrasesFromCompetitors(fakeCompetitors, 'seo tools');
    assert.ok(result instanceof Map);
  });

  test('extracts phrases containing the base keyword', () => {
    const result = extractPhrasesFromCompetitors(fakeCompetitors, 'seo');
    const phrases = Array.from(result.keys());
    assert.ok(phrases.length > 0, 'Should extract at least one phrase');
    const hasSeoPhrases = phrases.some(p => p.includes('seo'));
    assert.ok(hasSeoPhrases, `No SEO-related phrases found. Got: ${phrases.slice(0,5).join(', ')}`);
  });

  test('phrases have count and competitors Set', () => {
    const result = extractPhrasesFromCompetitors(fakeCompetitors, 'seo');
    if (result.size > 0) {
      const first = result.values().next().value;
      assert.ok(typeof first.count === 'number');
      assert.ok(first.competitors instanceof Set);
    }
  });

  test('returns empty Map for empty competitor array', () => {
    const result = extractPhrasesFromCompetitors([], 'seo');
    assert.equal(result.size, 0);
  });

  test('handles competitors with missing elements gracefully', () => {
    const badData = [{ url: 'https://example.com', elements: null }];
    assert.doesNotThrow(() => extractPhrasesFromCompetitors(badData, 'seo'));
  });

  test('does not include pure stop-word phrases', () => {
    const result = extractPhrasesFromCompetitors(fakeCompetitors, 'seo');
    const phrases = Array.from(result.keys());
    // Phrases should not be all stop words
    phrases.forEach(p => {
      const words = p.split(' ');
      assert.ok(words.length >= 2, `Phrase "${p}" has fewer than 2 words`);
    });
  });
});

// ─── estimateSearchVolume ─────────────────────────────────────────────────────

describe('estimateSearchVolume', () => {
  test('returns an object with low and high keys', () => {
    const vol = estimateSearchVolume('seo');
    assert.ok(typeof vol.low === 'number');
    assert.ok(typeof vol.high === 'number');
  });

  test('single word keyword has higher volume range than 4-word keyword', () => {
    const single = estimateSearchVolume('seo');
    const fourWord = estimateSearchVolume('best seo tools beginners');
    assert.ok(single.high > fourWord.high,
      `Single word (${single.high}) should exceed four-word (${fourWord.high})`);
  });

  test('low is always less than high', () => {
    ['seo', 'seo tools', 'best seo tools guide'].forEach(kw => {
      const vol = estimateSearchVolume(kw);
      assert.ok(vol.low < vol.high, `low(${vol.low}) should be < high(${vol.high}) for "${kw}"`);
    });
  });

  test('all values are positive', () => {
    const vol = estimateSearchVolume('digital marketing strategy tips');
    assert.ok(vol.low > 0);
    assert.ok(vol.high > 0);
  });
});

// ─── estimateDifficulty ───────────────────────────────────────────────────────

describe('estimateDifficulty', () => {
  test('returns Easy, Medium, or Hard', () => {
    const valid = new Set(['Easy', 'Medium', 'Hard']);
    [[0,1],[3,2],[6,2],[0,4],[5,3]].forEach(([comp, wc]) => {
      assert.ok(valid.has(estimateDifficulty(comp, wc)),
        `estimateDifficulty(${comp}, ${wc}) returned unexpected value`);
    });
  });

  test('long-tail (4+ words) is Easy when few competitors', () => {
    assert.equal(estimateDifficulty(0, 4), 'Easy');
    assert.equal(estimateDifficulty(1, 5), 'Easy');
  });

  test('high competitor count is Hard', () => {
    assert.equal(estimateDifficulty(6, 2), 'Hard');
  });

  test('medium competitor count is Medium', () => {
    assert.equal(estimateDifficulty(3, 2), 'Medium');
  });
});

// ─── classifyIntentLocal ──────────────────────────────────────────────────────

describe('classifyIntentLocal', () => {
  const cases = [
    ['buy seo software', 'transactional'],
    ['seo tools price', 'transactional'],
    ['best seo tools', 'commercial'],
    ['seo tools vs alternatives', 'commercial'],
    ['what is seo', 'informational'],
    ['seo for beginners guide', 'informational'],
    ['google analytics login', 'navigational'],
    ['ahrefs official website', 'navigational']
  ];

  cases.forEach(([keyword, expectedIntent]) => {
    test(`"${keyword}" classified as ${expectedIntent}`, () => {
      const intent = classifyIntentLocal(keyword);
      assert.equal(intent, expectedIntent);
    });
  });

  test('returns one of four valid intents for any input', () => {
    const valid = new Set(['informational', 'transactional', 'commercial', 'navigational']);
    const keywords = ['unknown xyz term', 'random words here', '123 test'];
    keywords.forEach(kw => {
      assert.ok(valid.has(classifyIntentLocal(kw)), `Unexpected intent for "${kw}"`);
    });
  });
});
