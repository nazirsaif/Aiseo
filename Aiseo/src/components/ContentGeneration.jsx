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

  const renderHighlightedText = (text, keywords) => {
    if (!text) return null;
    return text.split('\n').map((paragraph, idx) => {
      if (!paragraph.trim()) return null;
      if (!keywords || keywords.length === 0) {
        return <p key={idx} style={{ marginBottom: '1rem' }}>{paragraph}</p>;
      }
      const escaped = keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
      const parts = paragraph.split(regex);
      return (
        <p key={idx} style={{ marginBottom: '1rem' }}>
          {parts.map((part, i) => {
            const isHighlighted = keywords.some(k => k.toLowerCase() === part.toLowerCase());
            return isHighlighted
              ? <mark key={i} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '0.1em 0.3em', borderRadius: '4px', fontWeight: '600' }}>{part}</mark>
              : <span key={i}>{part}</span>;
          })}
        </p>
      );
    });
  };

  return (
    <div className="page-section active">
      {/* ── Centered Header ── */}
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h2 style={{
          fontSize: '2.5rem',
          fontWeight: '800',
          marginBottom: '0.5rem',
          color: 'white',
        }}>
          AI Content Generator
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
          Optimize your content with semantic keywords extracted via our RAG intelligence engine.
        </p>

        <div style={{
          marginTop: '1.5rem',
          padding: '1rem 1.5rem',
          background: 'rgba(16, 185, 129, 0.05)',
          borderRadius: '12px',
          border: '1px solid rgba(16, 185, 129, 0.1)',
          maxWidth: '1500px',
          margin: '1.5rem auto 0',
          textAlign: 'left',
        }}>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '0.5rem' }}>
            <i className="fas fa-magic"></i> How It Works
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>
            <strong>1.</strong> Enter your target keyword below &nbsp;→&nbsp; <strong>2.</strong> Paste your existing content &nbsp;→&nbsp; <strong>3.</strong> Our engine crawls live competitors, extracts high-value semantic gaps, and weaves them into your text at natural insertion points.
          </p>
        </div>
      </div>

      {/* ── Input Card ── */}
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
          
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button 
              className="btn-primary" 
              onClick={handleGenerate}
              disabled={isGenerating}
              style={{ padding: '1rem 2.5rem' }}
            >
              {isGenerating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt"></i>}
              {isGenerating ? ' Analyzing Competitors...' : ' Generate SEO Content'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      {result && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          {/* Optimized Output */}
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
              <i className="fas fa-check-circle" style={{ color: 'var(--secondary)' }}></i>
              Optimized Output
            </h3>
            <div style={{
              padding: '1.5rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)',
              fontSize: '1.05rem',
              lineHeight: '1.8',
              color: '#e2e8f0'
            }}>
              {renderHighlightedText(result.optimizedText, result.injectedKeywords)}
            </div>

            {/* Injected Keywords Badges */}
            {result.injectedKeywords && result.injectedKeywords.length > 0 && (
              <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.1em' }}>
                  <i className="fas fa-tags" style={{ marginRight: '0.5rem', color: 'var(--secondary)' }}></i>
                  Keywords Injected ({result.injectedKeywords.length})
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', justifyContent: 'center' }}>
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

          {/* Stats Summary */}
          <div className="card" style={{ background: 'rgba(15, 23, 42, 0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1.1rem', color: 'var(--text-muted)' }}>
              <i className="fas fa-chart-bar" style={{ color: 'var(--primary)' }}></i>
              Optimization Summary
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--secondary)' }}>
                  {result.injectedKeywords?.length || 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Keywords Added</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--primary)' }}>
                  {content.split(/\s+/).filter(w => w.length > 0).length}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Original Words</div>
              </div>
              <div style={{ textAlign: 'center', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#818cf8' }}>
                  {result.optimizedText ? result.optimizedText.split(/\s+/).filter(w => w.length > 0).length : 0}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>Optimized Words</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentGeneration;
