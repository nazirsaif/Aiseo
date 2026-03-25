/**
 * SEO Audit Service — v2
 *
 * Improvements over v1:
 *  - Uses cheerio for robust HTML parsing (replaces fragile regex)
 *  - Weighted scoring: critical issues penalise more than minor ones
 *  - New checks: canonical URL, robots meta, viewport, lang attr, structured data
 *  - Flesch-Kincaid readability score (pure JS, no extra deps)
 *  - Image alt-text deduction is properly capped
 *  - noindex detection (huge SEO issue)
 *  - h2Tags exposed in output (needed by keyword research)
 */

const axios = require('axios');
const cheerio = require('cheerio');

// ─── Score deduction weights ────────────────────────────────────────────────
const W = {
  title:           { missing: 20, tooShort: 8, tooLong: 5 },
  metaDescription: { missing: 15, tooShort: 5, tooLong: 3 },
  h1:              { missing: 15, multiple: 7 },
  h2:              { missing: 5 },
  images:          { missingAlt: 2, cap: 10 }, // per-image, hard cap
  content:         { tooShort: 10 },
  viewport:        { missing: 8 },   // mobile-critical
  openGraph:       { missing: 5 },
  canonical:       { missing: 3 },
  lang:            { missing: 3 },
  structuredData:  { missing: 2 },
  twitterCard:     { missing: 2 },
  noindex:         { detected: 25 } // -25: page is invisible to Google
};

// ─── Readability helpers ─────────────────────────────────────────────────────

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const groups = word.match(/[aeiouy]{1,2}/g);
  return groups ? groups.length : 1;
}

/**
 * Flesch Reading Ease: 0 (very hard) – 100 (very easy)
 * Ideal for web content: 60–70
 */
function fleschReadingEase(text) {
  if (!text || text.length < 20) return null;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  if (sentences.length === 0 || words.length === 0) return null;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const asl = words.length / sentences.length;
  const asw = syllables / words.length;
  const score = 206.835 - 1.015 * asl - 84.6 * asw;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ─── Fetch HTML ──────────────────────────────────────────────────────────────

async function fetchHTMLFromURL(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'max-age=0'
  };

  try {
    const res = await axios.get(url, {
      headers,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: s => s >= 200 && s < 400
    });
    return res.data;
  } catch (err) {
    // Retry with minimal headers on 403
    if (err.response?.status === 403) {
      try {
        const res = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 15000,
          maxRedirects: 5
        });
        return res.data;
      } catch (retry) {
        throw new Error(`Website blocked automated access (403). Try pasting the HTML directly.`);
      }
    }
    if (err.response) {
      const s = err.response.status;
      if (s === 404) throw new Error('Page not found (404). Check the URL.');
      if (s === 500) throw new Error('Target server error (500).');
      throw new Error(`HTTP ${s} — failed to fetch URL.`);
    }
    if (err.request) throw new Error('No response from server. Check internet connection or URL.');
    throw new Error(`Failed to fetch URL: ${err.message}`);
  }
}

// ─── Extract SEO elements using cheerio ─────────────────────────────────────

function extractSEOElements(html) {
  const $ = cheerio.load(html);

  // Title
  const title = $('title').first().text().trim();

  // Meta description — handle both attribute orders
  const metaDescription =
    $('meta[name="description"]').attr('content') ||
    $('meta[name="Description"]').attr('content') ||
    '';

  // Headings — cheerio handles nested tags correctly
  const h1Tags = $('h1')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const h2Tags = $('h2')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const h3Tags = $('h3')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  // Images
  const images = $('img')
    .map((_, el) => ({
      hasAlt: !!($(el).attr('alt') || '').trim(),
      alt: ($(el).attr('alt') || '').trim(),
      src: $(el).attr('src') || ''
    }))
    .get();

  // Links
  const links = $('a[href]').length;

  // Structured data — MUST be checked before scripts are removed
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0;

  // Social meta
  const hasOpenGraph = $('meta[property^="og:"]').length > 0;
  const hasTwitterCard = $('meta[name="twitter:card"]').length > 0;

  // Other head checks
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || null;
  const robotsMeta = $('meta[name="robots"]').attr('content') || null;
  const isNoindex = robotsMeta ? /noindex/i.test(robotsMeta) : false;
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const langAttr = $('html').attr('lang') || null;

  // Word count — strip scripts/styles AFTER all tag-based checks
  $('script, style, noscript').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Readability from visible body text
  const readabilityScore = fleschReadingEase(bodyText);

  return {
    title,
    metaDescription,
    h1Tags,
    h2Tags,
    h3Tags,
    images,
    links,
    wordCount,
    hasOpenGraph,
    hasTwitterCard,
    canonicalUrl,
    robotsMeta,
    isNoindex,
    hasViewport,
    langAttr,
    hasStructuredData,
    readabilityScore
  };
}

