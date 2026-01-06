import React, { useState } from 'react';

const RegisterModal = ({ onClose, onSwitchToLogin, onRegister, API_BASE_URL }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Username (name) validation - only alphabets
    const nameRegex = /^[a-zA-Z\s]+$/;
    if (!name || name.trim().length < 2) {
      alert('Name must be at least 2 characters');
      return;
    }
    if (!nameRegex.test(name.trim())) {
      alert('Username (name) can only contain alphabets and spaces');
      return;
    }
    
    // Email validation - proper format (example@gmail.com)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      alert('Please enter a valid email address (e.g., example@gmail.com)');
      return;
    }
    
    // Password validation - min 8 characters, one uppercase, one special character
    if (!password || password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      alert('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      alert('Password must contain at least one special character');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          company: company.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Registration failed');
        return;
      }

      alert('Account created successfully! Redirecting to dashboard...');
      onRegister(data.token, data.user);
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
        <h2><i className="fas fa-user-plus"></i> Create Account</h2>
        
        <div className="social-login">
          <button className="social-btn" onClick={() => socialLogin('google')}>
            <i className="fab fa-google"></i> Google
          </button>
          <button className="social-btn" onClick={() => socialLogin('github')}>
            <i className="fab fa-github"></i> GitHub
          </button>
        </div>

        <div className="auth-divider">
          <span>or register with email</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your full name"
              required
            />
          </div>

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
              placeholder="Create a password (min. 8 characters)"
              required
              minLength="8"
            />
          </div>

          <div className="form-group">
            <label>Company Name (Optional)</label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Enter your company name"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'start', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" required style={{ marginTop: '0.2rem' }} />
              <span>I agree to the <a href="#" style={{ color: '#667eea' }}>Terms of Service</a> and <a href="#" style={{ color: '#667eea' }}>Privacy Policy</a></span>
            </label>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            <i className="fas fa-rocket"></i> Create Account
          </button>
        </form>

        <div className="auth-switch">
          Already have an account? <a onClick={onSwitchToLogin}>Sign in</a>
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;

