/**
 * SEO Audit Service — Full Integrated Version
 */
const axios = require('axios');
const cheerio = require('cheerio');

// ─── Custom Machine Learning Model Integration ────────────────────────────────
async function getMLModelPrediction(elements) {
  try {
    const modelMetrics = {
      content_length: elements.wordCount || 0,
      keyword_density: 1.5, // Placeholder/Default
      num_internal_links: elements.links || 0,
      num_external_links: Math.floor(Math.random() * 5), // Placeholder
      has_meta_description: elements.metaDescription ? 1 : 0,
      has_alt_text: (elements.images && elements.images.length > 0 && elements.images.every(i => i.hasAlt)) ? 1 : 0,
      avg_time_on_page_sec: 45, // Placeholder
      bounce_rate: 40, // Placeholder
      scroll_depth_percent: 60, // Placeholder
      domain_authority: 25, // Placeholder
      page_authority: 20, // Placeholder
      backlink_count: 50, // Placeholder
      serp_position_before: 12, // Placeholder
      h1Count: elements.h1Tags ? elements.h1Tags.length : 0,
      has_readable_font_size: 1, // Defaulting to true
      isNoindex: elements.isNoindex ? 1 : 0,
      // Omni Layer Context
      omni_dom_nodes: elements.omni_dom_nodes || 0,
      omni_script_count: elements.omni_script_count || 0,
      omni_text_ratio: elements.omni_text_ratio || 0,
      omni_competitors_found: 2,
      omni_readability: elements.readabilityScore || 10.5
    };
    
    console.log("Sending data to ML Model (Port 5001):", modelMetrics);
    const response = await axios.post('http://localhost:5001/analyze', modelMetrics);
    
    if (response.data && response.data.status === 'success') {
      const audit = response.data.technical_audit;
      return {
        success: true,
        ranking_improved_prediction: audit.score > 50 ? 1 : 0,
        message: "ML Analysis Active",
        projected_score: audit.projected_score,
        score: audit.score,
        issues: audit.issues.map((msg, idx) => ({
          type: 'ai_insight',
          category: 'AI Analysis',
          impact: msg.toLowerCase().includes('critical') || msg.toLowerCase().includes('excessive') ? 'High' : 
                  msg.toLowerCase().includes('negative') || msg.toLowerCase().includes('anomaly') ? 'Medium' : 'Low',
          message: msg,
          recommendation: audit.recommendations && audit.recommendations[idx] ? audit.recommendations[idx] : null
        })),
        recommendations: audit.recommendations
      };
    }
    
    return { success: false, message: "Invalid Model Response" };
  } catch (error) {
    console.error("ML Model API FAILED (Port 5001):", error.message);
    return { success: false, message: "Model API offline" };
  }
}

// ─── Main SEO Audit Function ────────────────────────────────────────────────
async function performSEOAudit(url, htmlContent) {
  try {
    let html = htmlContent;
    if (url && !html) html = await fetchHTMLFromURL(url);
    if (!html) return { success: false, error: 'URL or HTML required.' };

    const elements = extractSEOElements(html);
    const mlAnalysis = await getMLModelPrediction(elements);

    if (!mlAnalysis.success) {
      return {
        success: true,
        url: url || 'HTML Provided',
        timestamp: new Date(),
        elements: elements,
        audit: {
          score: 0,
          grade: 'F',
          issues: [{ type: 'critical', category: 'System', impact: 'High', message: `ML Model Offline: ${mlAnalysis.message}` }],
          recommendations: ['Ensure the Python ML model is running on port 5001.'],
          issuesCount: 1,
          recommendationsCount: 1,
          ml_prediction: null,
          ml_message: mlAnalysis.message
        }
      };
    }

    // Sort issues by priority: High > Medium > Low
    if (mlAnalysis.issues && mlAnalysis.issues.length > 0) {
      mlAnalysis.issues.sort((a, b) => {
        const impactMap = { 'High': 1, 'Medium': 2, 'Low': 3 };
        return (impactMap[a.impact] || 3) - (impactMap[b.impact] || 3);
      });
    }

    return {
      success: true,
      url: url || 'HTML Provided',
      timestamp: new Date(),
      elements: elements,
      audit: {
        score: mlAnalysis.score,
        grade: getScoreGrade(mlAnalysis.score),
        issues: mlAnalysis.issues,
        recommendations: mlAnalysis.recommendations,
        issuesCount: mlAnalysis.issues.length,
        recommendationsCount: mlAnalysis.recommendations.length,
        ml_prediction: mlAnalysis.ranking_improved_prediction,
        ml_message: mlAnalysis.message,
        projected_score: mlAnalysis.projected_score,
        ml_score: mlAnalysis.score
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function getScoreGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  return 'F';
}

function extractSEOElements(html) {
  const $ = cheerio.load(html);
  return {
    title: $('title').text(),
    metaDescription: $('meta[name="description"]').attr('content'),
    h1Count: $('h1').length,
    h2Count: $('h2').length,
    h3Count: $('h3').length,
    h1Tags: $('h1').map((_, el) => $(el).text()).get(),
    h2Tags: $('h2').map((_, el) => $(el).text()).get(),
    h3Tags: $('h3').map((_, el) => $(el).text()).get(),
    images: $('img').map((_, el) => ({ hasAlt: !!$(el).attr('alt') })).get(),
    imageCount: $('img').length,
    imagesWithoutAlt: $('img:not([alt])').length + $('img[alt=""]').length,
    wordCount: $('body').text().split(/\s+/).filter(w => w.length > 0).length,
    linkCount: $('a').length,
    hasOpenGraph: !!$('meta[property^="og:"]').length, // Added back
    hasTwitterCard: !!$('meta[name^="twitter:"]').length, // Added back
    canonicalUrl: $('link[rel="canonical"]').attr('href') || null, // Added back
    hasViewport: !!$('meta[name="viewport"]').length,
    langAttr: $('html').attr('lang') || null,
    isNoindex: !!$('meta[name="robots"][content*="noindex"]').length,
    hasJSONLD: !!$('script[type="application/ld+json"]').length,
    hasStructuredData: !!$('script[type="application/ld+json"]').length, // For test compatibility
    readabilityScore: fleschReadingEase($('body').text()),
    // Omni-AI Metrics
    omni_dom_nodes: $('*').length,
    omni_script_count: $('script').length,
    omni_text_ratio: parseFloat((($('body').text().length / (html.length || 1)) * 100).toFixed(2))
  };
}

function fleschReadingEase(text) {
  if (!text || text.trim().length === 0) return null;
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 10) return null; // Too short for meaningful score

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = words.length;

  const countSyllables = (word) => {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const syllables = word.match(/[aeiouy]{1,2}/g);
    return syllables ? syllables.length : 1;
  };

  const totalSyllables = words.reduce((acc, word) => acc + countSyllables(word), 0);
  
  const asl = wordCount / sentenceCount;
  const asw = totalSyllables / wordCount;

  const score = 206.835 - (1.015 * asl) - (84.6 * asw);
  return Math.min(100, Math.max(0, score));
}

async function fetchHTMLFromURL(url) {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    },
    timeout: 15000
  });
  return response.data;
}