// ─── Weighted SEO checks ─────────────────────────────────────────────────────

function performSEOChecks(elements) {
  const issues = [];
  const recommendations = [];
  let score = 100;

  const deduct = (points, issue, recommendation) => {
    score -= points;
    issues.push(issue);
    if (recommendation) recommendations.push(recommendation);
  };

  // ── noindex: critical — page is hidden from Google ──
  if (elements.isNoindex) {
    deduct(W.noindex.detected,
      { type: 'critical', category: 'indexing', message: 'Page has noindex directive — hidden from search engines', impact: 'Critical' },
      'Remove the noindex robots meta tag unless you intentionally want this page excluded from search.'
    );
  }

  // ── Title ──
  if (!elements.title) {
    deduct(W.title.missing,
      { type: 'critical', category: 'title', message: 'Missing page title', impact: 'High' },
      'Add a descriptive <title> tag (50–60 characters recommended).'
    );
  } else {
    const len = elements.title.length;
    if (len < 30) {
      deduct(W.title.tooShort,
        { type: 'warning', category: 'title', message: `Title too short (${len} chars)`, impact: 'Medium' },
        `Expand the title to 50–60 characters. Current: "${elements.title}"`
      );
    } else if (len > 60) {
      deduct(W.title.tooLong,
        { type: 'warning', category: 'title', message: `Title too long (${len} chars — truncated in SERPs)`, impact: 'Medium' },
        'Shorten the title to under 60 characters to prevent search-result truncation.'
      );
    }
  }

  // ── Meta description ──
  if (!elements.metaDescription) {
    deduct(W.metaDescription.missing,
      { type: 'critical', category: 'meta_description', message: 'Missing meta description', impact: 'High' },
      'Add a meta description (150–160 characters). It directly affects click-through rate.'
    );
  } else {
    const len = elements.metaDescription.length;
    if (len < 120) {
      deduct(W.metaDescription.tooShort,
        { type: 'warning', category: 'meta_description', message: `Meta description too short (${len} chars)`, impact: 'Medium' },
        'Expand meta description to 150–160 characters with a clear value proposition.'
      );
    } else if (len > 160) {
      deduct(W.metaDescription.tooLong,
        { type: 'warning', category: 'meta_description', message: `Meta description too long (${len} chars — truncated)`, impact: 'Medium' },
        'Trim meta description to under 160 characters.'
      );
    }
  }

  // ── H1 ──
  if (elements.h1Tags.length === 0) {
    deduct(W.h1.missing,
      { type: 'critical', category: 'heading', message: 'No H1 tag found', impact: 'High' },
      'Add exactly one H1 tag that contains your primary keyword.'
    );
  } else if (elements.h1Tags.length > 1) {
    deduct(W.h1.multiple,
      { type: 'warning', category: 'heading', message: `Multiple H1 tags (${elements.h1Tags.length}) — only one is needed`, impact: 'Medium' },
      `Reduce to a single H1 tag. Current H1s: ${elements.h1Tags.slice(0, 2).join(' | ')}`
    );
  }

  // ── H2 ──
  if (elements.h2Tags.length === 0) {
    deduct(W.h2.missing,
      { type: 'info', category: 'heading', message: 'No H2 tags — content has no sub-sections', impact: 'Low' },
      'Add H2 headings to structure your content and help search engines understand topics.'
    );
  }

  // ── Images alt text (capped) ──
  const missingAlt = elements.images.filter(img => !img.hasAlt).length;
  if (missingAlt > 0) {
    const penalty = Math.min(missingAlt * W.images.missingAlt, W.images.cap);
    score -= penalty;
    issues.push({
      type: 'warning', category: 'images',
      message: `${missingAlt} image(s) missing alt text`,
      impact: 'Medium'
    });
    recommendations.push(`Add descriptive alt text to ${missingAlt} image(s) for accessibility and image-search SEO.`);
  }

  // ── Word count ──
  if (elements.wordCount < 300) {
    deduct(W.content.tooShort,
      { type: 'warning', category: 'content', message: `Thin content — only ${elements.wordCount} words`, impact: 'Medium' },
      'Aim for at least 300 words of quality content. Longer, deeper content tends to rank better.'
    );
  }

  // ── Viewport (mobile) ──
  if (!elements.hasViewport) {
    deduct(W.viewport.missing,
      { type: 'critical', category: 'mobile', message: 'Missing viewport meta tag — page is not mobile-friendly', impact: 'High' },
      'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for mobile compatibility.'
    );
  }

  // ── Canonical URL ──
  if (!elements.canonicalUrl) {
    deduct(W.canonical.missing,
      { type: 'info', category: 'canonical', message: 'No canonical URL tag', impact: 'Low' },
      'Add <link rel="canonical" href="..."> to prevent duplicate-content issues.'
    );
  }

  // ── Language attribute ──
  if (!elements.langAttr) {
    deduct(W.lang.missing,
      { type: 'info', category: 'accessibility', message: 'Missing lang attribute on <html> tag', impact: 'Low' },
      'Add a lang attribute to <html> (e.g. lang="en") for accessibility and search engine clarity.'
    );
  }

  // ── Open Graph ──
  if (!elements.hasOpenGraph) {
    deduct(W.openGraph.missing,
      { type: 'info', category: 'social', message: 'Missing Open Graph meta tags', impact: 'Low' },
      'Add og:title, og:description, og:image for better social media sharing appearance.'
    );
  }

  // ── Structured data ──
  if (!elements.hasStructuredData) {
    deduct(W.structuredData.missing,
      { type: 'info', category: 'structured_data', message: 'No JSON-LD structured data found', impact: 'Low' },
      'Add JSON-LD schema markup (Article, Product, FAQ, etc.) for rich search result snippets.'
    );
  }

  // ── Twitter Card ──
  if (!elements.hasTwitterCard) {
    deduct(W.twitterCard.missing,
      { type: 'info', category: 'social', message: 'Missing Twitter Card meta tags', impact: 'Low' },
      'Add twitter:card, twitter:title, twitter:description for better Twitter/X link previews.'
    );
  }

  score = Math.max(0, score);
  return { score, issues, recommendations };
}

