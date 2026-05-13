/**
 * SEO Audit Service — Full Integrated Version
 */
const axios = require('axios');
const cheerio = require('cheerio');
const webSearchService = require('./webSearchService');

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
    if (url && !html) {
      try {
        html = await fetchHTMLFromURL(url);
        verifyContentIntegrity(html, url); // Second pass after potential fallback
      } catch (err) {
        return {
          success: false,
          error: 'Bot Protection Active',
          message: err.message || 'Website blocked our scanner. Please use Manual HTML Input.',
          blocked: true
        };
      }
    }
    if (!html) return { success: false, error: 'URL or HTML required.' };

    const elements = extractSEOElements(html);
    const mlAnalysis = await getMLModelPrediction(elements);
    
    // FETCH REAL DOMAIN STATS (Option 3 Implementation)
    let domainStats = { indexedPages: 0, mentions: 0 };
    if (url) {
      domainStats = await webSearchService.getDomainIntelligence(url);
    }

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
        ml_score: mlAnalysis.score,
        // Real Visibility Stats
        indexedPages: domainStats.indexedPages,
        mentions: domainStats.mentions
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

/**
 * Validates that the fetched HTML is actually content and not a bot-protection screen.
 * Analyzes DOM structure, script ratios, and common block titles.
 */
function verifyContentIntegrity(html, url) {
  const $ = cheerio.load(html);
  
  const title = $('title').text().toLowerCase().trim();
  const wordCount = $('body').text().split(/\s+/).filter(w => w.length > 0).length;
  const scriptCount = $('script').length;
  
  // 1. Signature Block Titles
  if (
    title === 'just a moment...' || 
    title.includes('attention required') || 
    title.includes('security check') ||
    title.includes('verify you are human') ||
    title.includes('access denied') ||
    title.includes('robot check')
  ) {
    throw new Error('Bot mitigation active: Detected block title signature.');
  }

  // 2. High Script/Low Text Ratio BUT only if it explicitly looks like a Cloudflare/Datadome challenge. 
  // We cannot block all low-text sites because many are SPAs (React/Vue/Angular).
  const isCloudflare = html.includes('cf-browser-verification') || html.includes('cf-challenge') || html.includes('captcha-bypass');
  if (wordCount < 50 && scriptCount > 0 && isCloudflare) {
    throw new Error('Bot mitigation active: Detected JS challenge (high script, low text).');
  }

  // 3. Empty Body Check (Relaxed for SPAs)
  $('script, style, noscript').remove();
  const cleanBodyText = $('body').text().trim();
  if (cleanBodyText.length < 5 && isCloudflare) {
    throw new Error('Bot mitigation active: Empty body structure detected alongside bot-protection scripts.');
  }

  return true;
}

async function fetchHTMLFromURL(url) {
  const https = require('https');
  const agent = new https.Agent({ rejectUnauthorized: false });
  
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/',
        'X-Forwarded-For': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        'Cookie': 'session-id=123-4567890-1234567; i18n-prefs=USD;' // Mock cookie for e-commerce
      },
      timeout: 30000,
      maxRedirects: 10,
      httpsAgent: agent 
    });
    
    const lowerHTML = response.data.toLowerCase();
    
    // Check for common e-commerce block patterns
    if (lowerHTML.includes('robot check') || lowerHTML.includes('captcha') || 
        lowerHTML.includes('access denied') || lowerHTML.includes('security check') ||
        (url.includes('amazon') && lowerHTML.includes('sorry, we just need to make sure you\'re not a robot'))) {
      
      console.warn(`[Scraper] Bot protection triggered on ${url}. Attempting final fallback...`);
      
      // Final attempt with a simple mobile UA and no extra headers
      const simpleUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
      const lastResort = await axios.get(url, { 
        headers: { 'User-Agent': simpleUA }, 
        timeout: 15000, 
        httpsAgent: agent,
        validateStatus: false
      });
      
      if (lastResort.status === 200 && lastResort.data.length > 5000) {
        verifyContentIntegrity(lastResort.data, url);
        return lastResort.data;
      }

      throw new Error(`Bot Mitigation Active: This website is protected by advanced security. Automated scraping is NOT possible for this URL. Please use the 'Manual HTML' option below to proceed.`);
    }

    verifyContentIntegrity(response.data, url);
    return response.data;
  } catch (err) {
    // Try one more time with Googlebot UA if the first one fails
    try {
      const retryResponse = await axios.get(url, {
        headers: { 
          'User-Agent': userAgents[1],
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 20000,
        httpsAgent: agent
      });
      return retryResponse.data;
    } catch (retryErr) {
      if (retryErr.response && retryErr.response.status === 403) {
        throw new Error(`Access Denied (403): This domain is protected by strong anti-bot measures. Automated scraping is NOT possible. Please use the 'Manual HTML' option below.`);
      }
      throw new Error(`Scraper Blocked: ${retryErr.message}. This website restricts automated access. Please use the 'Manual HTML' option below.`);
    }
  }
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