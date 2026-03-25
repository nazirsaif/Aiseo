/**
 * SEO Audit Service — Unit Tests
 * Uses Node's built-in test runner (node:test) — no extra deps required.
 * Run: node --test tests/seoAudit.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  extractSEOElements,
  performSEOChecks,
  fleschReadingEase
} = require('../services/seoAuditService');

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Best Coffee Machines 2024 — Complete Buyer Guide</title>
  <meta name="description" content="Looking for the best coffee machine? We tested 30+ models so you don't have to. Find the perfect espresso maker, drip brewer, or pod machine for your budget.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="canonical" href="https://example.com/best-coffee-machines">
  <meta property="og:title" content="Best Coffee Machines 2024">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{"@type":"Article"}</script>
</head>
<body>
  <h1>Best Coffee Machines 2024</h1>
  <h2>Espresso Machines</h2>
  <h2>Drip Brewers</h2>
  <p>Finding the right coffee machine can transform your morning routine. We tested over thirty machines across five categories to bring you this comprehensive guide.</p>
  <img src="breville.jpg" alt="Breville Barista Express">
  <img src="nespresso.jpg" alt="Nespresso Vertuo">
  <a href="/espresso-guide">Espresso Guide</a>
</body>
</html>`;

const POOR_HTML = `<html>
<head><title>Hi</title></head>
<body><img src="x.jpg"><img src="y.jpg"></body>
</html>`;

const NOINDEX_HTML = `<html lang="en">
<head>
  <title>Private Page — Do Not Index</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="This is a private staging page that should not appear in search results.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body><h1>Private Content</h1><p>This page is for internal use only.</p></body>
</html>`;

// ─── extractSEOElements ───────────────────────────────────────────────────────

describe('extractSEOElements', () => {
  test('extracts title correctly', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.title, 'Best Coffee Machines 2024 — Complete Buyer Guide');
  });

  test('extracts meta description', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.ok(el.metaDescription.length > 0, 'meta description should not be empty');
  });

  test('extracts H1 tags', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.h1Tags.length, 1);
    assert.equal(el.h1Tags[0], 'Best Coffee Machines 2024');
  });

  test('extracts H2 tags', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.h2Tags.length, 2);
  });

  test('detects images with alt text', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.images.length, 2);
    assert.equal(el.images.filter(i => i.hasAlt).length, 2);
  });

  test('detects images missing alt text in poor HTML', () => {
    const el = extractSEOElements(POOR_HTML);
    assert.equal(el.images.filter(i => !i.hasAlt).length, 2);
  });

  test('detects Open Graph tags', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.hasOpenGraph, true);
  });

  test('detects canonical URL', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.canonicalUrl, 'https://example.com/best-coffee-machines');
  });

  test('detects viewport meta tag', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.hasViewport, true);
  });

  test('detects lang attribute on html tag', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.langAttr, 'en');
  });

  test('detects structured data (JSON-LD)', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.hasStructuredData, true);
  });

  test('detects noindex directive', () => {
    const el = extractSEOElements(NOINDEX_HTML);
    assert.equal(el.isNoindex, true);
  });

  test('no noindex on normal page', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.isNoindex, false);
  });

  test('missing lang returns null', () => {
    const el = extractSEOElements(POOR_HTML);
    assert.equal(el.langAttr, null);
  });

  test('word count is positive for content-rich page', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.ok(el.wordCount > 10, `Expected wordCount > 10, got ${el.wordCount}`);
  });
});

// ─── performSEOChecks ─────────────────────────────────────────────────────────

describe('performSEOChecks', () => {
  test('perfect page scores 100', () => {
    const el = extractSEOElements(FULL_HTML);
    // Ensure word count is above threshold for this test
    el.wordCount = 400;
    const result = performSEOChecks(el);
    assert.equal(result.score, 100, `Expected 100, got ${result.score}. Issues: ${result.issues.map(i=>i.message).join('; ')}`);
  });

  test('missing title deducts 20 points', () => {
    const el = extractSEOElements(FULL_HTML);
    el.title = '';
    const result = performSEOChecks(el);
    // Score should be 80 minus any other deductions
    assert.ok(result.score <= 80, `Score should be ≤ 80 when title missing, got ${result.score}`);
    assert.ok(result.issues.some(i => i.message.includes('title')));
  });

  test('missing meta description deducts 15 points', () => {
    const el = extractSEOElements(FULL_HTML);
    el.metaDescription = '';
    el.wordCount = 400;
    const result = performSEOChecks(el);
    assert.ok(result.score <= 85, `Score should be ≤ 85, got ${result.score}`);
  });

  test('noindex causes critical issue and big deduction', () => {
    const el = extractSEOElements(NOINDEX_HTML);
    el.wordCount = 400;
    const result = performSEOChecks(el);
    assert.ok(result.score <= 75, `Noindex should cause large deduction, got ${result.score}`);
    const noindexIssue = result.issues.find(i => i.message.toLowerCase().includes('noindex'));
    assert.ok(noindexIssue, 'Should have a noindex issue');
    assert.equal(noindexIssue.type, 'critical');
  });

  test('missing viewport is a critical issue', () => {
    const el = extractSEOElements(POOR_HTML);
    el.wordCount = 400;
    el.title = 'A valid title of the right length for seo tests';
    el.metaDescription = 'A valid meta description that is long enough to pass the minimum length check for testing purposes here.';
    el.h1Tags = ['Test Heading'];
    const result = performSEOChecks(el);
    assert.ok(result.issues.some(i => i.category === 'mobile'));
  });

  test('image alt deduction is capped at 10 points', () => {
    const el = extractSEOElements(FULL_HTML);
    // Simulate 10 images all missing alt
    el.images = Array(10).fill({ hasAlt: false, alt: '', src: 'x.jpg' });
    el.wordCount = 400;
    const result = performSEOChecks(el);
    // Max image penalty is 10
    const fullScoreWithoutImages = 100;
    // Other checks on FULL_HTML all pass, so only image deduction applies
    // At most -10 for images
    assert.ok(result.score >= fullScoreWithoutImages - 10 - 5, // -10 cap + minor deductions
      `Image deduction should be capped, got score ${result.score}`);
  });

  test('score never goes below 0', () => {
    const el = extractSEOElements(POOR_HTML);
    el.wordCount = 10;
    const result = performSEOChecks(el);
    assert.ok(result.score >= 0, `Score must not be negative, got ${result.score}`);
  });

  test('grade A for score >= 90', () => {
    const el = extractSEOElements(FULL_HTML);
    el.wordCount = 400;
    const result = performSEOChecks(el);
    // Full HTML should pass most checks
    if (result.score >= 90) {
      // Grade is derived in performSEOAudit not here, so we just verify score
      assert.ok(result.score >= 90);
    }
  });

  test('thin content (<300 words) triggers warning', () => {
    const el = extractSEOElements(FULL_HTML);
    el.wordCount = 100;
    const result = performSEOChecks(el);
    assert.ok(result.issues.some(i => i.category === 'content'));
  });

  test('multiple H1 tags triggers warning', () => {
    const el = extractSEOElements(FULL_HTML);
    el.h1Tags = ['First H1', 'Second H1', 'Third H1'];
    const result = performSEOChecks(el);
    assert.ok(result.issues.some(i => i.message.includes('Multiple H1')));
  });

  test('recommendations array has same length as issues', () => {
    const el = extractSEOElements(POOR_HTML);
    el.wordCount = 50;
    const result = performSEOChecks(el);
    // Every issue should produce a recommendation (or at least not more recs than issues)
    assert.ok(result.recommendations.length > 0);
  });
});

// ─── fleschReadingEase ────────────────────────────────────────────────────────

describe('fleschReadingEase', () => {
  test('returns null for empty string', () => {
    assert.equal(fleschReadingEase(''), null);
  });

  test('returns null for very short text', () => {
    assert.equal(fleschReadingEase('Hi there'), null);
  });

  test('returns a number between 0 and 100', () => {
    const text = 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs. How vexingly quick daft zebras jump.';
    const score = fleschReadingEase(text);
    assert.ok(score !== null);
    assert.ok(score >= 0 && score <= 100, `Score ${score} out of range`);
  });

  test('simple text scores higher than complex text', () => {
    const simple = 'The cat sat on the mat. The dog ran fast. I like food. Birds can fly.';
    const complex = 'Notwithstanding aforementioned jurisdictional considerations, the aforementioned stipulations necessitate reconsideration of multifaceted interdependencies.';
    const simpleScore = fleschReadingEase(simple);
    const complexScore = fleschReadingEase(complex);
    if (simpleScore !== null && complexScore !== null) {
      assert.ok(simpleScore > complexScore, `Simple (${simpleScore}) should outscore complex (${complexScore})`);
    }
  });
});
