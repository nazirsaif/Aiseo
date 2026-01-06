/**
 * SEO Audit Service - Rule-based SEO analysis
 * This service performs automated SEO checks on URLs or HTML content
 * Future: Can be enhanced with ML-based scoring using Hugging Face models
 */

const axios = require('axios');

/**
 * Fetch HTML content from a URL
 */
async function fetchHTMLFromURL(url) {
  try {
    // Ensure URL has protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }

    // Try with comprehensive headers to avoid 403 errors
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Cache-Control': 'max-age=0'
    };

    try {
      const response = await axios.get(url, {
        headers: headers,
        timeout: 15000, // 15 second timeout
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Accept 2xx and 3xx
        }
      });

      return response.data;
    } catch (axiosError) {
      // If 403 error, try with simpler headers
      if (axiosError.response && axiosError.response.status === 403) {
        console.log('403 error, retrying with simpler headers...');
        try {
          const simpleResponse = await axios.get(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 15000,
            maxRedirects: 5
          });
          return simpleResponse.data;
        } catch (retryError) {
          // If still fails, provide helpful error message
          if (retryError.response && retryError.response.status === 403) {
            throw new Error('Website blocked automated access (403 Forbidden). Some websites prevent automated tools. Try using HTML content directly or a different URL.');
          }
          throw retryError;
        }
      }
      throw axiosError;
    }
  } catch (error) {
    if (error.response) {
      // HTTP error response
      const status = error.response.status;
      const statusText = error.response.statusText || 'Unknown Error';
      
      if (status === 403) {
        throw new Error(`Access forbidden (403). This website blocks automated requests. Please try: 1) Using HTML content directly, or 2) A different URL that allows automated access.`);
      } else if (status === 404) {
        throw new Error(`Page not found (404). Please check if the URL is correct.`);
      } else if (status === 500) {
        throw new Error(`Server error (500). The website server encountered an error.`);
      } else {
        throw new Error(`HTTP ${status} ${statusText}. Failed to fetch URL.`);
      }
    } else if (error.request) {
      // Request made but no response
      throw new Error(`No response from server. Check your internet connection or the URL might be unreachable.`);
    } else {
      // Other error
      throw new Error(`Failed to fetch URL: ${error.message}`);
    }
  }
}

/**
 * Extract SEO elements from HTML content
 */
