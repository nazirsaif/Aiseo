import React, { useState } from 'react';
import axios from 'axios';
import notification from '../utils/notification';

const ContentGeneration = ({ authToken, API_BASE_URL }) => {
  const [content, setContent] = useState('');
  const [targetKeyword, setTargetKeyword] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const handleGenerate = async () => {
    if (!content.trim()) {
      notification.warning('Please enter some content to optimize.');
      return;
    }
    if (!targetKeyword.trim()) {
      notification.warning('Please enter a target keyword.');
      return;
    }

    setIsGenerating(true);
    setResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/content/optimize`, {
        text: content,
        keyword: targetKeyword
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (response.data && response.data.optimizedText) {
        setResult(response.data);
        notification.success('Content optimized successfully!');
      } else {
        notification.error('Failed to optimize content.');
      }
    } catch (error) {
      console.error('Optimization error:', error);
      notification.error(error.response?.data?.message || 'An error occurred during content optimization.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="page-section active">
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          AI Content Generator
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Optimize your paragraphs with semantic keywords extracted via our RAG engine.</p>
        
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}><i className="fas fa-magic"></i> Algorithmic Keyword Weaving</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' }}>
            Our engine scans live competitor data for your target keyword to find strategic semantic gaps, and then weaves those high-value keywords seamlessly into your provided content.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Target Keyword
            </label>
            <input 
              type="text" 
              placeholder="e.g., Digital Marketing Strategies" 
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              style={{ width: '100%', padding: '1rem', background: 'rgba(15, 23, 42, 0.5)' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Your Content
            </label>
            <textarea 
              placeholder="Paste your paragraph or article section here..." 
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows="6"
              style={{ width: '100%', padding: '1rem', background: 'rgba(15, 23, 42, 0.5)', color: '#e2e8f0', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
          
          <button 
            className="btn-primary" 
            onClick={handleGenerate}
            disabled={isGenerating}
            style={{ padding: '1rem 2.5rem', alignSelf: 'flex-start' }}
          >
            {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt"></i>}
            {isGenerating ? ' Optimizing...' : ' Generate SEO Content'}
          </button>
        </div>
      </div>

      {result && (
        <div className="results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
              <i className="fas fa-check-circle" style={{ color: 'var(--secondary)' }}></i>
              Optimized Output
            </h3>
            <div style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', fontSize: '1.05rem', lineHeight: '1.8', color: '#e2e8f0' }}>
              {/* Highlight the injected keywords if possible, else just render text */}
              {result.optimizedText.split('\n').map((paragraph, idx) => (
                <p key={idx} style={{ marginBottom: '1rem' }}>{paragraph}</p>
              ))}
            </div>

            {result.injectedKeywords && result.injectedKeywords.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.1em' }}>
                  Keywords Injected
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                  {result.injectedKeywords.map((kw, i) => (
                    <span key={i} style={{ 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      color: '#10b981',
                      padding: '0.5rem 1rem', 
                      borderRadius: '12px', 
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      border: '1px solid rgba(16, 185, 129, 0.2)'
                    }}>
                      <i className="fas fa-plus" style={{ fontSize: '0.7rem', marginRight: '0.4rem' }}></i>
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentGeneration;
