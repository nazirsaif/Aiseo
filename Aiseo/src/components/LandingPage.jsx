import React from 'react';

const LandingPage = ({ onOpenLogin, onOpenRegister, onSelectPlan }) => {
  const scrollToPricing = () => {
    const pricingSection = document.getElementById('pricing');
    if (pricingSection) {
      pricingSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page" style={{ color: '#fff' }}>
      {/* Premium Glass Nav */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: 'rgba(2, 6, 23, 0.7)', backdropFilter: 'blur(15px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.5rem', fontWeight: '800', background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          <i className="fas fa-brain" style={{ WebkitTextFillColor: 'initial', color: '#6366f1' }}></i>
          Automated SEO
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="#features" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>Features</a>
          <a href="#pricing" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: '500' }}>Pricing</a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: '1rem' }}>
            <button className="btn-glass" onClick={onOpenLogin}>
              <i className="fas fa-sign-in-alt"></i> Login
            </button>
            <button className="btn-primary" onClick={onOpenRegister} style={{ padding: '0.6rem 1.2rem', fontSize: '0.9rem' }}>
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section - High Impact */}
      <section style={{ 
        padding: '12rem 2rem 8rem 2rem', textAlign: 'center', 
        background: 'radial-gradient(circle at top, rgba(99, 102, 241, 0.15) 0%, transparent 50%)',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Animated Background Elements */}
        <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '600px', background: 'var(--primary)', filter: 'blur(150px)', opacity: 0.1, zIndex: -1 }}></div>

        <h1 style={{ fontSize: '4.5rem', fontWeight: '900', letterSpacing: '-0.03em', lineHeight: '1.1', marginBottom: '2rem', background: 'linear-gradient(to bottom, #fff 40%, rgba(255,255,255,0.5))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Algorithmic Dominance<br />Powered by Automated SEO
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '800px', margin: '0 auto 3rem auto', lineHeight: '1.6' }}>
          Experience the next generation of SEO intelligence. Our proprietary AI engine identifies hidden keyword clusters, maps competitor neural gaps, and predicts ranking velocity with 94% accuracy.
        </p>
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center' }}>
          <button className="btn-primary" onClick={onOpenRegister} style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}>
            Initialize Free Trial
          </button>
          <button className="btn-secondary" onClick={scrollToPricing} style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}>
            Analyze Plans
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{ padding: '6rem 2rem' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem' }}>Automated Seo Architecture</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Proprietary technologies built for technical SEO elites.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
            {[
              { icon: 'fa-microchip', title: 'Cognitive Clustering', desc: 'Neural networks automatically group thousands of keywords into high-intent thematic silos.' },
              { icon: 'fa-shield-halved', title: 'Competitor Stealth Audit', desc: 'Bypass advanced bot protection to map the exact technical blueprint of any market competitor.' },
              { icon: 'fa-chart-line', title: 'Velocity Prediction', desc: 'Proprietary machine learning models that predict ranking timeframes based on keyword difficulty.' },
              { icon: 'fa-wand-magic-sparkles', title: 'Semantic Gap Solver', desc: 'AI-driven content generation strategy designed to fill information gaps identified in SERP results.' },
              { icon: 'fa-bolt', title: 'Real-time Neural Pulse', desc: 'Instant feedback on technical health, mobile performance, and core web vital bottlenecks.' },
              { icon: 'fa-file-shield', title: 'Enterprise Encryption', desc: 'Bank-grade security for your proprietary SEO data and intelligence archives.' }
            ].map((f, i) => (
              <div key={i} className="card table-row-hover" style={{ padding: '3rem 2.5rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2rem' }}>
                  <i className={`fas ${f.icon}`} style={{ fontSize: '1.5rem', color: 'var(--primary)' }}></i>
                </div>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '1rem' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-muted)', lineHeight: '1.7', fontSize: '0.95rem' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing - Cosmic Grid */}
      <section id="pricing" style={{ padding: '8rem 2rem', background: 'rgba(255,255,255,0.01)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem' }}>Investment Protocol</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Scalable intelligence for agencies and enterprise teams.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '3rem' }}>
            {[
              { 
                plan: 'Identity', price: '29', desc: 'Perfect for individual neural analysts.',
                features: ['10 Neural Analyses', '5 Content Gaps', 'Basic SERP Insights', 'PDF Archives']
              },
              { 
                plan: 'Protocol', price: '99', desc: 'Our most popular agency configuration.', popular: true,
                features: ['100 Neural Analyses', 'Unlimited Gaps', 'Advanced API Access', 'Velocity Prediction', 'Priority Neural Support']
              },
              { 
                plan: 'Nexus', price: '299', desc: 'Enterprise-grade intelligence hub.',
                features: ['Infinite Analyses', 'Full API Access', 'Custom Integrations', 'Dedicated Neural Analyst', 'White-label Intelligence']
              }
            ].map((p, i) => (
              <div key={i} className="card" style={{ 
                padding: '3.5rem 3rem', 
                border: p.popular ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.05)',
                background: p.popular ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(15, 23, 42, 0.8))' : 'rgba(255,255,255,0.02)',
                position: 'relative'
              }}>
                {p.popular && <div style={{ position: 'absolute', top: '20px', right: '20px', background: 'var(--primary)', color: '#fff', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '800' }}>MOST POPULAR</div>}
                <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem' }}>{p.plan}</h3>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '3rem', fontWeight: '900' }}>${p.price}</span>
                  <span style={{ color: 'var(--text-muted)' }}>/ month</span>
                </div>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2.5rem', fontSize: '0.9rem' }}>{p.desc}</p>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 3rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {p.features.map((f, j) => (
                    <li key={j} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <i className="fas fa-check-circle" style={{ color: p.popular ? 'var(--accent)' : 'var(--primary)' }}></i>
                      {f}
                    </li>
                  ))}
                </ul>
                <button className={p.popular ? 'btn-primary' : 'btn-secondary'} style={{ width: '100%', padding: '1rem' }} onClick={() => onSelectPlan(p.plan.toLowerCase())}>
                  Initialize Nexus
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '4rem 2rem', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', fontSize: '1.25rem', fontWeight: '800', marginBottom: '1.5rem', opacity: 0.5 }}>
          <i className="fas fa-brain"></i>
          Automated SEO Insights
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>&copy; 2026 Automated AI Intelligence. All protocols secured.</p>
      </footer>
    </div>
  );
};

export default LandingPage;

