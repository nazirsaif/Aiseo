import React, { useEffect, useState } from 'react';
import notification from '../utils/notification';

const CompetitorAnalysis = ({ authToken, API_BASE_URL }) => {
  const [ownUrl, setOwnUrl] = useState('');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState(null);


  const runComparison = async () => {
    if (!ownUrl.trim() || !competitorUrl.trim()) {
      notification.warning('Please enter both your website URL and a competitor URL');
      return;
    }

    setIsComparing(true);
    setComparisonResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/competitor/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          ownUrl: ownUrl.trim(),
          competitorUrl: competitorUrl.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        notification.error(data.message || 'Comparison failed');
        return;
      }

      setComparisonResult(data);
      notification.success('Keyword analysis complete!');
    } catch (err) {
      console.error('Comparison error:', err);
      const msg = err.response?.data?.message || err.message || 'Server connection failed.';
      notification.error(msg);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <div className="page-section active">
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Competitor Analysis
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Head-to-head neural comparison with real-time algorithmic insights.</p>
      </div>

      {/* Comparison Input Bar */}
      <div className="card" style={{ marginBottom: '3rem', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Target URL</label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-link" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }}></i>
              <input 
                type="text" 
                placeholder="https://yourwebsite.com" 
                value={ownUrl}
                onChange={(e) => setOwnUrl(e.target.value)}
                style={{ width: '100%', padding: '1rem 1rem 1rem 3rem' }}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Competitor URL</label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-shield-alt" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--secondary)' }}></i>
              <input 
                type="text" 
                placeholder="https://competitor.com" 
                value={competitorUrl}
                onChange={(e) => setCompetitorUrl(e.target.value)}
                style={{ width: '100%', padding: '1rem 1rem 1rem 3rem' }}
              />
            </div>
          </div>
          <button 
            className="btn-primary" 
            onClick={runComparison}
            disabled={isComparing}
            style={{ alignSelf: 'flex-end', padding: '1rem 2.5rem', height: '54px' }}
          >
            {isComparing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-brain"></i>} 
            {isComparing ? ' Analyzing...' : ' Start Research'}
          </button>
        </div>
      </div>

      {comparisonResult && (
        <div className="analysis-results">
          
          {/* Head to Head Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
            <div className="card" style={{ borderLeft: '4px solid var(--primary)', background: 'rgba(99, 102, 241, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ color: 'var(--primary)', fontWeight: '700' }}>YOUR PAGE</h4>
                <span style={{ fontSize: '2.5rem', fontWeight: '800' }}>{comparisonResult.own.score}%</span>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}><i className="fas fa-align-left" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i> {comparisonResult.own.elements.wordCount} Words</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}><i className="fas fa-heading" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i> {comparisonResult.own.elements.h1Count} H1</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}><i className="fas fa-image" style={{ color: 'var(--primary)', marginRight: '0.5rem' }}></i> {comparisonResult.own.elements.imageCount} Media</div>
              </div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid var(--secondary)', background: 'rgba(6, 182, 212, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ color: 'var(--secondary)', fontWeight: '700' }}>COMPETITOR</h4>
                <span style={{ fontSize: '2.5rem', fontWeight: '800' }}>{comparisonResult.competitor.score}%</span>
              </div>
              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1.5rem' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}><i className="fas fa-align-left" style={{ color: 'var(--secondary)', marginRight: '0.5rem' }}></i> {comparisonResult.competitor.elements.wordCount} Words</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}><i className="fas fa-heading" style={{ color: 'var(--secondary)', marginRight: '0.5rem' }}></i> {comparisonResult.competitor.elements.h1Count} H1</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}><i className="fas fa-image" style={{ color: 'var(--secondary)', marginRight: '0.5rem' }}></i> {comparisonResult.competitor.elements.imageCount} Media</div>
              </div>
            </div>
          </div>

          {/* Ranking Insights */}
          <div className="card" style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem' }}>
            <h3 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', fontSize: '1.5rem' }}>
              <i className="fas fa-bolt" style={{ color: '#fbc02d', marginRight: '0.8rem' }}></i>
              Neural Comparison Insights
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1rem' }}>
              {comparisonResult.analysis.reasons_why_above.map((reason, idx) => {
                const isPositive = reason.toLowerCase().includes('leadership') || reason.toLowerCase().includes('advantage') || reason.toLowerCase().includes('edge');
                const isNeutral = reason.toLowerCase().includes('parity');
                return (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    gap: '1rem', 
                    alignItems: 'flex-start', 
                    padding: '1.25rem', 
                    background: 'rgba(15, 23, 42, 0.4)', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255,255,255,0.05)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}>
                    <i className={`fas ${isPositive ? 'fa-check-circle' : (isNeutral ? 'fa-info-circle' : 'fa-triangle-exclamation')}`} 
                       style={{ marginTop: '0.2rem', color: isPositive ? '#10b981' : (isNeutral ? '#06b6d4' : '#f43f5e') }}></i>
                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', color: 'var(--text-main)' }}>{reason}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!comparisonResult && !isComparing && (
        <div style={{ textAlign: 'center', padding: '8rem 0', opacity: 0.3 }}>
          <i className="fas fa-project-diagram" style={{ fontSize: '5rem', marginBottom: '2rem', background: 'linear-gradient(var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}></i>
          <h3 style={{ fontSize: '1.8rem' }}>Neural Research Lab</h3>
          <p style={{ fontSize: '1.1rem' }}>Initiate a head-to-head analysis to unlock competitive intelligence.</p>
        </div>
      )}
    </div>
  );
};

export default CompetitorAnalysis;
