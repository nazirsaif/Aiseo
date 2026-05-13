import React, { useState } from 'react';
import axios from 'axios';
import notification from '../utils/notification';

const KeywordResearch = ({ authToken, API_BASE_URL }) => {
  const [keyword, setKeyword] = useState('');
  const [url, setUrl] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');

  const handleResearch = async () => {
    if (!keyword.trim()) {
      notification.warning('Please enter a keyword');
      return;
    }
    setIsSearching(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/api/keywords/research`, {
        baseKeyword: keyword.trim(),
        url: url.trim() || null,
        htmlContent: htmlContent.trim() || null
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (response.data && response.data.suggestions) {
        setResults(response.data.suggestions);
        notification.success('Semantic research complete');
      } else {
        notification.error('No keyword data returned');
      }
    } catch (err) {
      console.error('Research error:', err);
      notification.error('Failed to fetch research data');
    } finally {
      setIsSearching(false);
    }
  };

  const getDifficultyLabel = (difficulty) => {
    if (!difficulty) return 'Medium';
    const d = difficulty.toString().toLowerCase();
    if (d === 'easy' || d === 'low') return 'Easy';
    if (d === 'medium') return 'Medium';
    if (d === 'hard' || d === 'high') return 'Hard';
    return difficulty;
  };

  const getDifficultyClass = (difficulty) => {
    if (!difficulty) return 'status-med';
    const d = difficulty.toString().toLowerCase();
    if (d === 'easy' || d === 'low') return 'status-high'; // Green
    if (d === 'medium') return 'status-med'; // Cyan/Blue
    if (d === 'hard' || d === 'high') return 'status-low'; // Red
    return 'status-med';
  };

  return (
    <div className="page-section active">
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Semantic Keyword Research
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Discover high-relevance semantic clusters and competitive difficulty metrics.</p>
      </div>

      <div className="card" style={{ marginBottom: '3rem', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1.5, minWidth: '300px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase' }}>Focus Keyword</label>
            <div style={{ position: 'relative' }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)' }}></i>
              <input 
                type="text" 
                placeholder="Enter base keyword..." 
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{ width: '100%', padding: '1rem 1rem 1rem 3rem' }}
              />
            </div>
          </div>

          <button 
            className="btn-primary" 
            onClick={handleResearch}
            disabled={isSearching}
            style={{ alignSelf: 'flex-end', padding: '1rem 2.5rem', height: '54px' }}
          >
            {isSearching ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
            {isSearching ? ' Researching...' : ' Generate Insights'}
          </button>
        </div>




      </div>

      {results && results.length > 0 && (
        <div className="card" style={{ padding: '0', overflow: 'hidden', background: 'rgba(15, 23, 42, 0.4)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '1.25rem 2rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Keyword Phrase</th>
                <th style={{ padding: '1.25rem 2rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Search Intent</th>
                <th style={{ padding: '1.25rem 2rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Content Strategy</th>
                <th style={{ padding: '1.25rem 2rem', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Action Plan</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.3s' }} className="table-row-hover">
                  <td style={{ padding: '1.5rem 2rem', fontWeight: '600', color: 'var(--text-main)' }}>{res.keyword}</td>
                  <td style={{ padding: '1.5rem 2rem' }}>
                    <span style={{ 
                      textTransform: 'capitalize', 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '8px', 
                      fontSize: '0.75rem', 
                      fontWeight: '700',
                      background: res.intent === 'transactional' ? 'rgba(16, 185, 129, 0.1)' : (res.intent === 'commercial' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(6, 182, 212, 0.1)'),
                      color: res.intent === 'transactional' ? '#10b981' : (res.intent === 'commercial' ? '#6366f1' : '#06b6d4')
                    }}>
                      {res.intent}
                    </span>
                  </td>
                  <td style={{ padding: '1.5rem 2rem', fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                    {res.strategy}
                  </td>
                  <td style={{ padding: '1.5rem 2rem' }}>
                    <span style={{ 
                      padding: '0.4rem 0.8rem', 
                      borderRadius: '8px', 
                      fontSize: '0.75rem', 
                      fontWeight: '700',
                      background: res.actionPlan === 'Immediate Priority' ? 'rgba(244, 63, 94, 0.1)' : (res.actionPlan === 'High Priority' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)'),
                      color: res.actionPlan === 'Immediate Priority' ? '#f43f5e' : (res.actionPlan === 'High Priority' ? '#f59e0b' : '#10b981')
                    }}>
                      {res.actionPlan}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!results && !isSearching && (
        <div style={{ textAlign: 'center', padding: '8rem 0', opacity: 0.3 }}>
          <i className="fas fa-radar" style={{ fontSize: '5rem', marginBottom: '2rem', background: 'linear-gradient(var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}></i>
          <h3 style={{ fontSize: '1.8rem' }}>Semantic Scan Ready</h3>
          <p style={{ fontSize: '1.1rem' }}>Enter a keyword to map its semantic neighborhood and competition.</p>
        </div>
      )}
    </div>
  );
};

export default KeywordResearch;
