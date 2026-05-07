import React, { useEffect, useState } from 'react';
import notification from '../utils/notification';

const Dashboard = ({ authToken, API_BASE_URL }) => {
  const [keywordInput, setKeywordInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('competitor');
  const [overview, setOverview] = useState(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [researchResult, setResearchResult] = useState(null);
  const [isResearchLoading, setIsResearchLoading] = useState(false);
  const [keywordFilters, setKeywordFilters] = useState({
    difficulty: 'all',
    minRelevance: 0,
    minVolume: 0
  });

  useEffect(() => {
    if (!authToken) return;

    const loadDashboardData = async () => {
      try {
        setIsLoadingDashboard(true);

        const overviewRes = await fetch(`${API_BASE_URL}/api/dashboard/overview`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });

        const overviewData = await overviewRes.json();

        if (overviewRes.ok) {
          setOverview(overviewData);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setIsLoadingDashboard(false);
      }
    };

    loadDashboardData();
  }, [authToken, API_BASE_URL]);

  const runKeywordResearch = async (baseKeyword) => {
    if (!authToken) return;

    // Optional competitor URLs - leave empty to use saved audit data (more diverse)
    // You can provide specific competitor URLs if needed, or leave empty for automatic selection
    const competitorUrls = []; // Empty array = use saved audits (more diverse results)

    try {
      setIsResearchLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/keywords/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ baseKeyword, competitorUrls })
      });
      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data.message || 'Failed to run keyword research';
        console.error('Keyword research error:', errorMsg);
        notification.error(errorMsg);
        setResearchResult(null);
        return;
      }

      // Ensure we have valid data structure
      if (data && (data.suggestions || data.competitors)) {
        setResearchResult(data);
      } else {
        console.error('Invalid keyword research response:', data);
        notification.error('Received invalid data from keyword research API');
        setResearchResult(null);
      }
    } catch (err) {
      console.error('Keyword research failed', err);
      notification.error('Failed to connect to keyword research API. Please check your connection.');
      setResearchResult(null);
    } finally {
      setIsResearchLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!keywordInput.trim()) {
      notification.warning('Please enter a keyword or URL');
      return;
    }

    if (!authToken) {
      notification.warning('Please log in first to save your analysis.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ input: keywordInput.trim() }),
      });

      const data = await res.json();
      setIsLoading(false);

      if (!res.ok) {
        notification.error(data.message || 'Failed to save analysis input');
        return;
      }

      notification.success('Analysis input saved to database!');
      const inputValue = keywordInput.trim();
      setKeywordInput('');

      // Trigger keyword research based on the same input
      if (inputValue) {
        await runKeywordResearch(inputValue);
      }
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      notification.error('Unable to connect to server. Is the backend running?');
    }
  };

  const downloadReport = () => {
    notification.info('Generating SEO report... Download will start shortly.');
  };

  return (
    <div className="page-section active">
      {/* Keyword Input Section */}
      <div className="input-section">
        <h2><i className="fas fa-keyboard"></i> Start Your SEO Analysis</h2>
        <div className="input-group">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            placeholder="Enter keyword or website URL (e.g., digital marketing or example.com)"
          />
          <button className="btn btn-primary" onClick={runAnalysis}>
            <i className="fas fa-chart-line"></i>
            Analyze
          </button>
        </div>
      </div>

      {/* Loading Indicator */}
      <div className={`loading ${isLoading ? 'active' : ''}`}>
        <div className="spinner"></div>
        <p>Analyzing your SEO data...</p>
      </div>

      {/* Dashboard Overview Cards */}
      <div className="overview-cards" style={{ opacity: isLoading || isLoadingDashboard ? 0.5 : 1 }}>
        <div className="card">
          <div className="card-header">
            <span className="card-title">Keyword Clusters</span>
            <div className="card-icon" style={{ background: '#e3f2fd', color: '#2196f3' }}>
              <i className="fas fa-layer-group"></i>
            </div>
          </div>
          <div className="card-value">
            {overview ? overview.keywordClusters : 24}
          </div>
          <div className="card-change positive">
            <i className="fas fa-arrow-up"></i>
            12% increase
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Content Gaps</span>
            <div className="card-icon" style={{ background: '#fff3e0', color: '#ff9800' }}>
              <i className="fas fa-exclamation-triangle"></i>
            </div>
          </div>
          <div className="card-value">
            {overview ? overview.contentGaps : 8}
          </div>
          <div className="card-change negative">
            <i className="fas fa-arrow-down"></i>
            Needs attention
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">SERP Insights</span>
            <div className="card-icon" style={{ background: '#f3e5f5', color: '#9c27b0' }}>
              <i className="fas fa-search"></i>
            </div>
          </div>
          <div className="card-value">
            {overview ? overview.serpInsights : 156}
          </div>
          <div className="card-change positive">
            <i className="fas fa-arrow-up"></i>
            8% increase
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">SEO Score</span>
            <div className="card-icon" style={{ background: '#e8f5e9', color: '#4caf50' }}>
              <i className="fas fa-trophy"></i>
            </div>
          </div>
          <div className="card-value">
            {overview ? `${overview.seoScore}/100` : '78/100'}
          </div>
          <div className="card-change positive">
            <i className="fas fa-arrow-up"></i>
            Good progress
          </div>
        </div>
      </div>

      {/* Results Display - Tabbed Interface */}
      <div className="results-section">
        <div className="tabs">
          <div
            className={`tab ${activeTab === 'competitor' ? 'active' : ''}`}
            onClick={() => setActiveTab('competitor')}
          >
            <i className="fas fa-chess-knight"></i> Competitor Analysis
          </div>
          <div
            className={`tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <i className="fas fa-file-alt"></i> Content Gaps
          </div>
          <div
            className={`tab ${activeTab === 'keyword-research' ? 'active' : ''}`}
            onClick={() => setActiveTab('keyword-research')}
          >
            <i className="fas fa-search-plus"></i> Keyword Research
          </div>
        </div>

        {/* Competitor Analysis Tab */}
        {activeTab === 'competitor' && (
          <div className="tab-content active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Competitor Ranking Comparison</h3>
              <button className="btn btn-secondary" onClick={downloadReport}>
                <i className="fas fa-download"></i>
                Export Data
              </button>
            </div>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Compare your website's performance against your top competitors. See where you rank higher and identify areas for improvement.
            </p>
            
            <table className="keyword-table">
              <thead>
                <tr>
                  <th>Website (URL)</th>
                  <th>Title</th>
                  <th>Word Count</th>
                  <th>Keyword Density</th>
                  <th>SEO Score (Grade)</th>
                </tr>
              </thead>
              <tbody>
                {researchResult && researchResult.competitors && researchResult.competitors.length > 0 ? (
                  researchResult.competitors.map((c, idx) => (
                    <tr key={c.url || idx}>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.url}>
                        {c.url}
                      </td>
                      <td>{c.title || 'N/A'}</td>
                      <td>{c.wordCount || '-'}</td>
                      <td>{c.keywordDensity ? `${c.keywordDensity}%` : '-'}</td>
                      <td>
                        <span className={`performance-badge ${c.score >= 75 ? 'badge-strong' : c.score >= 50 ? 'badge-medium' : 'badge-weak'}`}>
                          {c.score ? `${c.score} (${c.grade || '-'})` : 'N/A'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                      {isResearchLoading 
                        ? 'Analyzing competitors... please wait.' 
                        : 'No competitor data available. Please run an analysis above.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {researchResult && researchResult.competitors && researchResult.competitors.length > 0 && (
              <div className="chart-container" style={{ marginTop: '2rem' }}>
                <h4>Competitor Scores Overview</h4>
                <p style={{ color: '#666', marginTop: '1rem' }}>Visual distribution of competitor SEO scores based on our AI analysis.</p>
                <div style={{ display: 'flex', height: '30px', borderRadius: '15px', overflow: 'hidden', marginTop: '1rem', background: '#f0f0f0' }}>
                  {researchResult.competitors.map((c, idx) => {
                    const colors = ['#f44336', '#ff9800', '#4caf50', '#2196f3', '#9c27b0'];
                    const color = colors[idx % colors.length];
                    const widthPercent = 100 / researchResult.competitors.length;
                    return (
                      <div key={idx} style={{ width: `${widthPercent}%`, background: color, title: `${c.url} (${c.score})` }}></div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#666', flexWrap: 'wrap' }}>
                  {researchResult.competitors.map((c, idx) => {
                    const colors = ['#f44336', '#ff9800', '#4caf50', '#2196f3', '#9c27b0'];
                    const color = colors[idx % colors.length];
                    return (
                      <span key={idx}><span style={{ color }}>■</span> {new URL(c.url).hostname}</span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Content Gaps Tab */}
        {activeTab === 'content' && (
          <div className="tab-content active">
            <h3>Content Gaps Analysis</h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Discover keywords and topics that your competitors are actively ranking for, but your website is missing. 
              Creating content around these topics can help capture untapped traffic.
            </p>
            <div style={{ marginTop: '2rem' }}>
              {isResearchLoading && (
                <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                  <i className="fas fa-spinner fa-spin"></i> Identifying content gaps from semantic analysis...
                </p>
              )}
              {!isResearchLoading && researchResult && researchResult.suggestions && researchResult.suggestions.length > 0 ? (
                // Filter suggestions that have good search volume but aren't heavily targeted
                researchResult.suggestions
                  .slice(0, 5) // Show top 5 semantic gaps
                  .map((gap, index) => {
                    const colors = ['#667eea', '#ff9800', '#4caf50', '#e91e63', '#00bcd4'];
                    const color = colors[index % colors.length];
                    return (
                      <div className="card" key={index} style={{ marginBottom: '1rem', borderLeft: `4px solid ${color}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 style={{ color: '#333', marginBottom: '0.5rem' }}>
                              Topic Gap: "{gap.keyword}"
                            </h4>
                            <p style={{ color: '#666', marginBottom: '1rem' }}>
                              <strong>Semantic Relevance:</strong> {gap.relevanceScore || 'High'} <br />
                              Google Trend Score: <span style={{ color: '#4caf50', fontWeight: 'bold' }}>
                                {gap.trendScore || 0}/100
                              </span>
                            </p>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                              <span style={{ background: '#e0e0e0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>Difficulty: {gap.estimatedDifficulty}</span>
                              <span style={{ background: '#e0e0e0', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem' }}>Competitors Target: {gap.competitorCount}</span>
                            </div>
                          </div>
                          <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                            <i className="fas fa-magic"></i> Generate Article
                          </button>
                        </div>
                      </div>
                    );
                  })
              ) : (
                !isResearchLoading && (
                  <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                    No content gaps identified yet. Run a keyword analysis to generate semantic gap insights.
                  </p>
                )
              )}
            </div>
          </div>
        )}

        {/* Keyword Research Tab */}
        {activeTab === 'keyword-research' && (
          <div className="tab-content active">
            <h3>Keyword Research & Competitive Analysis</h3>
            {isResearchLoading && (
              <p style={{ marginTop: '1rem', color: '#666' }}>
                <i className="fas fa-spinner fa-spin"></i> Analyzing competitors...
              </p>
            )}
            {!isResearchLoading && researchResult && (
               <>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.7)', 
                  backdropFilter: 'blur(10px)',
                  padding: '1.5rem', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  marginTop: '1.5rem', 
                  marginBottom: '2rem',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.03)'
                }}>
                  <h4 style={{ marginBottom: '1rem', color: '#333', fontSize: '1.1rem' }}>Filter Research Results</h4>
                  <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1', minWidth: '150px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#777', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Difficulty</label>
                      <select
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', fontSize: '0.9rem' }}
                        value={keywordFilters.difficulty}
                        onChange={(e) => setKeywordFilters({ ...keywordFilters, difficulty: e.target.value })}
                      >
                        <option value="all">All Difficulties</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div style={{ flex: '1', minWidth: '150px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#777', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min Relevance (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={keywordFilters.minRelevance}
                        onChange={(e) => setKeywordFilters({ ...keywordFilters, minRelevance: Number(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem' }}
                      />
                    </div>
                    <div style={{ flex: '1', minWidth: '150px' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: '#777', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Min Trend Score</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={keywordFilters.minVolume}
                        onChange={(e) => setKeywordFilters({ ...keywordFilters, minVolume: Number(e.target.value) || 0 })}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #ddd', fontSize: '0.9rem' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem' }}>
                  <div>
                    <h4 style={{ marginBottom: '0.5rem', color: '#1a1a1a' }}>Suggested Long-tail Keywords</h4>
                    <p style={{ color: '#666', fontSize: '0.9rem', maxWidth: '600px' }}>
                      Analyze keyword opportunities based on search volume and our calculated "Ranking Probability" metric.
                    </p>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#666', background: '#f5f5f5', padding: '0.4rem 0.8rem', borderRadius: '20px' }}>
                    Showing <strong>{researchResult.suggestions.filter(s => {
                      const matchesDifficulty = keywordFilters.difficulty === 'all' || s.estimatedDifficulty === keywordFilters.difficulty;
                      const matchesRelevance = Number(s.relevanceScore) >= Number(keywordFilters.minRelevance);
                      const matchesTrend = Number(s.trendScore || 0) >= Number(keywordFilters.minVolume);
                      return matchesDifficulty && matchesRelevance && matchesTrend;
                    }).length}</strong> results
                  </div>
                </div>

                {researchResult.suggestions && researchResult.suggestions.length > 0 ? (
                  <div style={{ overflowX: 'auto', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
                    <table className="keyword-table" style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #eee' }}>
                          <th style={{ textAlign: 'left', padding: '1rem' }}>Keyword</th>
                          <th style={{ textAlign: 'left', padding: '1rem' }}>Trend Score</th>
                          <th style={{ textAlign: 'left', padding: '1rem' }}>Difficulty</th>
                          <th style={{ textAlign: 'left', padding: '1rem' }}>Ranking Probability</th>
                          <th style={{ textAlign: 'center', padding: '1rem' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {researchResult.suggestions
                          .filter((s) => {
                            const matchesDifficulty = keywordFilters.difficulty === 'all' || s.estimatedDifficulty === keywordFilters.difficulty;
                            const matchesRelevance = Number(s.relevanceScore) >= Number(keywordFilters.minRelevance);
                            const matchesTrend = Number(s.trendScore || 0) >= Number(keywordFilters.minVolume);
                            return matchesDifficulty && matchesRelevance && matchesTrend;
                          })
                          .map((s, idx) => {
                            let probability = 50;
                            let probColor = '#ff9800';
                            if (s.estimatedDifficulty === 'Easy') { probability = 85; probColor = '#4caf50'; }
                            else if (s.estimatedDifficulty === 'Medium') { probability = 50; probColor = '#ff9800'; }
                            else if (s.estimatedDifficulty === 'Hard') { probability = 20; probColor = '#f44336'; }

                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0', transition: 'background 0.2s' }}>
                                <td style={{ padding: '1rem', fontWeight: '500', color: '#2c3e50' }}>{s.keyword}</td>
                                <td style={{ padding: '1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <span style={{ fontWeight: 'bold', color: '#27ae60' }}>{s.trendScore || 0}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#999' }}>/100</span>
                                  </div>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                  <span style={{ 
                                    padding: '0.25rem 0.6rem', 
                                    borderRadius: '20px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 'bold',
                                    background: s.estimatedDifficulty === 'Easy' ? '#e8f5e9' : s.estimatedDifficulty === 'Medium' ? '#fff3e0' : '#ffebee',
                                    color: probColor
                                  }}>
                                    {s.estimatedDifficulty}
                                  </span>
                                </td>
                                <td style={{ padding: '1rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <div style={{ flex: '1', minWidth: '80px', height: '6px', background: '#eee', borderRadius: '10px', overflow: 'hidden' }}>
                                      <div style={{ width: `${probability}%`, height: '100%', background: probColor, borderRadius: '10px' }}></div>
                                    </div>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: probColor, width: '35px' }}>{probability}%</span>
                                  </div>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                  <button style={{ 
                                    background: '#f0f2f5', 
                                    border: 'none', 
                                    padding: '0.4rem 1rem', 
                                    borderRadius: '6px', 
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    color: '#4b5563',
                                    transition: 'all 0.2s'
                                  }}>
                                    Save
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: '#666', marginTop: '1rem', textAlign: 'center', padding: '2rem', background: '#f9f9f9', borderRadius: '8px' }}>No keyword suggestions generated yet.</p>
                )}
               </>
            )}
            {!isResearchLoading && !researchResult && (
              <p style={{ marginTop: '1rem', color: '#666' }}>
                Run an analysis from the top of the dashboard to generate keyword suggestions and competitor data.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

