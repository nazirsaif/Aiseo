import React from 'react';

const Navbar = ({ currentUser, currentPage, onNavigate, onLogout }) => {
  return (
    <nav className="navbar">
      <div className="logo" onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
        <i className="fas fa-rocket"></i>
        <span>SEO Insights</span>
      </div>

      <ul className="nav-links">
        <li>
          <a
            onClick={() => onNavigate('dashboard')}
            className={currentPage === 'dashboard' ? 'active' : ''}
          >
            <i className="fas fa-th-large"></i> Dashboard
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('keyword-research')}
            className={currentPage === 'keyword-research' ? 'active' : ''}
          >
            <i className="fas fa-search"></i> Keyword Research
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('competitor-analysis')}
            className={currentPage === 'competitor-analysis' ? 'active' : ''}
          >
            <i className="fas fa-chess-knight"></i> Competitor Analysis
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('content-gap')}
            className={currentPage === 'content-gap' ? 'active' : ''}
          >
            <i className="fas fa-spell-check"></i> Content Gap
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('seo-audit')}
            className={currentPage === 'seo-audit' ? 'active' : ''}
          >
            <i className="fas fa-file-medical"></i> SEO Audit
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('reports')}
            className={currentPage === 'reports' ? 'active' : ''}
          >
            <i className="fas fa-chart-bar"></i> Reports
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('settings')}
            className={currentPage === 'settings' ? 'active' : ''}
          >
            <i className="fas fa-cog"></i> Settings
          </a>
        </li>
      </ul>

      <div className="user-menu">
        <div className="user-info" style={{ textAlign: 'right', marginRight: '1rem' }}>
          <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{currentUser?.name || 'User'}</div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>{currentUser?.plan || 'Free Plan'}</div>
        </div>
        <button className="btn" onClick={onLogout} style={{ padding: '0.5rem', background: 'transparent', color: '#666' }}>
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