// ─── Deep Crawl Audit ───────────────────────────────────────────────────────
async function performDeepCrawlAudit(startUrl, options = {}) {
  const { maxDepth = 3, maxPages = 10 } = options;
  const visited = new Set();
  const queue = [{ url: startUrl, depth: 0 }];
    const pages = [];
    const detailedPages = []; // Store full audit data for return
    const errors = [];
    let actualDepth = 0;

    // Helper: extract base domain (example.com from www.example.com or example.com)
    const getBaseDomain = (urlStr) => {
      try {
        const host = new URL(urlStr).hostname.toLowerCase();
        return host.startsWith('www.') ? host.substring(4) : host;
      } catch (_) { return null; }
    };
    const startBaseDomain = getBaseDomain(startUrl);

    while (queue.length > 0 && pages.length < maxPages) {
      const { url, depth } = queue.shift();
      if (visited.has(url) || depth > maxDepth) continue;
      visited.add(url);
      actualDepth = Math.max(actualDepth, depth);

      try {
        const result = await performSEOAudit(url, null);
        if (result.success) {
          pages.push({
            url,
            depth,
            score: result.audit.score,
            grade: result.audit.grade,
            issuesCount: result.audit.issues.length,
            issues: result.audit.issues,
            recommendations: result.audit.recommendations || []
          });
          detailedPages.push(result); // Keep full result for backend extraction

          // Extract internal links for further crawling
          if (depth < maxDepth) {
            try {
              const html = await fetchHTMLFromURL(url);
              const $ = cheerio.load(html);
              $('a[href]').each((_, el) => {
                try {
                  const href = $(el).attr('href');
                  if (!href) return;
                  const abs = new URL(href, startUrl).toString();
                  const targetBaseDomain = getBaseDomain(abs);

                  // Allow if it's the same base domain (handles www vs non-www)
                  if (targetBaseDomain === startBaseDomain && !visited.has(abs)) {
                    queue.push({ url: abs, depth: depth + 1 });
                  }
                } catch (_) {}
              });
            } catch (_) {}
          }
        }
    } catch (err) {
      errors.push({ url, error: err.message });
    }
  }

  const totalIssues = pages.reduce((sum, p) => sum + p.issuesCount, 0);
  const avgScore = pages.length > 0 ? Math.round(pages.reduce((sum, p) => sum + p.score, 0) / pages.length) : 0;
  const allIssues = pages.flatMap(p => p.issues.map(i => ({ ...i, url: p.url })));
  
  // Sort all issues by priority: High > Medium > Low
  allIssues.sort((a, b) => {
    const impactMap = { 'High': 1, 'Medium': 2, 'Low': 3 };
    return (impactMap[a.impact] || 3) - (impactMap[b.impact] || 3);
  });
  
  // Aggregate recommendations from all pages and deduplicate
  const allRecs = [...new Set(pages.flatMap(p => p.recommendations || []))];

  return {
    success: true,
    startURL: startUrl,
    timestamp: new Date(),
    audit: {
      score: avgScore,
      grade: avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : 'F',
      issuesCount: totalIssues,
      recommendationsCount: allRecs.length,
      recommendations: allRecs,
      ml_prediction: avgScore > 50 ? 1 : 0,
      ml_message: "Deep Crawl Aggregate Analysis",
      projected_score: Math.min(100, avgScore + 5)
    },
    pages: pages.map(p => ({ url: p.url, depth: p.depth, score: p.score, grade: p.grade, issuesCount: p.issuesCount, recommendations: p.recommendations || [] })),
    detailedPages,
    crawlStats: { pagesCrawled: pages.length, maxDepth, maxPages, actualDepth, errorsCount: errors.length },
    aggregate: {
      averageScore: avgScore,
      grade: avgScore >= 90 ? 'A' : avgScore >= 80 ? 'B' : avgScore >= 70 ? 'C' : 'F',
      totalIssues,
      totalRecommendations: allRecs.length,
      topIssues: allIssues, // Removed .slice(0, 20)
      recommendations: allRecs
    },
    errors
  };
}

module.exports = { 
  performSEOAudit, 
  performDeepCrawlAudit, 
  extractSEOElements 
};