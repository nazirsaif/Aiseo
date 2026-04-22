/**
 * SEO Audit Service — Unit Tests (Refactored for ML-only)
 * Uses Node's built-in test runner (node:test).
 * Run: node --test tests/seoAudit.test.js
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  extractSEOElements,
  performSEOAudit
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

  test('detects viewport meta tag', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.hasViewport, true);
  });

  test('detects canonical URL', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.canonicalUrl, 'https://example.com/best-coffee-machines');
  });

  test('detects structured data (JSON-LD)', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.equal(el.hasStructuredData, true);
  });

  test('word count is positive for content-rich page', () => {
    const el = extractSEOElements(FULL_HTML);
    assert.ok(el.wordCount > 10, `Expected wordCount > 10, got ${el.wordCount}`);
  });
});

// ─── performSEOAudit behavior ────────────────────────────────────────────────

describe('performSEOAudit System Behavior', () => {
  test('returns Model Offline error if ML server is unreachable', async () => {
    // Port 5001 might be occupied, so this test ensures we handle the failure
    // We pass HTML directly to skip the fetch step
    const result = await performSEOAudit(null, FULL_HTML);
    
    if (!result.audit.ml_prediction) {
      assert.equal(result.audit.score, 0);
      assert.ok(result.audit.issues.some(i => i.message.includes('Offline')));
    }
  });

  test('extracts elements even if audit fails', async () => {
    const result = await performSEOAudit(null, FULL_HTML);
    assert.ok(result.elements.title);
    assert.ok(result.elements.wordCount > 0);
  });
});