// ─── Grade ───────────────────────────────────────────────────────────────────

function getScoreGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// ─── Main audit function ─────────────────────────────────────────────────────

async function performSEOAudit(url, htmlContent) {
  try {
    let html = htmlContent;

    if (url && !html) {
      try {
        html = await fetchHTMLFromURL(url);
      } catch (fetchError) {
        return { success: false, error: `Failed to fetch URL: ${fetchError.message}` };
      }
    }

    if (!html) {
      return { success: false, error: 'Either URL or HTML content must be provided.' };
    }

    let elements;
    try {
      elements = extractSEOElements(html);
    } catch (parseError) {
      return { success: false, error: `Failed to parse HTML: ${parseError.message}` };
    }

    const auditResult = performSEOChecks(elements);

    return {
      success: true,
      url: url || 'HTML Content Provided',
      timestamp: new Date(),
      elements: {
        title: elements.title,
        metaDescription: elements.metaDescription,
        h1Count: elements.h1Tags.length,
        h1Tags: elements.h1Tags,
        h2Count: elements.h2Tags.length,
        h2Tags: elements.h2Tags,
        h3Count: elements.h3Tags.length,
        imageCount: elements.images.length,
        imagesWithoutAlt: elements.images.filter(i => !i.hasAlt).length,
        linkCount: elements.links,
        wordCount: elements.wordCount,
        hasOpenGraph: elements.hasOpenGraph,
        hasTwitterCard: elements.hasTwitterCard,
        canonicalUrl: elements.canonicalUrl,
        hasViewport: elements.hasViewport,
        langAttr: elements.langAttr,
        isNoindex: elements.isNoindex,
        hasStructuredData: elements.hasStructuredData,
        readabilityScore: elements.readabilityScore
      },
      audit: {
        score: auditResult.score,
        grade: getScoreGrade(auditResult.score),
        issuesCount: auditResult.issues.length,
        issues: auditResult.issues,
        recommendationsCount: auditResult.recommendations.length,
        recommendations: auditResult.recommendations
      }
    };
  } catch (error) {
    console.error('Unexpected error in performSEOAudit:', error);
    return { success: false, error: error.message || 'Unexpected error during SEO audit.' };
  }
}

// ─── URL helpers (used by deep crawl) ────────────────────────────────────────

function normalizeURL(url, baseURL) {
  try {
    if (url.startsWith('/')) {
      const base = new URL(baseURL);
      return `${base.protocol}//${base.host}${url}`;
    }
    if (url.startsWith('//')) {
      const base = new URL(baseURL);
      return `${base.protocol}${url}`;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url);
      u.hash = '';
      return u.toString();
    }
    const base = new URL(baseURL);
    const basePath = base.pathname.endsWith('/')
      ? base.pathname
      : base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
    return `${base.protocol}//${base.host}${basePath}${url}`;
  } catch {
    return null;
  }
}

