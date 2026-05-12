import React, { useState } from 'react';
import notification from '../utils/notification';

const SEOAudit = ({ authToken, API_BASE_URL }) => {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [auditResult, setAuditResult] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [deepCrawl, setDeepCrawl] = useState(false);
  const [maxDepth, setMaxDepth] = useState(2);
  const [maxPages, setMaxPages] = useState(5);

  const performAudit = async () => {
    if (!url.trim()) {
      notification.warning('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setAuditResult(null);

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
        notification.error(data.message || 'Audit failed');
        setIsLoading(false);
        return;
      }

      setAuditResult(data.result);
      notification.success('Deep SEO Audit Complete');
      setIsLoading(false);
    } catch (err) {
      console.error('Audit error:', err);
      notification.error('Server connection failed');
      setIsLoading(false);
    }
  };

  const loadAuditHistory = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/seo-audit`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await response.json();
      if (response.ok) {
        setAuditHistory(data.audits || []);
      }
    } catch (err) {
      console.error('History load failed', err);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return 'var(--accent)';
    if (score >= 70) return 'var(--primary)';
    return '#f43f5e';
  };

  // --- Normalized Data Accessors ---
  const isDeep = auditResult?.crawlStats || auditResult?.aggregate;
  const displayScore = auditResult?.audit?.score || auditResult?.score || auditResult?.aggregate?.averageScore || 0;
  const displayGrade = auditResult?.audit?.grade || auditResult?.grade || auditResult?.aggregate?.grade || 'F';
  const displayElements = auditResult?.elements || auditResult?.detailedPages?.[0]?.elements || {};
  const displayIssues = auditResult?.audit?.issues || auditResult?.aggregate?.topIssues || [];
  const displayRecs = auditResult?.ollama?.llmRecommendations || "";
  const displayPrediction = auditResult?.audit?.ml_prediction;

  const getImpactColor = (impact) => {
    if (impact === 'High') return '#f43f5e'; // Rose
    if (impact === 'Medium') return '#f59e0b'; // Amber
    return 'var(--primary)'; // Indigo/Blue for Low
  };

  return (
    <div className="page-section active">
      <div style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            SEO Audit
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Deep spectral analysis of technical SEO, crawlability, and semantic health.</p>
        </div>
        <button 
          onClick={() => { setShowHistory(!showHistory); loadAuditHistory(); }}
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.6rem 1.2rem', borderRadius: '12px', cursor: 'pointer', fontSize: '0.9rem' }}
        >
          <i className="fas fa-history" style={{ marginRight: '0.5rem' }}></i>
          {showHistory ? 'Hide History' : 'View History'}
        </button>
      </div>

      <div className="card" style={{ marginBottom: '3rem', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div style={{ flex: 2, minWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Target URL</label>
            <input 
              type="text" 
              placeholder="https://yourwebsite.com" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ width: '100%', padding: '1rem', background: 'rgba(15, 23, 42, 0.5)' }}
            />
          </div>
          <button 
            className="btn-primary" 
            onClick={performAudit}
            disabled={isLoading}
            style={{ alignSelf: 'flex-end', padding: '1rem 2.5rem', height: '54px' }}
          >
            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-radar"></i>}
            {isLoading ? ' Analyzing...' : ' Initiate Audit'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={deepCrawl} onChange={(e) => setDeepCrawl(e.target.checked)} style={{ width: '20px', height: '20px' }} />
            <span style={{ fontWeight: '600', color: deepCrawl ? 'var(--primary)' : 'var(--text-muted)' }}>Recursive Deep Crawl</span>
          </label>
          {deepCrawl && (
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Depth:</span> <strong style={{ color: 'var(--primary)' }}>{maxDepth}</strong>
                <input type="range" min="1" max="4" value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} style={{ marginLeft: '10px' }} />
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Max Pages:</span> <strong style={{ color: 'var(--primary)' }}>{maxPages}</strong>
                <input type="range" min="2" max="20" value={maxPages} onChange={(e) => setMaxPages(e.target.value)} style={{ marginLeft: '10px' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {auditResult && (
        <div className="audit-results animate-in">
          <div className="overview-cards" style={{ marginBottom: '2rem' }}>
            <div className="card" style={{ textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)' }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '0.1em' }}>
                {isDeep ? 'Aggregate Health Score' : 'Neural Health Score'}
              </div>
              <div style={{ fontSize: '3.5rem', fontWeight: '900', color: getScoreColor(displayScore) }}>
                {displayScore}
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: '700', marginTop: '0.5rem', opacity: 0.8 }}>GRADE {displayGrade}</div>
              {isDeep && (
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.5rem', fontWeight: '700' }}>
                  <i className="fas fa-spider"></i> {auditResult.crawlStats?.pagesCrawled} PAGES CRAWLED
                </div>
              )}
            </div>

            <div className="card" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '1rem', letterSpacing: '0.1em' }}>
                {isDeep ? 'Primary Page Structure' : 'Structure & Content'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ color: 'var(--primary)', fontWeight: '800', fontSize: '1.5rem' }}>{displayElements.h1Count || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>H1 Tags</div>
                </div>
                <div>
                  <div style={{ color: 'var(--secondary)', fontWeight: '800', fontSize: '1.5rem' }}>{displayElements.wordCount || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Word Count</div>
                </div>
                <div>
                  <div style={{ color: 'var(--accent)', fontWeight: '800', fontSize: '1.5rem' }}>{displayElements.imageCount || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Images</div>
                </div>
                <div>
                  <div style={{ color: '#f59e0b', fontWeight: '800', fontSize: '1.5rem' }}>{displayElements.linkCount || 0}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Links</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ border: '2px solid rgba(99, 102, 241, 0.3)', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(15, 23, 42, 0.4))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: '700' }}>AI Model Prediction</div>
                {(auditResult.audit?.projected_score || auditResult.projected_score) && (
                  <div style={{ background: 'var(--accent)', color: '#000', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '900' }}>
                    PROJECTED: {auditResult.audit?.projected_score || auditResult.projected_score}
                  </div>
                )}
              </div>
              
              {displayPrediction !== undefined ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <i className={`fas ${displayPrediction === 1 ? 'fa-circle-check' : 'fa-circle-xmark'}`} style={{ fontSize: '2rem', color: displayPrediction === 1 ? 'var(--accent)' : '#f43f5e' }}></i>
                    <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>
                      {displayPrediction === 1 ? 'Positive Outlook' : 'Underperformance Risk'}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    Based on neural spectral weights, after implementing the roadmap, your health score is projected to reach 
                    <strong style={{ color: 'var(--accent)', marginLeft: '4px' }}>{auditResult.audit?.projected_score || auditResult.projected_score}</strong>. 
                    This indicates a high probability of search ranking improvement.
                  </p>
                </div>
              ) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Model processing skipped.</div>}
            </div>
          </div>

          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ marginBottom: '2rem', fontSize: '1.5rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <i className="fas fa-bolt-lightning" style={{ color: '#f59e0b' }}></i>
              Prioritized Optimization Roadmap
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {displayIssues.length > 0 ? displayIssues.map((issue, idx) => (
                <div key={idx} style={{ 
                  padding: '1.5rem', 
                  background: 'rgba(255,255,255,0.02)', 
                  borderRadius: '20px', 
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderLeft: `6px solid ${getImpactColor(issue.impact)}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>{issue.category}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '900', color: getImpactColor(issue.impact) }}>{issue.impact} IMPACT</span>
                  </div>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', fontWeight: '700' }}>{issue.message}</h4>
                  {issue.url && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}><i className="fas fa-link"></i> {issue.url}</div>}
                  <div style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontSize: '0.9rem' }}>
                    <i className="fas fa-lightbulb" style={{ marginRight: '0.5rem' }}></i>
                    <strong>Action:</strong> {issue.recommendation || issue.solution || 'Optimize this element based on SEO best practices.'}
                  </div>
                </div>
              )) : <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No critical issues detected. Excellent work!</div>}
            </div>
          </div>

          {displayRecs && (
            <div className="card" style={{ marginTop: '2rem', background: 'linear-gradient(to bottom right, rgba(124, 58, 237, 0.1), transparent)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
              <h3 style={{ marginBottom: '1.5rem', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <i className="fas fa-brain"></i>
                AI Contextual Intelligence (LLaMA 3)
              </h3>
              <div style={{ color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.8', whiteSpace: 'pre-wrap', opacity: 0.9 }}>
                {displayRecs}
              </div>
            </div>
          )}
        </div>
      )}

      {showHistory && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '400px', height: '100vh', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(20px)', zIndex: 1000, padding: '2rem', borderLeft: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.5rem' }}>Audit History</h3>
            <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {auditHistory.map((audit, idx) => (
              <div key={idx} onClick={() => { setAuditResult(audit); setShowHistory(false); }} style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
                <div style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '0.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{audit.url}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                   {audit.isDeepCrawl && <span style={{ fontSize: '0.65rem', background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>DEEP</span>}
                   <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(audit.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '800', color: getScoreColor(audit.score) }}>Score: {audit.score}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent)' }}>Grade {audit.grade}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!auditResult && !isLoading && (
        <div style={{ textAlign: 'center', padding: '8rem 0', opacity: 0.3 }}>
          <i className="fas fa-shield-virus" style={{ fontSize: '5rem', marginBottom: '2rem', background: 'linear-gradient(var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}></i>
          <h3 style={{ fontSize: '1.8rem' }}>Health Check Ready</h3>
          <p style={{ fontSize: '1.1rem' }}>Enter a URL to perform a full spectral technical SEO audit.</p>
        </div>
      )}
    </div>
  );
};

export default SEOAudit;
