import React, { useState } from 'react';

const SEOAudit = ({ authToken, API_BASE_URL }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [error, setError] = useState('');
  const [auditHistory, setAuditHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [deepCrawl, setDeepCrawl] = useState(false);
  const [maxDepth, setMaxDepth] = useState(3);
  const [maxPages, setMaxPages] = useState(10);
  const [crawlProgress, setCrawlProgress] = useState(null);

  const performAudit = async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError('');
    setAuditResult(null);
    setCrawlProgress(null);

    try {
      const requestBody = {
        url: url.trim(),
        deepCrawl: deepCrawl,
        ...(deepCrawl && { maxDepth, maxPages })
      };

      const response = await fetch(`${API_BASE_URL}/api/seo-audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        // Show detailed error message
        const errorMsg = data.message || data.error || 'Failed to perform SEO audit';
        setError(errorMsg);
        setIsLoading(false);
        return;
      }

      console.log('Audit response:', data);
      console.log('Audit result:', data.result);
      console.log('Is deep crawl:', deepCrawl);
      
      setAuditResult(data.result);
      setUrl('');
      setIsLoading(false);
      setCrawlProgress(null);
      
      // Refresh history after a short delay to ensure DB save is complete
      setTimeout(() => {
        loadAuditHistory();
      }, 500);
    } catch (err) {
      console.error(err);
      setError('Unable to connect to server. Is the backend running?');
      setIsLoading(false);
      setCrawlProgress(null);
    }
  };

  const loadAuditHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/seo-audit`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      const data = await response.json();
      if (response.ok) {
        console.log('Audit history loaded:', data.audits?.length || 0, 'audits');
        setAuditHistory(data.audits || []);
      } else {
        console.error('Failed to load audit history:', data.message || data.error);
      }
    } catch (err) {
      console.error('Failed to load audit history', err);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#2ecc71'; // Green
    if (score >= 80) return '#3498db'; // Blue
    if (score >= 70) return '#f39c12'; // Orange
    if (score >= 60) return '#e67e22'; // Dark Orange
    return '#e74c3c'; // Red
  };

  const getIssueColor = (type) => {
    if (type === 'critical') return '#e74c3c';
    if (type === 'warning') return '#f39c12';
    return '#3498db';
  };

  return (
    <div className="page-section active">
      {/* Input Section */}
      <div className="input-section">
        <h2><i className="fas fa-search"></i> SEO Audit Pipeline</h2>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
          Enter a URL to perform automated SEO analysis. The system will check title tags, meta descriptions, headings, images, and more.
        </p>
        
        <div className="input-group">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Enter website URL (e.g., https://example.com)"
            onKeyPress={(e) => e.key === 'Enter' && performAudit()}
          />
          <button className="btn btn-primary" onClick={performAudit} disabled={isLoading}>
            {isLoading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> {deepCrawl ? 'Crawling...' : 'Analyzing...'}
              </>
            ) : (
              <>
                <i className="fas fa-chart-line"></i> Run Audit
              </>
            )}
          </button>
        </div>

        {/* Deep Crawl Options */}
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#f0f4ff', borderRadius: '8px', border: '2px solid #667eea' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem', fontWeight: '600' }}>
            <input
              type="checkbox"
              checked={deepCrawl}
              onChange={(e) => setDeepCrawl(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span><i className="fas fa-spider"></i> Enable Deep Crawl</span>
          </label>
          
          {deepCrawl && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: 'white', borderRadius: '6px' }}>
              <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#666' }}>
                <i className="fas fa-info-circle"></i> Deep crawl will recursively audit multiple pages by following internal links.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Max Depth: <span style={{ color: '#667eea' }}>{maxDepth}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                    How deep to crawl (1-5 levels)
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600' }}>
                    Max Pages: <span style={{ color: '#667eea' }}>{maxPages}</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="50"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                  <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                    Maximum pages to crawl (5-50)
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#e3f2fd', borderRadius: '8px', fontSize: '0.9rem', color: '#1565c0' }}>
          <strong><i className="fas fa-info-circle"></i> Tip:</strong> If a website blocks automated access (403 error), you can paste HTML content directly using the "Use HTML" option below.
        </div>
        
        <details style={{ marginTop: '1rem' }}>
          <summary style={{ cursor: 'pointer', color: '#667eea', fontWeight: '600' }}>
            <i className="fas fa-code"></i> Use HTML Content Instead
          </summary>
          <div style={{ marginTop: '1rem' }}>
            <textarea
              placeholder="Paste HTML content here..."
              rows="5"
              style={{
                width: '100%',
                padding: '0.8rem',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.9rem'
              }}
              onChange={(e) => {
                if (e.target.value.trim()) {
                  // Auto-set URL to indicate HTML mode
                  setUrl('HTML_CONTENT_MODE');
                  // Store HTML in a ref or state if needed
                  window.tempHtmlContent = e.target.value;
                }
              }}
            />
            <button
              className="btn btn-secondary"
              style={{ marginTop: '0.5rem' }}
              onClick={async () => {
                const htmlContent = window.tempHtmlContent || '';
                if (!htmlContent.trim()) {
                  setError('Please paste HTML content first');
                  return;
                }
                
                setIsLoading(true);
                setError('');
                setAuditResult(null);
                
                try {
                  const response = await fetch(`${API_BASE_URL}/api/seo-audit`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authToken}`,
                    },
                    body: JSON.stringify({ html: htmlContent }),
                  });

                  const data = await response.json();

                  if (!response.ok) {
                    setError(data.message || data.error || 'Failed to perform SEO audit');
                    setIsLoading(false);
                    return;
                  }

                  setAuditResult(data.result);
                  setIsLoading(false);
                  loadAuditHistory();
                } catch (err) {
                  console.error(err);
                  setError('Unable to connect to server. Is the backend running?');
                  setIsLoading(false);
                }
              }}
            >
              <i className="fas fa-file-code"></i> Audit HTML Content
            </button>
          </div>
        </details>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => { setShowHistory(!showHistory); loadAuditHistory(); }}>
            <i className="fas fa-history"></i> {showHistory ? 'Hide' : 'Show'} Audit History
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#fee', color: '#c33', borderRadius: '8px' }}>
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}
      </div>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="loading active">
          <div className="spinner"></div>
          <p>{deepCrawl ? 'Deep crawling website... This may take a while.' : 'Analyzing SEO elements...'}</p>
          {deepCrawl && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
              The crawler is following internal links and auditing multiple pages...
            </p>
          )}
        </div>
      )}

      {/* Audit History */}
      {showHistory && (
        <div className="input-section" style={{ marginBottom: '2rem' }}>
          <h3><i className="fas fa-history"></i> Recent Audits ({auditHistory.length})</h3>
          {auditHistory.length === 0 ? (
            <p style={{ color: '#666', marginTop: '1rem' }}>No audit history found.</p>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              {auditHistory.map((audit) => (
                <div key={audit._id} className="card" style={{ marginBottom: '1rem', cursor: 'pointer', border: audit.isDeepCrawl ? '2px solid #667eea' : '1px solid #ddd' }} onClick={() => {
                  // If it's a deep crawl, we need to reconstruct the result format
                  if (audit.isDeepCrawl && audit.aggregate) {
                    setAuditResult({
                      aggregate: audit.aggregate,
                      crawlStats: audit.crawlStats,
                      pages: audit.pages,
                      startURL: audit.url,
                      timestamp: audit.createdAt,
                      errors: []
                    });
                  } else {
                    setAuditResult(audit);
                  }
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong>{audit.url}</strong>
                        {audit.isDeepCrawl && (
                          <span style={{ background: '#667eea', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                            <i className="fas fa-spider"></i> Deep Crawl
                          </span>
                        )}
                      </div>
                      <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                        {new Date(audit.createdAt).toLocaleString()}
                      </p>
                      {audit.isDeepCrawl && audit.crawlStats && (
                        <p style={{ color: '#667eea', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                          {audit.crawlStats.pagesCrawled} pages crawled | Depth: {audit.crawlStats.actualDepth}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '2rem', fontWeight: 'bold', color: getScoreColor(audit.score) }}>
                        {audit.score}
                      </div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getScoreColor(audit.score) }}>
                        Grade {audit.grade}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Audit Results */}
      {auditResult && (
        <div className="results-section">
          <div style={{ padding: '2rem' }}>
            {/* Deep Crawl Results */}
            {auditResult.aggregate ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h2><i className="fas fa-spider"></i> Deep Crawl Audit Results</h2>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: getScoreColor(auditResult.aggregate.averageScore) }}>
                      {auditResult.aggregate.averageScore}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: getScoreColor(auditResult.aggregate.averageScore) }}>
                      Grade {auditResult.aggregate.grade}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#e3f2fd', borderRadius: '8px' }}>
                  <h3 style={{ marginBottom: '1rem' }}><i className="fas fa-info-circle"></i> Crawl Statistics</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <strong>Pages Crawled:</strong> {auditResult.crawlStats.pagesCrawled}
                    </div>
                    <div>
                      <strong>Max Depth:</strong> {auditResult.crawlStats.maxDepth} (Actual: {auditResult.crawlStats.actualDepth})
                    </div>
                    <div>
                      <strong>Max Pages:</strong> {auditResult.crawlStats.maxPages}
                    </div>
                    <div>
                      <strong>Errors:</strong> {auditResult.crawlStats.errorsCount}
                    </div>
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <strong>Starting URL:</strong> {auditResult.startURL}
                  </div>
                  <div style={{ marginTop: '0.5rem' }}>
                    <strong>Crawl Date:</strong> {new Date(auditResult.timestamp).toLocaleString()}
                  </div>
                </div>

                {/* Pages List */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ marginBottom: '1rem' }}><i className="fas fa-list"></i> Crawled Pages ({auditResult.pages.length})</h3>
                  <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '8px', padding: '1rem' }}>
                    {auditResult.pages.map((page, index) => (
                      <div key={index} style={{ padding: '0.75rem', marginBottom: '0.5rem', background: '#f8f9fa', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '600' }}>Depth {page.depth}: {page.url}</div>
                          <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                            Issues: {page.issuesCount} | Score: {page.score} ({page.grade})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aggregate Issues */}
                {auditResult.aggregate.topIssues && auditResult.aggregate.topIssues.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem', color: '#e74c3c' }}>
                      <i className="fas fa-exclamation-triangle"></i> Top Issues Across All Pages ({auditResult.aggregate.totalIssues} total)
                    </h3>
                    {auditResult.aggregate.topIssues.slice(0, 10).map((issue, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '1rem',
                          marginBottom: '0.5rem',
                          borderRadius: '8px',
                          borderLeft: `4px solid ${getIssueColor(issue.type)}`,
                          background: '#f8f9fa'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                          <div style={{ flex: 1 }}>
                            <strong style={{ color: getIssueColor(issue.type) }}>
                              {issue.type.toUpperCase()}
                            </strong>
                            <p style={{ margin: '0.5rem 0', fontWeight: '600' }}>{issue.message}</p>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                              Category: {issue.category} | Impact: {issue.impact}
                            </p>
                            {issue.url && (
                              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#999' }}>
                                <i className="fas fa-link"></i> {issue.url}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Aggregate Recommendations */}
                {auditResult.aggregate.recommendations && auditResult.aggregate.recommendations.length > 0 && (
                  <div>
                    <h3 style={{ marginBottom: '1rem', color: '#2ecc71' }}>
                      <i className="fas fa-lightbulb"></i> Recommendations ({auditResult.aggregate.recommendations.length})
                    </h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {auditResult.aggregate.recommendations.map((rec, index) => (
                        <li
                          key={index}
                          style={{
                            padding: '1rem',
                            marginBottom: '0.5rem',
                            borderRadius: '8px',
                            background: '#e8f5e9',
                            borderLeft: '4px solid #2ecc71'
                          }}
                        >
                          <i className="fas fa-check-circle" style={{ color: '#2ecc71', marginRight: '0.5rem' }}></i>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Errors if any */}
                {auditResult.errors && auditResult.errors.length > 0 && (
                  <div style={{ marginTop: '2rem', padding: '1rem', background: '#fff3cd', borderRadius: '8px' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Pages with Errors ({auditResult.errors.length})</h4>
                    {auditResult.errors.slice(0, 5).map((err, index) => (
                      <div key={index} style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                        <strong>{err.url}:</strong> {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Regular Single Page Results */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                  <h2><i className="fas fa-chart-bar"></i> SEO Audit Results</h2>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 'bold', color: getScoreColor(auditResult.audit.score) }}>
                      {auditResult.audit.score}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: getScoreColor(auditResult.audit.score) }}>
                      Grade {auditResult.audit.grade}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                  <p><strong>URL:</strong> {auditResult.url}</p>
                  <p><strong>Audit Date:</strong> {new Date(auditResult.timestamp).toLocaleString()}</p>
                </div>

                {/* Elements Summary */}
            <div className="overview-cards" style={{ marginBottom: '2rem' }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Title</span>
                  <div className="card-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>
                    <i className="fas fa-heading"></i>
                  </div>
                </div>
                <div className="card-value" style={{ fontSize: '1rem', wordBreak: 'break-word' }}>
                  {auditResult.elements.title || 'Missing'}
                </div>
                <div className="card-change">
                  {auditResult.elements.title ? `${auditResult.elements.title.length} characters` : 'Not found'}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Meta Description</span>
                  <div className="card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
                    <i className="fas fa-align-left"></i>
                  </div>
                </div>
                <div className="card-value" style={{ fontSize: '1rem', wordBreak: 'break-word' }}>
                  {auditResult.elements.metaDescription || 'Missing'}
                </div>
                <div className="card-change">
                  {auditResult.elements.metaDescription ? `${auditResult.elements.metaDescription.length} characters` : 'Not found'}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Headings</span>
                  <div className="card-icon" style={{ background: '#f3e5f5', color: '#9c27b0' }}>
                    <i className="fas fa-list"></i>
                  </div>
                </div>
                <div className="card-value">
                  H1: {auditResult.elements.h1Count} | H2: {auditResult.elements.h2Count}
                </div>
                <div className="card-change">
                  {auditResult.elements.h1Tags.length > 0 && auditResult.elements.h1Tags[0]}
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <span className="card-title">Content</span>
                  <div className="card-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
                    <i className="fas fa-file-alt"></i>
                  </div>
                </div>
                <div className="card-value">{auditResult.elements.wordCount}</div>
                <div className="card-change">words</div>
              </div>
            </div>

            {/* Issues */}
            {auditResult.audit.issues.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', color: '#e74c3c' }}>
                  <i className="fas fa-exclamation-triangle"></i> Issues Found ({auditResult.audit.issuesCount})
                </h3>
                {auditResult.audit.issues.map((issue, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '1rem',
                      marginBottom: '0.5rem',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${getIssueColor(issue.type)}`,
                      background: '#f8f9fa'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div>
                        <strong style={{ color: getIssueColor(issue.type) }}>
                          {issue.type.toUpperCase()}
                        </strong>
                        <p style={{ margin: '0.5rem 0', fontWeight: '600' }}>{issue.message}</p>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>
                          Category: {issue.category} | Impact: {issue.impact}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations */}
            {auditResult.audit.recommendations.length > 0 && (
              <div>
                <h3 style={{ marginBottom: '1rem', color: '#2ecc71' }}>
                  <i className="fas fa-lightbulb"></i> Recommendations ({auditResult.audit.recommendationsCount})
                </h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {auditResult.audit.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      style={{
                        padding: '1rem',
                        marginBottom: '0.5rem',
                        borderRadius: '8px',
                        background: '#e8f5e9',
                        borderLeft: '4px solid #2ecc71'
                      }}
                    >
                      <i className="fas fa-check-circle" style={{ color: '#2ecc71', marginRight: '0.5rem' }}></i>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detailed Elements */}
            <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '10px' }}>
              <h3 style={{ marginBottom: '1rem' }}>Detailed Analysis</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <strong>Images:</strong> {auditResult.elements.imageCount}
                  {auditResult.elements.imagesWithoutAlt > 0 && (
                    <span style={{ color: '#e74c3c' }}> ({auditResult.elements.imagesWithoutAlt} without alt)</span>
                  )}
                </div>
                <div>
                  <strong>Links:</strong> {auditResult.elements.linkCount}
                </div>
                <div>
                  <strong>Open Graph:</strong> {auditResult.elements.hasOpenGraph ? '✓ Yes' : '✗ No'}
                </div>
                <div>
                  <strong>Twitter Card:</strong> {auditResult.elements.hasTwitterCard ? '✓ Yes' : '✗ No'}
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SEOAudit;

