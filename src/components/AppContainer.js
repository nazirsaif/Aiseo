import React, { useState } from 'react';
import Navbar from './Navbar';
import Dashboard from './Dashboard';
import Reports from './Reports';
import Settings from './Settings';
import SEOAudit from './SEOAudit';
import NotificationPanel from './NotificationPanel';

const AppContainer = ({ authToken, currentUser, onLogout, API_BASE_URL, onUserUpdate }) => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="app-container active">
      <Navbar
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={onLogout}
        onToggleNotifications={() => setShowNotifications(!showNotifications)}
      />

      <div className="container">
        {currentPage === 'dashboard' && (
          <Dashboard authToken={authToken} API_BASE_URL={API_BASE_URL} />
        )}
        {currentPage === 'seo-audit' && (
          <SEOAudit authToken={authToken} API_BASE_URL={API_BASE_URL} />
        )}
        {currentPage === 'reports' && (
          <Reports authToken={authToken} API_BASE_URL={API_BASE_URL} />
        )}
        {currentPage === 'settings' && (
          <Settings
            authToken={authToken}
            API_BASE_URL={API_BASE_URL}
            currentUser={currentUser}
            onUserUpdate={onUserUpdate}
          />
        )}
      </div>

      <NotificationPanel
        isActive={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </div>
  );
};

export default AppContainer;

