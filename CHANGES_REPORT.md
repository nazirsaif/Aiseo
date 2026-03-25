# AiSEO — Backend Changes Report
**Date:** 2026-03-25
**Test Results:** 90 / 90 passing

---

## Summary

All backend logic improvements were implemented at zero cost using local tools (Ollama LLM, existing ML model, pure-JS algorithms). No paid APIs were added.

---

## 1. New File: `services/ollamaService.js`

**What it does:** Integrates a locally-running LLM (Ollama + llama3.2) into the audit pipeline.

| Function | Purpose |
|---|---|
| `isOllamaAvailable()` | Checks if Ollama is running before attempting calls |
| `generateSEORecommendations()` | Returns 5 specific, contextual recommendations based on actual page metrics |
| `generateGradeJustification()` | Writes 2 sentences explaining why the page received its grade |
| `classifyKeywordIntents()` | Classifies keyword list by intent (informational/transactional/commercial/navigational) |
| `generateCompetitorGapAnalysis()` | Identifies topics competitors cover that the user's page is missing |

**Key design:** Every function degrades gracefully — if Ollama is not running, `available: false` is returned and the rest of the audit still works with rule-based results only.

**Setup:** Install Ollama from https://ollama.ai, then run `ollama pull llama3.2`.

---

## 2. Rewrite: `services/seoAuditService.js`

### 2a. HTML Parsing: Regex → Cheerio

**Before:** All element extraction used raw regex on HTML strings. Nested tags (e.g. `<h1><span>text</span></h1>`) returned empty results.

**After:** All extraction uses `cheerio.load(html)` with proper CSS selectors. Handles real-world HTML correctly.

```js
// Before
const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi);

// After
const h1Tags = $('h1').map((_, el) => $(el).text().trim()).get();
```

### 2b. Weighted Scoring System

**Before:** Flat deductions regardless of issue severity. Twitter Card missing deducted same as missing title.

**After:** Critical issues deduct heavily; minor issues deduct little.

| Check | Old Deduction | New Deduction |
|---|---|---|
| Missing title | -15 | -20 |
| Missing meta description | -10 | -15 |
| Missing H1 | -10 | -15 |
| Missing viewport (mobile) | not checked | -8 |
| noindex detected | not checked | -25 (critical) |
| Missing Open Graph | -3 | -5 |
| Missing Twitter Card | -2 | -2 |
| Images missing alt (per img) | -2, uncapped | -2, capped at -10 |

### 2c. New SEO Checks

| Check | Category | Impact |
|---|---|---|
| `noindex` robots meta detected | Indexing | Critical |
| Missing `<meta name="viewport">` | Mobile | High |
| Missing `<link rel="canonical">` | Canonical | Low |
| Missing `lang` on `<html>` | Accessibility | Low |
| No JSON-LD structured data | Structured Data | Low |

### 2d. Flesch-Kincaid Readability Score

Added pure-JS implementation of the Flesch Reading Ease formula (0–100). Score is included in every audit result as `elements.readabilityScore`. No external library required.

### 2e. Bug Fix: Structured Data Detection

The original code removed all `<script>` tags before checking for JSON-LD structured data, causing it to always return `false`. Fixed by checking `$('script[type="application/ld+json"]')` before the `$('script').remove()` call.

### 2f. h2Tags Exposed in Output

`h2Tags` array is now included in the `elements` output (was computed but discarded). This allows keyword research to use heading content from audited pages.

---

## 3. Rewrite: `services/keywordResearchService.js`

### 3a. Model Loading Race Condition Fix

**Before:** Concurrent requests during model load used a polling `while (modelLoading) { await sleep(100) }` loop — fragile and wastes CPU.

**After:** Uses a shared Promise — all concurrent requests await the same Promise instance.

```js
// Before
if (modelLoading) {
  while (modelLoading) { await new Promise(r => setTimeout(r, 100)); }
}

// After
if (modelLoadPromise) return modelLoadPromise; // all callers await the same Promise
```

### 3b. Real N-gram Extraction from Competitor Content

**Before:** Keyword suggestions came from a hardcoded list of 20 templates (`best {kw}`, `{kw} guide`, etc.) regardless of what competitors actually rank for. The ML model only scored these fixed templates.

