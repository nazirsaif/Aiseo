import React, { useEffect, useState } from 'react';

const Dashboard = ({ authToken, API_BASE_URL }) => {
  const [keywordInput, setKeywordInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('keyword');
  const [overview, setOverview] = useState(null);
  const [keywords, setKeywords] = useState([]);
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

        const [overviewRes, keywordsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/dashboard/overview`, {
            headers: { Authorization: `Bearer ${authToken}` }
          }),
          fetch(`${API_BASE_URL}/api/dashboard/keywords`, {
            headers: { Authorization: `Bearer ${authToken}` }
          })
        ]);

        const overviewData = await overviewRes.json();
        const keywordsData = await keywordsRes.json();

        if (overviewRes.ok) {
          setOverview(overviewData);
        }
        if (keywordsRes.ok && Array.isArray(keywordsData.keywords)) {
          setKeywords(keywordsData.keywords);
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
        alert(errorMsg);
        setResearchResult(null);
        return;
      }

      // Ensure we have valid data structure
      if (data && (data.suggestions || data.competitors)) {
        setResearchResult(data);
      } else {
        console.error('Invalid keyword research response:', data);
        alert('Received invalid data from keyword research API');
        setResearchResult(null);
      }
    } catch (err) {
      console.error('Keyword research failed', err);
      alert('Failed to connect to keyword research API. Please check your connection.');
      setResearchResult(null);
    } finally {
      setIsResearchLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!keywordInput.trim()) {
      alert('Please enter a keyword or URL');
      return;
    }

    if (!authToken) {
      alert('Please log in first to save your analysis.');
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
        alert(data.message || 'Failed to save analysis input');
        return;
      }

      alert('Analysis input saved to database!');
      const inputValue = keywordInput.trim();
      setKeywordInput('');

      // Trigger keyword research based on the same input
      if (inputValue) {
        await runKeywordResearch(inputValue);
      }
    } catch (err) {
      console.error(err);
      setIsLoading(false);
      alert('Unable to connect to server. Is the backend running?');
    }
  };

  const downloadReport = () => {
    alert('Generating SEO report... Download will start shortly.');
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
            className={`tab ${activeTab === 'keyword' ? 'active' : ''}`}
            onClick={() => setActiveTab('keyword')}
          >
            <i className="fas fa-key"></i> Keyword Analysis
          </div>
          <div
            className={`tab ${activeTab === 'content' ? 'active' : ''}`}
            onClick={() => setActiveTab('content')}
          >
            <i className="fas fa-file-alt"></i> Content Gaps
          </div>
          <div
            className={`tab ${activeTab === 'suggestions' ? 'active' : ''}`}
            onClick={() => setActiveTab('suggestions')}
          >
            <i className="fas fa-lightbulb"></i> AI Suggestions
          </div>
          <div
            className={`tab ${activeTab === 'keyword-research' ? 'active' : ''}`}
            onClick={() => setActiveTab('keyword-research')}
          >
            <i className="fas fa-search-plus"></i> Keyword Research
          </div>
        </div>

        {/* Keyword Analysis Tab */}
        {activeTab === 'keyword' && (
          <div className="tab-content active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Top Performing Keywords</h3>
              <button className="btn btn-secondary" onClick={downloadReport}>
                <i className="fas fa-download"></i>
                Download Report
              </button>
            </div>
            
            <table className="keyword-table">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Search Volume</th>
                  <th>Difficulty</th>
                  <th>Performance</th>
                  <th>Opportunity</th>
                </tr>
              </thead>
              <tbody>
                {keywords.length > 0 ? (
                  keywords.map((row) => (
                    <tr key={row.id}>
                      <td>{row.keyword}</td>
                      <td>{row.searchVolume.toLocaleString()}</td>
                      <td>{row.difficulty}</td>
                      <td>
                        <span
                          className={`performance-badge ${
                            row.performance === 'Strong'
                              ? 'badge-strong'
                              : row.performance === 'Medium'
                              ? 'badge-medium'
                              : 'badge-weak'
                          }`}
                        >
                          {row.performance}
                        </span>
                      </td>
                      <td>{row.opportunity}</td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr>
                      <td>digital marketing strategy</td>
                      <td>12,400</td>
                      <td>Medium</td>
                      <td><span className="performance-badge badge-strong">Strong</span></td>
                      <td>High</td>
                    </tr>
                    <tr>
                      <td>SEO optimization tips</td>
                      <td>8,900</td>
                      <td>Low</td>
                      <td><span className="performance-badge badge-strong">Strong</span></td>
                      <td>Medium</td>
                    </tr>
                    <tr>
                      <td>content marketing tools</td>
                      <td>6,700</td>
                      <td>High</td>
                      <td><span className="performance-badge badge-medium">Medium</span></td>
                      <td>High</td>
                    </tr>
                    <tr>
                      <td>social media analytics</td>
                      <td>5,200</td>
                      <td>Medium</td>
                      <td><span className="performance-badge badge-weak">Weak</span></td>
                      <td>Very High</td>
                    </tr>
                    <tr>
                      <td>email marketing campaign</td>
                      <td>4,800</td>
                      <td>Low</td>
                      <td><span className="performance-badge badge-medium">Medium</span></td>
                      <td>Medium</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>

            <div className="chart-container">
              <h4>Keyword Performance Trend</h4>
              <p style={{ color: '#666', marginTop: '1rem' }}>Chart visualization would be integrated here using Chart.js or Recharts</p>
            </div>
          </div>
        )}

        {/* Content Gaps Tab */}
        {activeTab === 'content' && (
          <div className="tab-content active">
            <h3>Identified Content Gaps</h3>
            <div style={{ marginTop: '2rem' }}>
              <div className="card" style={{ marginBottom: '1rem' }}>
                <h4 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
                  <i className="fas fa-circle" style={{ fontSize: '0.5rem', marginRight: '0.5rem' }}></i>
                  Missing Topic: "AI in Digital Marketing"
                </h4>
                <p style={{ color: '#666', marginBottom: '1rem' }}>Your competitors are ranking for this high-volume topic. Potential traffic: 15,000/month</p>
                <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                  <i className="fas fa-plus"></i> Create Content Brief
                </button>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <h4 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
                  <i className="fas fa-circle" style={{ fontSize: '0.5rem', marginRight: '0.5rem' }}></i>
                  Outdated Content: "SEO Best Practices 2023"
                </h4>
                <p style={{ color: '#666', marginBottom: '1rem' }}>This article needs updating with current trends. Last modified: 18 months ago</p>
                <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                  <i className="fas fa-edit"></i> Update Content
                </button>
              </div>

              <div className="card">
                <h4 style={{ color: '#667eea', marginBottom: '0.5rem' }}>
                  <i className="fas fa-circle" style={{ fontSize: '0.5rem', marginRight: '0.5rem' }}></i>
                  Low Keyword Coverage: "Mobile SEO"
                </h4>
                <p style={{ color: '#666', marginBottom: '1rem' }}>Only 3 related keywords covered. Competitors average 12 keywords per topic</p>
                <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                  <i className="fas fa-expand"></i> Expand Coverage
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Suggestions Tab */}
        {activeTab === 'suggestions' && (
          <div className="tab-content active">
            <h3>AI-Powered Recommendations</h3>
            <div style={{ marginTop: '2rem' }}>
              <div style={{ background: '#e8f5e9', padding: '1.5rem', borderRadius: '10px', marginBottom: '1rem', borderLeft: '4px solid #4caf50' }}>
                <h4 style={{ color: '#2e7d32', marginBottom: '1rem' }}>
                  <i className="fas fa-check-circle"></i> High Priority
                </h4>
                <p style={{ color: '#333', marginBottom: '0.5rem' }}><strong>Optimize meta descriptions</strong></p>
                <p style={{ color: '#666' }}>12 pages have missing or duplicate meta descriptions. This could improve CTR by 15-20%</p>
              </div>

              <div style={{ background: '#fff3e0', padding: '1.5rem', borderRadius: '10px', marginBottom: '1rem', borderLeft: '4px solid #ff9800' }}>
                <h4 style={{ color: '#e65100', marginBottom: '1rem' }}>
                  <i className="fas fa-exclamation-circle"></i> Medium Priority
                </h4>
                <p style={{ color: '#333', marginBottom: '0.5rem' }}><strong>Improve internal linking</strong></p>
                <p style={{ color: '#666' }}>Your cornerstone content has low internal link count. Add 5-8 strategic internal links</p>
              </div>

              <div style={{ background: '#e3f2fd', padding: '1.5rem', borderRadius: '10px', borderLeft: '4px solid #2196f3' }}>
                <h4 style={{ color: '#1565c0', marginBottom: '1rem' }}>
                  <i className="fas fa-info-circle"></i> Opportunity
                </h4>
                <p style={{ color: '#333', marginBottom: '0.5rem' }}><strong>Target long-tail keywords</strong></p>
                <p style={{ color: '#666' }}>Found 23 low-competition long-tail opportunities with combined potential of 5,000 monthly visits</p>
              </div>
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
                <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>Filters</h4>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Difficulty</label>
                      <select
                        value={keywordFilters.difficulty}
                        onChange={(e) =>
                          setKeywordFilters({ ...keywordFilters, difficulty: e.target.value })
                        }
                      >
                        <option value="all">All</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        Min Relevance
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={keywordFilters.minRelevance}
                        onChange={(e) =>
                          setKeywordFilters({
                            ...keywordFilters,
                            minRelevance: Number(e.target.value) || 0
                          })
                        }
                        style={{ width: '80px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                        Min Volume
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={keywordFilters.minVolume}
                        onChange={(e) =>
                          setKeywordFilters({
                            ...keywordFilters,
                            minVolume: Number(e.target.value) || 0
                          })
                        }
                        style={{ width: '100px' }}
                      />
                    </div>
                  </div>
                </div>

                <h4>Suggested Long-tail Keywords</h4>
                {researchResult.suggestions && researchResult.suggestions.length > 0 ? (
                  <table className="keyword-table">
                    <thead>
                      <tr>
                        <th>Keyword</th>
                        <th>Relevance</th>
                        <th>Est. Volume</th>
                        <th>Difficulty</th>
                        <th>Competitors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {researchResult.suggestions
                        .filter((s) => {
                          if (keywordFilters.difficulty !== 'all' && s.estimatedDifficulty !== keywordFilters.difficulty) {
                            return false;
                          }
                          if (s.relevanceScore < keywordFilters.minRelevance) return false;
                          if (s.estimatedSearchVolume < keywordFilters.minVolume) return false;
                          return true;
                        })
                        .map((s) => (
                          <tr key={s.keyword}>
                            <td>{s.keyword}</td>
                            <td>{s.relevanceScore}</td>
                            <td>{s.estimatedSearchVolume}</td>
                            <td>{s.estimatedDifficulty}</td>
                            <td>{s.competitorCount}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: '#666', marginTop: '1rem' }}>No keyword suggestions generated yet.</p>
                )}

                {researchResult.competitors && researchResult.competitors.length > 0 && (
                  <>
                    <h4 style={{ marginTop: '2rem' }}>Competitor Overview</h4>
                    <table className="keyword-table">
                      <thead>
                        <tr>
                          <th>URL</th>
                          <th>Title</th>
                          <th>Word Count</th>
                          <th>Keyword Density %</th>
                          <th>Score / Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {researchResult.competitors.map((c) => (
                          <tr key={c.url}>
                            <td>{c.url}</td>
                            <td>{c.title}</td>
                            <td>{c.wordCount}</td>
                            <td>{c.keywordDensity}</td>
                            <td>
                              {c.score} ({c.grade})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
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

