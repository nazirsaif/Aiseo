import React, { useState } from 'react';

const LoginModal = ({ onClose, onSwitchToRegister, onLogin, API_BASE_URL }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Email validation - proper format (example@gmail.com)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      alert('Please enter a valid email address (e.g., example@gmail.com)');
      return;
    }
    
    if (!password) {
      alert('Please enter your password');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Login failed');
        return;
      }

      alert('Login successful! Redirecting to dashboard...');
      onLogin(data.token, data.user);
    } catch (err) {
      console.error(err);
      alert('Unable to connect to server. Is the backend running?');
    }
  };

  const socialLogin = (provider) => {
    alert(`Redirecting to ${provider} login...`);
  };

  return (
    <div className="modal active" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <span className="modal-close" onClick={onClose}>&times;</span>
        <h2><i className="fas fa-sign-in-alt"></i> Welcome Back</h2>
        
        <div className="social-login">
          <button className="social-btn" onClick={() => socialLogin('google')}>
            <i className="fab fa-google"></i> Google
          </button>
          <button className="social-btn" onClick={() => socialLogin('github')}>
            <i className="fab fa-github"></i> GitHub
          </button>
        </div>

        <div className="auth-divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" /> Remember me
            </label>
            <a href="#" style={{ color: '#667eea', textDecoration: 'none' }}>Forgot password?</a>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            <i className="fas fa-sign-in-alt"></i> Sign In
          </button>
        </form>

        <div className="auth-switch">
          Don't have an account? <a onClick={onSwitchToRegister}>Sign up</a>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