function extractSEOElements(html) {
  const elements = {
    title: '',
    metaDescription: '',
    h1Tags: [],
    h2Tags: [],
    images: [],
    links: [],
    wordCount: 0,
    hasOpenGraph: false,
    hasTwitterCard: false
  };

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    elements.title = titleMatch[1].trim();
  }

  // Extract meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (metaDescMatch) {
    elements.metaDescription = metaDescMatch[1].trim();
  }

  // Extract H1 tags
  const h1Matches = html.match(/<h1[^>]*>([^<]+)<\/h1>/gi);
  if (h1Matches) {
    elements.h1Tags = h1Matches.map(h1 => h1.replace(/<[^>]+>/g, '').trim());
  }

  // Extract H2 tags
  const h2Matches = html.match(/<h2[^>]*>([^<]+)<\/h2>/gi);
  if (h2Matches) {
    elements.h2Tags = h2Matches.map(h2 => h2.replace(/<[^>]+>/g, '').trim());
  }

  // Extract images
  const imgMatches = html.match(/<img[^>]*>/gi);
  if (imgMatches) {
    elements.images = imgMatches.map(img => {
      const altMatch = img.match(/alt=["']([^"']+)["']/i);
      return {
        hasAlt: !!altMatch,
        alt: altMatch ? altMatch[1] : ''
      };
    });
  }

  // Extract links
  const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
  if (linkMatches) {
    elements.links = linkMatches.length;
  }

  // Count words (remove HTML tags first)
  const textContent = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  elements.wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;

  // Check for Open Graph
  elements.hasOpenGraph = /<meta[^>]*property=["']og:/i.test(html);

  // Check for Twitter Card
  elements.hasTwitterCard = /<meta[^>]*name=["']twitter:card["']/i.test(html);

  return elements;
}

/**
 * Perform SEO checks and generate issues/recommendations
 */
function performSEOChecks(elements) {
  const issues = [];
  const recommendations = [];
  let score = 100; // Start with perfect score, deduct for issues

  // Check title
  if (!elements.title) {
    issues.push({
      type: 'critical',
      category: 'title',
      message: 'Missing page title',
      impact: 'High'
    });
    score -= 15;
    recommendations.push('Add a descriptive <title> tag (50-60 characters recommended)');
  } else {
    const titleLength = elements.title.length;
    if (titleLength < 30) {
      issues.push({
        type: 'warning',
        category: 'title',
        message: `Title too short (${titleLength} characters)`,
        impact: 'Medium'
      });
      score -= 5;
      recommendations.push('Increase title length to 50-60 characters for better SEO');
    } else if (titleLength > 60) {
      issues.push({
        type: 'warning',
        category: 'title',
        message: `Title too long (${titleLength} characters)`,
        impact: 'Medium'
      });
      score -= 3;
      recommendations.push('Reduce title length to 50-60 characters to avoid truncation');
    }
  }

  // Check meta description
  if (!elements.metaDescription) {
    issues.push({
      type: 'critical',
      category: 'meta_description',
      message: 'Missing meta description',
      impact: 'High'
    });
    score -= 10;
    recommendations.push('Add a meta description tag (150-160 characters recommended)');
  } else {
    const descLength = elements.metaDescription.length;
    if (descLength < 120) {
      issues.push({
        type: 'warning',
        category: 'meta_description',
        message: `Meta description too short (${descLength} characters)`,
        impact: 'Medium'
      });
      score -= 3;
      recommendations.push('Increase meta description to 150-160 characters');
    } else if (descLength > 160) {
      issues.push({
        type: 'warning',
        category: 'meta_description',
        message: `Meta description too long (${descLength} characters)`,
        impact: 'Medium'
      });
      score -= 2;
      recommendations.push('Reduce meta description to 150-160 characters');
    }
  }

  // Check H1 tags
  if (elements.h1Tags.length === 0) {
    issues.push({
      type: 'critical',
      category: 'heading',
      message: 'Missing H1 tag',
      impact: 'High'
    });
    score -= 10;
    recommendations.push('Add exactly one H1 tag to your page');
  } else if (elements.h1Tags.length > 1) {
    issues.push({
      type: 'warning',
      category: 'heading',
      message: `Multiple H1 tags found (${elements.h1Tags.length})`,
      impact: 'Medium'
    });
    score -= 5;
    recommendations.push('Use only one H1 tag per page for better SEO');
  }

  // Check H2 tags
  if (elements.h2Tags.length === 0) {
    issues.push({
      type: 'info',
      category: 'heading',
      message: 'No H2 tags found',
      impact: 'Low'
    });
    score -= 2;
    recommendations.push('Add H2 tags to structure your content');
  }

  // Check images without alt text
  const imagesWithoutAlt = elements.images.filter(img => !img.hasAlt).length;
  if (imagesWithoutAlt > 0) {
    issues.push({
      type: 'warning',
      category: 'images',
      message: `${imagesWithoutAlt} image(s) missing alt text`,
      impact: 'Medium'
    });
    score -= imagesWithoutAlt * 2; // Max -10 points
    recommendations.push(`Add alt text to ${imagesWithoutAlt} image(s) for accessibility and SEO`);
  }

  // Check word count
  if (elements.wordCount < 300) {
    issues.push({
      type: 'warning',
      category: 'content',
      message: `Low word count (${elements.wordCount} words)`,
      impact: 'Medium'
    });
    score -= 5;
    recommendations.push('Increase content length to at least 300 words for better SEO');
  }

  // Check for Open Graph
  if (!elements.hasOpenGraph) {
    issues.push({
      type: 'info',
      category: 'social',
      message: 'Missing Open Graph tags',
      impact: 'Low'
    });
    score -= 3;
    recommendations.push('Add Open Graph meta tags for better social media sharing');
  }

  // Check for Twitter Card
  if (!elements.hasTwitterCard) {
    issues.push({
      type: 'info',
      category: 'social',
      message: 'Missing Twitter Card tags',
      impact: 'Low'
    });
    score -= 2;
    recommendations.push('Add Twitter Card meta tags for better Twitter sharing');
  }

  // Ensure score doesn't go below 0
  score = Math.max(0, score);

  return {
    score,
    issues,
    recommendations
  };
}

/**
 * Main audit function
 */
async function performSEOAudit(url, htmlContent) {
  try {
    let html = htmlContent;

    // If URL provided but no HTML, fetch it
    if (url && !html) {
      try {
        html = await fetchHTMLFromURL(url);
      } catch (fetchError) {
        console.error('URL fetch error:', fetchError);
        return {
          success: false,
          error: `Failed to fetch URL: ${fetchError.message}. Please check if the URL is accessible.`
        };
      }
    }

    if (!html) {
      return {
        success: false,
        error: 'Either URL or HTML content must be provided'
      };
    }

    // Extract SEO elements
    let elements;
    try {
      elements = extractSEOElements(html);
    } catch (parseError) {
      console.error('HTML parsing error:', parseError);
      return {
        success: false,
        error: `Failed to parse HTML content: ${parseError.message}`
      };
    }

    // Perform checks
    let auditResult;
    try {
      auditResult = performSEOChecks(elements);
    } catch (checkError) {
      console.error('SEO checks error:', checkError);
      return {
        success: false,
        error: `Failed to perform SEO checks: ${checkError.message}`
      };
    }

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
        imageCount: elements.images.length,
        imagesWithoutAlt: elements.images.filter(img => !img.hasAlt).length,
        linkCount: elements.links,
        wordCount: elements.wordCount,
        hasOpenGraph: elements.hasOpenGraph,
        hasTwitterCard: elements.hasTwitterCard
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
    return {
      success: false,
      error: error.message || 'An unexpected error occurred during SEO audit'
    };
  }
}

/**
 * Get grade based on score
 */
function getScoreGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Normalize URL - convert to absolute URL and remove fragments
 */
function normalizeURL(url, baseURL) {
  try {
    // If relative URL, make it absolute using baseURL
    if (url.startsWith('/')) {
      const base = new URL(baseURL);
      return `${base.protocol}//${base.host}${url}`;
    }
    
    // If protocol-relative, add protocol from baseURL
    if (url.startsWith('//')) {
      const base = new URL(baseURL);
      return `${base.protocol}${url}`;
    }
    
    // If already absolute, use as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      // Remove fragment (#)
      urlObj.hash = '';
      return urlObj.toString();
    }
    
    // Relative URL without leading slash
    const base = new URL(baseURL);
    const basePath = base.pathname.endsWith('/') ? base.pathname : base.pathname.substring(0, base.pathname.lastIndexOf('/') + 1);
    return `${base.protocol}//${base.host}${basePath}${url}`;
  } catch (error) {
    return null;
  }
}

