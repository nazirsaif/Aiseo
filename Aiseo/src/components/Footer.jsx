import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer style={{
      marginTop: 'auto',
      padding: '2rem 1rem',
      background: 'rgba(15, 23, 42, 0.8)',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: '0.85rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--primary)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>About AISEO</a>
          <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--primary)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>Privacy Policy</a>
          <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--primary)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>Terms of Service</a>
          <a href="#" style={{ color: 'var(--text-muted)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={(e) => e.target.style.color = 'var(--primary)'} onMouseOut={(e) => e.target.style.color = 'var(--text-muted)'}>Contact Support</a>
        </div>
        <div>
          &copy; {currentYear} AISEO Intelligence Platform. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