function getBaseDomain(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function isInternalURL(url, baseDomain) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}` === baseDomain;
  } catch {
    return false;
  }
}

function extractInternalLinks(html, currentURL, baseDomain) {
  const links = new Set();
  try {
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = ($(el).attr('href') || '').trim();
      if (!href || href.startsWith('javascript:') || href.startsWith('mailto:') ||
          href.startsWith('tel:') || href === '#' || href.startsWith('#')) return;
      const norm = normalizeURL(href, currentURL);
      if (norm && isInternalURL(norm, baseDomain)) links.add(norm);
    });
  } catch (e) {
    console.error('extractInternalLinks error:', e.message);
  }
  return Array.from(links);
}

// ─── Deep crawl (unchanged logic, improved helpers) ──────────────────────────

async function performDeepCrawlAudit(startURL, options = {}) {
  const maxDepth = options.maxDepth || 3;
  const maxPages = options.maxPages || 10;

  if (!startURL.startsWith('http://') && !startURL.startsWith('https://')) {
    startURL = 'https://' + startURL;
  }

  const baseDomain = getBaseDomain(startURL);
  if (!baseDomain) return { success: false, error: 'Invalid starting URL.' };

  const queue = [{ url: startURL, depth: 0 }];
  const visited = new Set();
  const pageResults = [];
  let pagesCrawled = 0;
  const errors = [];

  console.log(`Deep crawl start: ${startURL} (maxDepth=${maxDepth}, maxPages=${maxPages})`);

  while (queue.length > 0 && pagesCrawled < maxPages) {
    const { url, depth } = queue.shift();
    if (visited.has(url) || depth > maxDepth) continue;
    visited.add(url);

    console.log(`[${depth}] Crawling: ${url}`);
    try {
      let html;
      try {
        html = await fetchHTMLFromURL(url);
      } catch (fetchErr) {
        errors.push({ url, error: fetchErr.message });
        continue;
      }

      const auditResult = await performSEOAudit(url, html);
      if (auditResult.success) {
        pageResults.push({ url, depth, ...auditResult });
        pagesCrawled++;

        if (depth < maxDepth && pagesCrawled < maxPages) {
          const links = extractInternalLinks(html, url, baseDomain);
          for (const link of links) {
            if (!visited.has(link) && queue.length + pagesCrawled < maxPages * 2) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
        }
      } else {
        errors.push({ url, error: auditResult.error || 'Audit failed' });
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      errors.push({ url, error: e.message });
    }
  }

  if (pageResults.length === 0) {
    return {
      success: false,
      error: 'No pages successfully crawled.',
      errors,
      crawlStats: { pagesCrawled: 0, maxDepth, maxPages, actualDepth: 0, errorsCount: errors.length }
    };
  }

  const totalScore = pageResults.reduce((s, p) => s + (p.audit?.score || 0), 0);
  let averageScore = Math.round(totalScore / pageResults.length);
  if (isNaN(averageScore) || averageScore < 0) averageScore = 0;

  const allIssues = [];
  const allRecommendations = [];
  const issuesByCategory = {};

  pageResults.forEach(page => {
    (page.audit?.issues || []).forEach(issue => {
      allIssues.push({ ...issue, url: page.url });
      if (!issuesByCategory[issue.category]) issuesByCategory[issue.category] = [];
      issuesByCategory[issue.category].push({ ...issue, url: page.url });
    });
    (page.audit?.recommendations || []).forEach(rec => {
      if (!allRecommendations.includes(rec)) allRecommendations.push(rec);
    });
  });

  return {
    success: true,
    startURL,
    timestamp: new Date(),
    crawlStats: {
      pagesCrawled: pageResults.length,
      maxDepth,
      maxPages,
      actualDepth: Math.max(...pageResults.map(p => p.depth)),
      errorsCount: errors.length
    },
    aggregate: {
      averageScore,
      grade: getScoreGrade(averageScore),
      totalIssues: allIssues.length,
      totalRecommendations: allRecommendations.length,
      issuesByCategory,
      topIssues: allIssues.filter(i => i.type === 'critical' || i.type === 'warning').slice(0, 20),
      recommendations: allRecommendations
    },
    pages: pageResults.map(p => ({
      url: p.url,
      depth: p.depth,
      score: p.audit?.score || 0,
      grade: p.audit?.grade || 'F',
      issuesCount: p.audit?.issuesCount || 0
    })),
    detailedPages: pageResults,
    errors: errors.length > 0 ? errors : undefined
  };
}

module.exports = {
  performSEOAudit,
  performDeepCrawlAudit,
  extractSEOElements,
  performSEOChecks,
  fleschReadingEase
};
