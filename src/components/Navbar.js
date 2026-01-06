import React from 'react';

const Navbar = ({ currentUser, currentPage, onNavigate, onLogout, onToggleNotifications }) => {
  return (
    <nav className="navbar">
      <div className="logo">
        <i className="fas fa-search-dollar"></i>
        SEO Insights
      </div>
      <ul className="nav-links">
        <li>
          <a
            onClick={() => onNavigate('dashboard')}
            className={currentPage === 'dashboard' ? 'active' : ''}
          >
            Dashboard
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('seo-audit')}
            className={currentPage === 'seo-audit' ? 'active' : ''}
          >
            <i className="fas fa-search"></i> SEO Audit
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('reports')}
            className={currentPage === 'reports' ? 'active' : ''}
          >
            Reports
          </a>
        </li>
        <li>
          <a
            onClick={() => onNavigate('settings')}
            className={currentPage === 'settings' ? 'active' : ''}
          >
            Settings
          </a>
        </li>
      </ul>
      <div className="user-menu">
        <div className="notification-icon" onClick={onToggleNotifications}>
          <i className="fas fa-bell"></i>
          <span className="notification-badge">3</span>
        </div>
        <span>{currentUser && currentUser.name ? currentUser.name : 'User'}</span>
        <button
          className="btn btn-secondary"
          style={{ padding: '0.5rem 1rem', marginLeft: '1rem' }}
          onClick={onLogout}
        >
          <i className="fas fa-sign-out-alt"></i> Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;

