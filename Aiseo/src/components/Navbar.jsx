import React from 'react';

const Navbar = ({ currentUser, currentPage, onNavigate, onLogout }) => {
  return (
    <nav className="navbar"  >


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
            onClick={() => onNavigate('content-generation')}
            className={currentPage === 'content-generation' ? 'active' : ''}
          >
            <i className="fas fa-pen-nib"></i> Content Generation
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
      </ul>

      <div className="user-menu" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div 
          onClick={() => onNavigate('settings')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.4rem 1rem 0.4rem 0.4rem',
            borderRadius: '50px',
            background: currentPage === 'settings' ? 'var(--primary)' : 'var(--glass)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '0.9rem',
            overflow: 'hidden'
          }}>
            {currentUser?.profilePicture ? (
              <img src={currentUser.profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <i className="fas fa-user"></i>
            )}
          </div>
          <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'white' }}>
            {currentUser?.name || 'Saifullah'}
          </span>
        </div>
        <button 
          className="btn" 
          onClick={onLogout} 
          style={{ 
            padding: '0.5rem', 
            background: 'transparent', 
            color: 'var(--text-muted)', 
            border: 'none', 
            cursor: 'pointer',
            fontSize: '1.2rem',
            transition: 'color 0.3s'
          }}
          onMouseOver={(e) => e.currentTarget.style.color = 'white'}
          onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          title="Logout"
        >
          <i className="fas fa-sign-out-alt"></i>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
