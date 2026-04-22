import React from 'react';

const LandingPage = ({ onOpenLogin, onOpenRegister, onSelectPlan }) => {
  const scrollToPricing = () => {
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page">
      {/* Landing Navigation */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <i className="fas fa-search-dollar"></i>
          SEO Insights
        </div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <button className="btn btn-white" onClick={onOpenLogin}>
            <i className="fas fa-sign-in-alt"></i> Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <h1>AI-Powered SEO Insights<br />That Drive Results</h1>
        <p>Discover keyword opportunities, analyze competitors, and optimize your content with advanced AI technology. Get actionable insights in minutes, not hours.</p>
        <div className="hero-buttons">
          <button className="btn btn-white" onClick={onOpenRegister}>
            <i className="fas fa-rocket"></i> Start Free Trial
          </button>
          <button className="btn btn-outline" onClick={scrollToPricing}>
            <i className="fas fa-tag"></i> View Pricing
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="features-container">
          <h2 className="section-title">Powerful Features for Modern SEO</h2>
          <p className="section-subtitle">Everything you need to dominate search rankings and outperform competitors</p>
          
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-layer-group"></i>
              </div>
              <h3>Intelligent Keyword Clustering</h3>
              <p>Automatically group related keywords and identify high-value opportunities with AI-powered semantic analysis.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-search"></i>
              </div>
              <h3>SERP Analysis</h3>
              <p>Deep dive into search results to understand what's ranking and why. Get actionable insights to improve your rankings.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <h3>Content Gap Detection</h3>
              <p>Discover what your competitors are ranking for that you're not. Fill the gaps and capture more market share.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-lightbulb"></i>
              </div>
              <h3>AI Recommendations</h3>
              <p>Get personalized, actionable suggestions powered by machine learning to improve your SEO performance.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-chart-line"></i>
              </div>
              <h3>Performance Tracking</h3>
              <p>Monitor your keyword rankings, traffic trends, and SEO score over time with beautiful visualizations.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <i className="fas fa-file-alt"></i>
              </div>
              <h3>Automated Reporting</h3>
              <p>Generate comprehensive SEO reports in seconds. Export as PDF, HTML, or Excel for easy sharing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="pricing-section" id="pricing">
        <h2 className="section-title">Choose Your Perfect Plan</h2>
        <p className="section-subtitle">Flexible pricing for businesses of all sizes</p>
        
        <div className="pricing-grid">
          {/* Starter Plan */}
          <div className="pricing-card">
            <h3>Starter</h3>
            <div className="price">$29<span>/month</span></div>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>Perfect for small businesses and bloggers</p>
            <ul className="pricing-features">
              <li><i className="fas fa-check"></i> 10 keyword analyses per month</li>
              <li><i className="fas fa-check"></i> 5 content gap reports</li>
              <li><i className="fas fa-check"></i> Basic SERP insights</li>
              <li><i className="fas fa-check"></i> Email support</li>
              <li><i className="fas fa-check"></i> 1 website tracking</li>
              <li><i className="fas fa-check"></i> PDF reports</li>
            </ul>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onSelectPlan('starter')}>
              Get Started
            </button>
          </div>

          {/* Professional Plan (Popular) */}
          <div className="pricing-card popular">
            <div className="popular-badge">
              <i className="fas fa-star"></i> Most Popular
            </div>
            <h3>Professional</h3>
            <div className="price">$99<span>/month</span></div>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>Ideal for growing businesses and agencies</p>
            <ul className="pricing-features">
              <li><i className="fas fa-check"></i> 100 keyword analyses per month</li>
              <li><i className="fas fa-check"></i> Unlimited content gap reports</li>
              <li><i className="fas fa-check"></i> Advanced SERP insights</li>
              <li><i className="fas fa-check"></i> Priority support</li>
              <li><i className="fas fa-check"></i> 5 website tracking</li>
              <li><i className="fas fa-check"></i> PDF, HTML & Excel reports</li>
              <li><i className="fas fa-check"></i> API access</li>
              <li><i className="fas fa-check"></i> Competitor benchmarking</li>
            </ul>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onSelectPlan('professional')}>
              Get Started
            </button>
          </div>

          {/* Enterprise Plan */}
          <div className="pricing-card">
            <h3>Enterprise</h3>
            <div className="price">$299<span>/month</span></div>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>For large teams with advanced needs</p>
            <ul className="pricing-features">
              <li><i className="fas fa-check"></i> Unlimited keyword analyses</li>
              <li><i className="fas fa-check"></i> Unlimited content gap reports</li>
              <li><i className="fas fa-check"></i> Premium SERP insights</li>
              <li><i className="fas fa-check"></i> 24/7 dedicated support</li>
              <li><i className="fas fa-check"></i> Unlimited website tracking</li>
              <li><i className="fas fa-check"></i> All export formats</li>
              <li><i className="fas fa-check"></i> Advanced API access</li>
              <li><i className="fas fa-check"></i> White-label reports</li>
              <li><i className="fas fa-check"></i> Custom integrations</li>
              <li><i className="fas fa-check"></i> Dedicated account manager</li>
            </ul>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onSelectPlan('enterprise')}>
              Contact Sales
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: '3rem', opacity: 0.9 }}>
          All plans include a 14-day free trial. No credit card required.
        </p>
      </section>

      {/* Footer */}
      <div style={{ background: 'rgba(0,0,0,0.2)', padding: '2rem', textAlign: 'center', color: 'white' }}>
        <p>&copy; 2025 SEO Insights. All rights reserved.</p>
      </div>
    </div>
  );
};

export default LandingPage;