/**
 * Extract base domain from URL
 */
function getBaseDomain(url) {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}`;
  } catch (error) {
    return null;
  }
}

/**
 * Check if URL is internal (same domain)
 */
function isInternalURL(url, baseDomain) {
  try {
    const urlObj = new URL(url);
    const urlDomain = `${urlObj.protocol}//${urlObj.host}`;
    return urlDomain === baseDomain;
  } catch (error) {
    return false;
  }
}

/**
 * Extract internal links from HTML content
 */
function extractInternalLinks(html, currentURL, baseDomain) {
  const links = new Set();
  
  try {
    // Extract all href attributes from anchor tags
    const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi);
    
    if (linkMatches) {
      linkMatches.forEach(match => {
        const hrefMatch = match.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
          const href = hrefMatch[1].trim();
          
          // Skip javascript:, mailto:, tel:, #, and empty links
          if (href.startsWith('javascript:') || 
              href.startsWith('mailto:') || 
              href.startsWith('tel:') || 
              href === '#' || 
              href === '' ||
              href.startsWith('#')) {
            return;
          }
          
          // Normalize the URL
          const normalizedURL = normalizeURL(href, currentURL);
          if (normalizedURL && isInternalURL(normalizedURL, baseDomain)) {
            links.add(normalizedURL);
          }
        }
      });
    }
  } catch (error) {
    console.error('Error extracting internal links:', error);
  }
  
  return Array.from(links);
}

/**
 * Deep crawl audit - Google-like crawler that audits multiple pages
 * @param {string} startURL - Starting URL to crawl
 * @param {object} options - Crawl options
 * @param {number} options.maxDepth - Maximum crawl depth (default: 3)
 * @param {number} options.maxPages - Maximum number of pages to crawl (default: 10)
 */
