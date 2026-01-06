import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AppContainer from './components/AppContainer';
import LoginModal from './components/LoginModal';
import RegisterModal from './components/RegisterModal';
import PlanModal from './components/PlanModal';

const API_BASE_URL = 'http://localhost:5000';

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('');

  useEffect(() => {
    // Always show landing page first - user must login/signup
    // Token validation will be handled on the backend when making API calls
    setShowLanding(true);
  }, []);

  const handleLogin = (token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    setShowLoginModal(false);
    setShowLanding(false);
    try {
      localStorage.setItem('seo_tool_token', token);
    } catch (e) {
      console.warn('Could not persist token', e);
    }
  };

  const handleRegister = (token, user) => {
    setAuthToken(token);
    setCurrentUser(user);
    setShowRegisterModal(false);
    setShowLanding(false);
    try {
      localStorage.setItem('seo_tool_token', token);
    } catch (e) {
      console.warn('Could not persist token', e);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      setAuthToken(null);
      setCurrentUser(null);
      setShowLanding(true);
      try {
        localStorage.removeItem('seo_tool_token');
      } catch (e) {
        console.warn('Could not clear token', e);
      }
    }
  };

  const openLoginModal = () => {
    setShowLoginModal(true);
    setShowRegisterModal(false);
  };

  const openRegisterModal = () => {
    setShowRegisterModal(true);
    setShowLoginModal(false);
  };

  const closeModals = () => {
    setShowLoginModal(false);
    setShowRegisterModal(false);
    setShowPlanModal(false);
  };

  const switchToRegister = () => {
    setShowLoginModal(false);
    setShowRegisterModal(true);
  };

  const switchToLogin = () => {
    setShowRegisterModal(false);
    setShowLoginModal(true);
  };

  const selectPlan = (plan) => {
    setSelectedPlan(plan);
    if (plan === 'enterprise') {
      alert('Our sales team will contact you shortly to discuss your enterprise needs!');
      return;
    }
    setShowRegisterModal(false);
    setShowPlanModal(true);
  };

  const handlePayment = () => {
    alert('Payment processed successfully! Welcome to SEO Insights!');
    setShowPlanModal(false);
    setShowLanding(false);
  };

  return (
    <div className="App">
      {showLanding && (
        <LandingPage
          onOpenLogin={openLoginModal}
          onOpenRegister={openRegisterModal}
          onSelectPlan={selectPlan}
        />
      )}
      
      {!showLanding && authToken && (
        <AppContainer
          authToken={authToken}
          currentUser={currentUser}
          onLogout={handleLogout}
          API_BASE_URL={API_BASE_URL}
        />
      )}

      {showLoginModal && (
        <LoginModal
          onClose={closeModals}
          onSwitchToRegister={switchToRegister}
          onLogin={handleLogin}
          API_BASE_URL={API_BASE_URL}
        />
      )}

      {showRegisterModal && (
        <RegisterModal
          onClose={closeModals}
          onSwitchToLogin={switchToLogin}
          onRegister={handleRegister}
          API_BASE_URL={API_BASE_URL}
        />
      )}

      {showPlanModal && (
        <PlanModal
          plan={selectedPlan}
          onClose={closeModals}
          onPayment={handlePayment}
        />
      )}
    </div>
  );
}

export default App;

