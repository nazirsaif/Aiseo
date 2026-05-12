import React, { useState } from 'react';
import Navbar from './Navbar';
import CompetitorAnalysis from './CompetitorAnalysis';
import KeywordResearch from './KeywordResearch';
import ContentGap from './ContentGap';
import SEOAudit from './SEOAudit';
import Reports from './Reports';
import Settings from './Settings';
import Dashboard from './Dashboard';

const AppContainer = ({ authToken, currentUser, onLogout, API_BASE_URL, onUserUpdate }) => {
  const [currentPage, setCurrentPage] = useState('dashboard');

  return (
    <div className="app-container active">
      <Navbar
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onLogout={onLogout}
      />

      <div className="container">
        {currentPage === 'keyword-research' && (
          <KeywordResearch authToken={authToken} API_BASE_URL={API_BASE_URL} />
        )}
        {currentPage === 'dashboard' && (
          <Dashboard currentUser={currentUser} authToken={authToken} API_BASE_URL={API_BASE_URL} onNavigate={setCurrentPage} />
        )}
        {currentPage === 'competitor-analysis' && (
          <CompetitorAnalysis authToken={authToken} API_BASE_URL={API_BASE_URL} />
        )}
        {currentPage === 'content-gap' && (
          <ContentGap authToken={authToken} API_BASE_URL={API_BASE_URL} />
        )}
        {currentPage === 'seo-audit' && (
          <SEOAudit authToken={authToken} API_BASE_URL={API_BASE_URL} />
        )}
        {currentPage === 'reports' && (
          <Reports authToken={authToken} API_BASE_URL={API_BASE_URL} onNavigate={setCurrentPage} />
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
    </div>
  );
};

export default AppContainer;
