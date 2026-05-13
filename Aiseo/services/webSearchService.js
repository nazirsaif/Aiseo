const axios = require('axios');
const { JSDOM } = require('jsdom');

/**
 * Search the web for competitors ranking for a keyword
 * Uses multiple methods to ensure reliability
 */
async function searchWebForCompetitors(keyword, maxResults = 10) {
  console.log(`\n=== Web Search for Keyword: "${keyword}" ===`);
  
  // Method 1: Try DuckDuckGo HTML search with improved parsing
  try {
    const results = await searchDuckDuckGoHTML(keyword, maxResults);
    if (results.length > 0) {
      console.log(`✅ Found ${results.length} competitors from DuckDuckGo`);
      return results;
    }
  } catch (error) {
    console.log(`DuckDuckGo HTML search failed: ${error.message}`);
  }
  
  // Method 2: Try Google search
  try {
    const results = await searchGoogleHTML(keyword, maxResults);
    if (results.length > 0) {
      console.log(`✅ Found ${results.length} competitors from Google`);
      return results;
    }
  } catch (error) {
    console.log(`Google search failed: ${error.message}`);
  }
  
  // Method 3: All real search methods failed — return clearly-flagged fallback
  console.warn('[WebSearch] All real search methods failed. Using fallback placeholder URLs.');
  return generateKeywordBasedCompetitors(keyword, maxResults);
}

/**
 * Search DuckDuckGo HTML - improved parsing
 */
async function searchDuckDuckGoHTML(keyword, maxResults) {
  const searchQuery = encodeURIComponent(keyword);
  const searchUrl = `https://html.duckduckgo.com/html/?q=${searchQuery}`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
  };

  const response = await axios.get(searchUrl, { headers, timeout: 15000 });
  const html = response.data;
  
  const results = [];
  const seenUrls = new Set();
  
  // Strategy 1: Extract all URLs from href attributes using regex
  // DuckDuckGo uses /l/?uddg=encoded_url pattern
  const urlRegex = /href=["']([^"']*\/l\/\?[^"']*uddg=([^"'\s&<>]+)[^"']*)["']/gi;
  let match;
  
  while ((match = urlRegex.exec(html)) !== null && results.length < maxResults * 2) {
    try {
      const fullHref = match[1];
      const encodedUrl = match[2];
      
      if (!encodedUrl) continue;
      
      // Decode the URL
      const cleanUrl = decodeURIComponent(encodedUrl);
      
      // Validate URL
      if (!cleanUrl.startsWith('http') || 
          cleanUrl.includes('duckduckgo.com') || 
          seenUrls.has(cleanUrl)) {
        continue;
      }
      
      seenUrls.add(cleanUrl);
      
      // Try to extract title from surrounding HTML
      const hrefIndex = html.indexOf(fullHref);
      const snippet = html.substring(Math.max(0, hrefIndex - 300), Math.min(html.length, hrefIndex + 300));
      
      // Try multiple title patterns
      let title = '';
      const titlePatterns = [
        /<a[^>]*class="[^"]*result__title[^"]*"[^>]*>([^<]+)<\/a>/i,
        /<a[^>]*>([^<]{10,100})<\/a>/i,
        /class="[^"]*result__title[^"]*"[^>]*>([^<]+)</i
      ];
      
      for (const pattern of titlePatterns) {
        const titleMatch = snippet.match(pattern);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1].trim().replace(/\s+/g, ' ');
          if (title.length > 5 && title.length < 200) break;
        }
      }
      
      // If no title found, use domain name
      if (!title) {
        try {
          const urlObj = new URL(cleanUrl);
          title = urlObj.hostname.replace('www.', '');
        } catch (e) {
          title = cleanUrl;
        }
      }
      
      results.push({
        url: cleanUrl,
        title: title || cleanUrl,
        rank: results.length + 1
      });
    } catch (e) {
      // Skip invalid URLs
      continue;
    }
  }
  
  // Strategy 2: If regex didn't work, try DOM parsing
  if (results.length === 0) {
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    // Find all links
    const allLinks = document.querySelectorAll('a[href]');
    
    for (const link of allLinks) {
      if (results.length >= maxResults) break;
      
      const href = link.getAttribute('href');
      if (!href || !href.includes('uddg=')) continue;
      
      try {
        // Extract URL from DuckDuckGo redirect
        const match = href.match(/uddg=([^&]+)/);
        if (!match) continue;
        
        const cleanUrl = decodeURIComponent(match[1]);
        
        if (cleanUrl.startsWith('http') && 
            !cleanUrl.includes('duckduckgo.com') && 
            !seenUrls.has(cleanUrl)) {
          seenUrls.add(cleanUrl);
          const title = link.textContent.trim() || cleanUrl;
          
          results.push({
            url: cleanUrl,
            title: title,
            rank: results.length + 1
          });
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  return results.slice(0, maxResults);
}

/**
 * Search Google HTML
 */
async function searchGoogleHTML(keyword, maxResults) {
  const searchQuery = encodeURIComponent(keyword);
  const searchUrl = `https://www.google.com/search?q=${searchQuery}&num=${maxResults}`;
  
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/'
  };

  const response = await axios.get(searchUrl, { headers, timeout: 10000 });
  const html = response.data;
  const dom = new JSDOM(html);
  const document = dom.window.document;

  const results = [];
  const seenUrls = new Set();
  
  // Extract URLs from Google search results
  const links = document.querySelectorAll('a[href^="/url?q="], .g a[href], .yuRUbf a');
  
  for (const link of links) {
    if (results.length >= maxResults) break;
    
    const href = link.getAttribute('href');
    if (!href) continue;
    
    try {
      let url = null;
      
      // Extract from Google redirect
      const urlMatch = href.match(/\/url\?q=([^&]+)/);
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1]);
      } else if (href.startsWith('http')) {
        url = href;
      }
      
      if (!url || !url.startsWith('http') || seenUrls.has(url)) continue;
      if (url.includes('google.com') || url.includes('googleusercontent.com')) continue;
      
      seenUrls.add(url);
      const title = link.textContent.trim() || 
                   link.querySelector('h3')?.textContent.trim() || 
                   url;
      
      results.push({
        url: url,
        title: title,
        rank: results.length + 1
      });
    } catch (e) {
      continue;
    }
  }
  
  return results;
}

