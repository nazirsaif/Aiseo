import React, { useState } from 'react';
import axios from 'axios';
import notification from '../utils/notification';

const ContentGap = ({ authToken, API_BASE_URL }) => {
  const [ownUrl, setOwnUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);

  const runAnalysis = async () => {
    if (!ownUrl.trim() || !competitorUrl.trim()) {
      notification.warning('Please enter both URLs');
      return;
    }

    setIsAnalyzing(true);
    setResults(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/competitor/compare`, {
        ownUrl: ownUrl.trim(),
        competitorUrl: competitorUrl.trim()
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.data && response.data.success) {
        setResults(response.data.analysis);
        notification.success('Deep Content Gap analysis complete');
      } else {
        notification.error('Analysis failed to return valid data');
      }
    } catch (err) {
      console.error('Content Gap Error:', err);
      const msg = err.response?.data?.message || 'Analysis failed. Academic sites may be blocking the crawler.';
      notification.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="page-section active">
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AI Content Gap
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Our RAG engine identifies high-value topics your competitor covers but you are missing.</p>
      </div>

      <div className="card" style={{ marginBottom: '3rem', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your URL</label>
            <input 
              type="text" 
              placeholder="https://yourwebsite.com/page" 
              value={ownUrl}
              onChange={(e) => setOwnUrl(e.target.value)}
              style={{ width: '100%', padding: '1rem', background: 'rgba(15, 23, 42, 0.5)' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Competitor URL</label>
            <input 
              type="text" 
              placeholder="https://competitor.com/ranking-page" 
              value={competitorUrl}
              onChange={(e) => setCompetitorUrl(e.target.value)}
              style={{ width: '100%', padding: '1rem', background: 'rgba(15, 23, 42, 0.5)' }}
            />
          </div>
          <button 
            className="btn-primary" 
            onClick={runAnalysis}
            disabled={isAnalyzing}
            style={{ alignSelf: 'flex-end', padding: '1rem 2.5rem', height: '54px' }}
          >
            {isAnalyzing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-microchip"></i>}
            {isAnalyzing ? ' Calculating...' : ' Discover Gaps'}
          </button>
        </div>
      </div>

      {results && (
        <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '2rem' }}>
          
          {/* Missing Keywords Column */}
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.3)' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
              <i className="fas fa-cubes" style={{ color: 'var(--primary)' }}></i>
              Topical Clusters
            </h3>
            
            {results.content_gap?.clusters && Object.entries(results.content_gap.clusters).map(([name, keywords]) => (
              keywords.length > 0 && (
                <div key={name} style={{ marginBottom: '2rem' }}>
                  <h4 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: name === 'Strategic' ? '#f59e0b' : (name === 'Informational' ? '#3b82f6' : '#10b981') }}></div>
                    {name} Opportunities
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                    {keywords.map((kw, i) => (
                      <span key={i} style={{ 
                        background: 'rgba(255,255,255,0.03)', 
                        color: 'var(--text-main)',
                        padding: '0.5rem 1rem', 
                        borderRadius: '12px', 
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>

          {/* Replacement Suggestions Column */}
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.3)' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
              <i className="fas fa-map-marked-alt" style={{ color: 'var(--secondary)' }}></i>
              AI Strategy Roadmap
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {results.content_gap?.suggestions?.map((s, idx) => (
                <div key={idx} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <span style={{ textDecoration: 'line-through', color: 'rgba(244, 63, 94, 0.6)', fontSize: '0.85rem', fontWeight: '500' }}>{s.instead_of}</span>
                    <i className="fas fa-arrow-right" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
                    <span style={{ color: '#10b981', fontWeight: '700', fontSize: '1.1rem' }}>{s.use}</span>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6' }}>{s.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!results && !isAnalyzing && (
        <div style={{ textAlign: 'center', padding: '8rem 0', opacity: 0.3 }}>
          <i className="fas fa-fingerprint" style={{ fontSize: '5rem', marginBottom: '2rem', background: 'linear-gradient(var(--secondary), var(--primary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}></i>
          <h3 style={{ fontSize: '1.8rem' }}>Topic Extraction Active</h3>
          <p style={{ fontSize: '1.1rem' }}>The RAG engine is ready to analyze your competitor's topical authority.</p>
        </div>
      )}
    </div>
  );
};

export default ContentGap;