async function performDeepCrawlAudit(startURL, options = {}) {
  const maxDepth = options.maxDepth || 3;
  const maxPages = options.maxPages || 10;
  
  // Ensure URL has protocol
  if (!startURL.startsWith('http://') && !startURL.startsWith('https://')) {
    startURL = 'https://' + startURL;
  }
  
  const baseDomain = getBaseDomain(startURL);
  if (!baseDomain) {
    return {
      success: false,
      error: 'Invalid starting URL'
    };
  }
  
  // Queue: [{ url, depth }]
  const queue = [{ url: startURL, depth: 0 }];
  const visited = new Set();
  const pageResults = [];
  let pagesCrawled = 0;
  const errors = [];
  
  console.log(`Starting deep crawl from: ${startURL}`);
  console.log(`Max depth: ${maxDepth}, Max pages: ${maxPages}`);
  
  while (queue.length > 0 && pagesCrawled < maxPages) {
    const { url, depth } = queue.shift();
    
    // Skip if already visited or exceeds max depth
    if (visited.has(url) || depth > maxDepth) {
      continue;
    }
    
    // Mark as visited
    visited.add(url);
    
    console.log(`[Depth ${depth}] Crawling: ${url} (${pagesCrawled + 1}/${maxPages})`);
    
    try {
      // Fetch HTML
      let html;
      try {
        html = await fetchHTMLFromURL(url);
      } catch (fetchError) {
        errors.push({
          url,
          error: `Failed to fetch: ${fetchError.message}`
        });
        console.error(`Failed to fetch ${url}:`, fetchError.message);
        continue;
      }
      
      // Perform SEO audit on this page
      const auditResult = await performSEOAudit(url, html);
      
      if (auditResult.success) {
        pageResults.push({
          url,
          depth,
          ...auditResult
        });
        pagesCrawled++;
        
        // Extract internal links for next level
        if (depth < maxDepth && pagesCrawled < maxPages) {
          const internalLinks = extractInternalLinks(html, url, baseDomain);
          
          // Add new links to queue (only if not visited and within limits)
          for (const link of internalLinks) {
            if (!visited.has(link) && queue.length + pagesCrawled < maxPages * 2) {
              queue.push({ url: link, depth: depth + 1 });
            }
          }
          
          console.log(`  Found ${internalLinks.length} internal links, ${queue.length} in queue`);
        }
      } else {
        errors.push({
          url,
          error: auditResult.error || 'Audit failed'
        });
      }
      
      // Small delay to be respectful to servers
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      errors.push({
        url,
        error: error.message || 'Unexpected error'
      });
      console.error(`Error processing ${url}:`, error);
    }
  }
  
  // Aggregate results
  if (pageResults.length === 0) {
    return {
      success: false,
      error: 'No pages were successfully crawled',
      errors,
      crawlStats: {
        pagesCrawled: 0,
        maxDepth,
        maxPages,
        actualDepth: 0,
        errorsCount: errors.length
      }
    };
  }
  
  // Calculate aggregate statistics
  const totalScore = pageResults.reduce((sum, page) => sum + (page.audit?.score || 0), 0);
  let averageScore = Math.round(totalScore / pageResults.length);
  
  // Ensure we have valid aggregate data even if empty
  if (isNaN(averageScore) || averageScore < 0) {
    console.warn('Invalid average score calculated, defaulting to 0');
    averageScore = 0;
  }
  
  // Aggregate all issues and recommendations
  const allIssues = [];
  const allRecommendations = [];
  const issuesByCategory = {};
  
  pageResults.forEach(page => {
    if (page.audit?.issues) {
      page.audit.issues.forEach(issue => {
        allIssues.push({
          ...issue,
          url: page.url
        });
        
        if (!issuesByCategory[issue.category]) {
          issuesByCategory[issue.category] = [];
        }
        issuesByCategory[issue.category].push({
          ...issue,
          url: page.url
        });
      });
    }
    
    if (page.audit?.recommendations) {
      page.audit.recommendations.forEach(rec => {
        if (!allRecommendations.includes(rec)) {
          allRecommendations.push(rec);
        }
      });
    }
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
      topIssues: allIssues
        .filter(i => i.type === 'critical' || i.type === 'warning')
        .slice(0, 20),
      recommendations: allRecommendations
    },
    pages: pageResults.map(page => ({
      url: page.url,
      depth: page.depth,
      score: page.audit?.score || 0,
      grade: page.audit?.grade || 'F',
      issuesCount: page.audit?.issuesCount || 0
    })),
    detailedPages: pageResults,
    errors: errors.length > 0 ? errors : undefined
  };
}

module.exports = {
  performSEOAudit,
  performDeepCrawlAudit,
  extractSEOElements,
  performSEOChecks
};