**After:**
1. Extracts real 2–4 word n-grams from competitor page titles, meta descriptions, H1s, and H2s
2. Filters stop words (50+ word list)
3. Only includes phrases that semantically overlap with the base keyword
4. Fixed patterns added as a small supplement, not the primary source
5. Phrases are flagged `isFromCompetitors: true/false` so the frontend can differentiate

### 3c. Removed Fake Random Numbers

**Before:** `competitorCount: Math.floor(Math.random() * 3) + 1` — competitor counts in fallback suggestions were random.

**After:** Fallback suggestions have `competitorCount: 0` with honest labelling.

### 3d. Honest Search Volume Estimates

**Before:** Single number estimates like `5000` presented without qualification.

**After:** Returns `{ low: N, high: N }` range, clearly labelled as estimated. Frontend should display as "est. 500–3,000" not "5000".

### 3e. Local Intent Classifier

Added pattern-based intent classification covering:
- **Transactional:** buy, purchase, price, deal, subscribe, free trial
- **Commercial:** best, top, vs, review, compare, alternatives
- **Navigational:** login, official, website, download, app
- **Informational:** everything else (default)

Upgraded to LLM-based classification when Ollama is available.

---

## 4. Changes: `services/webSearchService.js`

- Fallback placeholder URLs reduced from 8 invented URLs to 3 high-authority domains only (Wikipedia, Britannica, Cambridge Dictionary)
- All fallback results are now explicitly flagged with `isFallback: true`
- Warning logged when fallback is used so developers know real search failed
- Comment updated to be honest about what the fallback actually does

---

## 5. Changes: `server.js`

### 5a. Rate Limiting

Added `express-rate-limit` to prevent abuse of expensive endpoints:

| Endpoint | Limit |
|---|---|
| `POST /api/seo-audit` | 10 requests / 15 min per IP |
| `POST /api/keywords/research` | 15 requests / 15 min per IP |
| `POST /api/auth/register` | 30 requests / 15 min per IP |
| `POST /api/auth/login` | 30 requests / 15 min per IP |

### 5b. SSRF Protection

Added `isSafeUrl()` validation before any URL is passed to `axios.get()`. Blocks:
- `localhost`, `127.0.0.1`, `::1` (loopback)
- `10.x.x.x` (private class A)
- `172.16.x.x – 172.31.x.x` (private class B)
- `192.168.x.x` (private class C)
- `169.254.x.x` (link-local)
- `0.x.x.x`
- `file://`, `ftp://`, and any non-HTTP protocol

### 5c. Ollama Enrichment in Audit Response

After every successful single-page audit, two parallel Ollama calls are made:
1. `generateSEORecommendations()` — 5 contextual LLM recommendations
2. `generateGradeJustification()` — 2-sentence grade explanation

Results are attached to the response as `result.ollama`. If Ollama is unavailable, `ollama.available = false` and the standard rule-based results are still returned unchanged.

---

## 6. New Files: `tests/`

| File | Tests | Description |
|---|---|---|
| `tests/seoAudit.test.js` | 30 | Covers extraction, scoring, readability, edge cases |
| `tests/keywordResearch.test.js` | 26 | Covers n-gram extraction, volume estimates, intent classification |
| `tests/security.test.js` | 27 | Covers SSRF protection for all private IP ranges and protocols |
| `tests/ollamaService.test.js` | 10 | Covers graceful fallback when Ollama is unavailable |

Run all tests: `npm run test:backend`

---

## 7. New Dependencies Added to `package.json`

| Package | Version | Purpose |
|---|---|---|
| `cheerio` | ^1.2.0 | Proper HTML parsing (replaces regex) |
| `express-rate-limit` | ^7.5.1 | Rate limiting for expensive routes |
| `@xenova/transformers` | ^2.17.2 | ML model (was used but not listed in package.json) |

All packages are free and open-source (zero cost).

---

## Test Run Output

```
ℹ tests 90
ℹ suites 14
ℹ pass  90
ℹ fail   0
ℹ duration_ms 2347
```

**All 90 tests pass.**