/**
 * Generate fallback placeholder competitors when web search is unavailable.
 *
 * ⚠️  These are NOT real search results — they are known high-authority domains
 * that commonly appear for informational queries.  Results are explicitly flagged
 * with isFallback:true so the frontend / keyword service can treat them differently.
 * Only Wikipedia is likely to actually exist for a given keyword slug.
 */
function generateKeywordBasedCompetitors(keyword, maxResults) {
  const keywordLower = keyword.toLowerCase().trim();
  const keywordSlug = keywordLower.replace(/\s+/g, '-');
  const keywordEncoded = encodeURIComponent(keyword);

  // Only include URLs that are very likely to genuinely exist
  const patterns = [
    {
      url: `https://en.wikipedia.org/wiki/${keywordEncoded}`,
      title: `${keyword} - Wikipedia`
    },
    {
      url: `https://www.britannica.com/topic/${keywordSlug}`,
      title: `${keyword} | Britannica`
    },
    {
      url: `https://dictionary.cambridge.org/dictionary/english/${keywordSlug}`,
      title: `${keyword} - Cambridge Dictionary`
    }
  ];

  const results = [];
  for (let i = 0; i < Math.min(patterns.length, maxResults); i++) {
    results.push({
      url: patterns[i].url,
      title: patterns[i].title,
      rank: i + 1,
      isFallback: true  // ← always flag so callers know this is not real SERP data
    });
  }

  console.warn(`[WebSearch] ⚠️  Real search failed — returning ${results.length} fallback placeholder URLs (not actual SERP results).`);
  return results;
}

/**
 * Fetch real visibility data for a domain from search results
 * Returns { indexedPages: number, mentions: number }
 */
async function getDomainIntelligence(url) {
  try {
    let domain = '';
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
      domain = url.replace(/https?:\/\//, '').split('/')[0].replace('www.', '');
    }

    console.log(`\n=== Domain Intelligence for: "${domain}" ===`);

    // 1. Get Indexed Pages (site:domain.com)
    const indexedPages = await fetchResultCount(`site:${domain}`);
    
    // 2. Get Mentions/Backlinks ("domain.com" -site:domain.com)
    const mentions = await fetchResultCount(`"${domain}" -site:${domain}`);

    console.log(`📊 Real Stats — Indexed: ${indexedPages.toLocaleString()}, Mentions: ${mentions.toLocaleString()}`);

    return {
      indexedPages,
      mentions,
      success: true
    };
  } catch (error) {
    console.error(`[DomainIntelligence] Error: ${error.message}`);
    return {
      indexedPages: 0,
      mentions: 0,
      success: false
    };
  }
}

/**
 * Fetch the "About X results" count from Google for a specific query
 */
async function fetchResultCount(query) {
  try {
    const searchQuery = encodeURIComponent(query);
    const searchUrl = `https://www.google.com/search?q=${searchQuery}`;
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.google.com/'
    };

    const response = await axios.get(searchUrl, { headers, timeout: 15000 });
    const html = response.data;
    
    // Pattern: id="result-stats">About 835,000,000 results
    const match = html.match(/id="result-stats"[^>]*>([^<]+)/i);
    if (match && match[1]) {
      const text = match[1];
      // Extract numbers and handle commas/periods
      const countMatch = text.replace(/,/g, '').replace(/\./g, '').match(/(\d+)/);
      if (countMatch) {
        return parseInt(countMatch[0], 10);
      }
    }
    
    // Fallback: If result-stats is hidden or missing, try a simpler regex
    const altMatch = html.match(/([\d,.]+)\s+results/i);
    if (altMatch && altMatch[1]) {
      return parseInt(altMatch[1].replace(/,/g, '').replace(/\./g, ''), 10);
    }

    return 0;
  } catch (error) {
    console.warn(`[fetchResultCount] Failed for "${query}": ${error.message}`);
    return 0;
  }
}

module.exports = {
  searchWebForCompetitors,
  searchDuckDuckGoHTML,
  searchGoogleHTML,
  generateKeywordBasedCompetitors,
  getDomainIntelligence
};
