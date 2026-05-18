import React, { useState, useEffect } from 'react';

const Settings = ({ authToken, currentUser, onUserUpdate, API_BASE_URL }) => {
  const getInitialProfile = (user) => ({
    name: user?.name || '',
    email: user?.email || '',
    company: user?.company || '',
    websiteUrl: user?.websiteUrl || '',
    bio: user?.bio || '',
    profilePicture: user?.profilePicture || ''
  });

  const [activeSection, setActiveSection] = useState('profile');
  const [profile, setProfile] = useState(getInitialProfile(currentUser));
  const [preferences, setPreferences] = useState(currentUser?.settings?.preferences || {});
  const [billing, setBilling] = useState(currentUser?.billing || { plan: 'Free Protocol', paymentMethods: [] });
  const [activeSessions, setActiveSessions] = useState(currentUser?.activeSessions || []);
  const [apiKey, setApiKey] = useState(currentUser?.apiKey || 'NEURAL_KEY_PENDING');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [toast, setToast] = useState(null);

  const [passwordFields, setPasswordFields] = useState({ currentPassword: '', newPassword: '' });
  const [toggleStates, setToggleStates] = useState({
    darkMode: currentUser?.settings?.toggles?.darkMode ?? true,
    compactView: currentUser?.settings?.toggles?.compactView ?? false,
    autoRefresh: currentUser?.settings?.toggles?.autoRefresh ?? true,
    rankingChanges: currentUser?.settings?.toggles?.rankingChanges ?? true,
    twoFA: false
  });

  // Synchronize internal state with global currentUser prop
  useEffect(() => {
    if (currentUser) {
      setProfile(getInitialProfile(currentUser));
      setPreferences(currentUser.settings?.preferences || {});
      setBilling(currentUser.billing || { plan: 'Free Protocol', paymentMethods: [] });
      setActiveSessions(currentUser.activeSessions || []);
      setApiKey(currentUser.apiKey || 'NEURAL_KEY_PENDING');

      const toggles = currentUser.settings?.toggles || {};
      setToggleStates({
        darkMode: toggles.darkMode ?? true,
        compactView: toggles.compactView ?? false,
        autoRefresh: toggles.autoRefresh ?? true,
        rankingChanges: toggles.rankingChanges ?? true,
        twoFA: false
      });
    }
  }, [currentUser]);

  // --- Notification System ---
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Handlers ---
  const handleProfileChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const toggleSwitch = (id) => {
    setToggleStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(prev => ({ ...prev, profilePicture: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ ...profile })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Identity matrix synchronized.');
        if (onUserUpdate) onUserUpdate(data.user);
      } else {
        showToast(data.message || 'Sync failed.', 'error');
      }
    } catch (err) {
      showToast('Sync failed. Please check your uplink.', 'error');
    }
  };

  const updatePassword = async () => {
    if (!passwordFields.newPassword) return showToast('New key required.', 'error');
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(passwordFields)
      });
      if (res.ok) {
        showToast('Encryption keys updated.');
        setPasswordFields({ currentPassword: '', newPassword: '' });
      } else {
        const data = await res.json();
        showToast(data.message || 'Key update failed.', 'error');
      }
    } catch (err) {
      showToast('Failed to update credentials.', 'error');
    }
  };

  const saveSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ settings: { toggles: toggleStates, preferences } })
      });
      if (res.ok) showToast('Operational overrides applied.');
    } catch (err) {
      showToast('Failed to save operational logic.', 'error');
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    showToast('Neural API key copied to buffer.');
  };

  const rotateApiKey = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/rotate-api-key`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setApiKey(data.apiKey);
        showToast('API Key rotated successfully.');
        if (onUserUpdate) onUserUpdate({ ...currentUser, apiKey: data.apiKey });
      } else {
        showToast(data.message || 'Key rotation failed.', 'error');
      }
    } catch (err) {
      showToast('Failed to rotate API Key.', 'error');
    }
  };

  const terminateSession = async (sessionId) => {
    if (!sessionId) return showToast('Cannot terminate static mock session.', 'error');
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setActiveSessions(data.activeSessions);
        showToast('Session terminated.');
        if (onUserUpdate) onUserUpdate({ ...currentUser, activeSessions: data.activeSessions });
      } else {
        showToast(data.message || 'Termination failed.', 'error');
      }
    } catch (err) {
      showToast('Failed to terminate session.', 'error');
    }
  };

  const addPaymentChannel = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/user/payment-methods`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (res.ok) {
        setBilling(prev => ({ ...prev, paymentMethods: data.paymentMethods }));
        showToast('Payment channel added.');
        if (onUserUpdate) onUserUpdate({ ...currentUser, billing: { ...currentUser.billing, paymentMethods: data.paymentMethods } });
      } else {
        showToast(data.message || 'Failed to add payment channel.', 'error');
      }
    } catch (err) {
      showToast('Failed to add payment channel.', 'error');
    }
  };


  // --- Sub-components ---
  const SidebarItem = ({ id, icon, label }) => (
    <div
      onClick={() => setActiveSection(id)}
      style={{
        padding: '1.25rem 1.5rem',
        cursor: 'pointer',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        background: activeSection === id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
        color: activeSection === id ? 'var(--primary)' : 'var(--text-muted)',
        fontWeight: activeSection === id ? '700' : '500',
        marginBottom: '0.5rem',
        border: activeSection === id ? '1px solid rgba(99, 102, 241, 0.2)' : '1px solid transparent',
        boxShadow: activeSection === id ? '0 10px 30px -10px rgba(99, 102, 241, 0.2)' : 'none'
      }}
    >
      <i className={`fas ${icon}`} style={{ fontSize: '1.1rem', filter: activeSection === id ? 'drop-shadow(0 0 5px var(--primary))' : 'none' }}></i>
      <span style={{ fontSize: '0.95rem', letterSpacing: '0.02em' }}>{label}</span>
      {activeSection === id && <div style={{ marginLeft: 'auto', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }}></div>}
    </div>
  );

  const ControlToggle = ({ id, label, desc }) => (
    <div style={{
      padding: '1.5rem',
      background: 'rgba(255,255,255,0.02)',
      borderRadius: '24px',
      border: '1px solid rgba(255,255,255,0.05)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      transition: 'transform 0.2s',
      cursor: 'pointer'
    }} onClick={() => toggleSwitch(id)}>
      <div>
        <div style={{ fontWeight: '700', fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{desc}</div>
      </div>
      <div style={{
        width: '52px',
        height: '28px',
        background: toggleStates[id] ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
        borderRadius: '20px',
        position: 'relative',
        transition: '0.4s'
      }}>
        <div style={{
          position: 'absolute',
          top: '3px',
          left: toggleStates[id] ? '27px' : '3px',
          width: '22px',
          height: '22px',
          background: '#fff',
          borderRadius: '50%',
          transition: '0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}></div>
      </div>
    </div>
  );

  return (
    <div className="page-section active" style={{ maxWidth: '1300px', margin: '0 auto', position: 'relative' }}>

      {/* Dynamic Toast */}
      {toast && (
        <div className="animate-fade-in" style={{
          position: 'fixed', top: '100px', right: '40px', zIndex: 1000,
          background: toast.type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(244, 63, 94, 0.9)',
          color: '#fff', padding: '1rem 2rem', borderRadius: '16px', fontWeight: '700',
          backdropFilter: 'blur(10px)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-triangle-exclamation'}`}></i>
          {toast.message}
        </div>
      )}

      {/* Header Section */}
      <div style={{ marginBottom: '4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{
            fontSize: '3.5rem',
            fontWeight: '900',
            letterSpacing: '-0.04em',
            marginBottom: '0.5rem',
            background: 'linear-gradient(135deg, #fff 0%, #94a3b8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 30px rgba(99,102,241,0.2))'
          }}>
            Command Center
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              padding: '0.4rem 1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '800',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', animation: 'pulse 2s infinite' }}></span>
              NEURAL PROTOCOL: STABLE
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0, fontWeight: '500' }}>Manage authorization and neural overrides.</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '2rem', width: '100%' }}>

        {/* Navigation Sidebar */}
        <aside style={{ position: 'sticky', top: '120px', alignSelf: 'start' }}>
          <div className="card" style={{
            padding: '1.5rem',
            background: 'rgba(15, 23, 42, 0.4)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '32px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
          }}>
            <SidebarItem id="profile" icon="fa-id-card" label="Analyst Identity" />
            <SidebarItem id="account" icon="fa-fingerprint" label="Neural Security" />
            <SidebarItem id="workspace" icon="fa-sliders" label="Workspace Tuning" />
            <SidebarItem id="api" icon="fa-bolt-lightning" label="Neural API Access" />
            <SidebarItem id="billing" icon="fa-box-archive" label="Nexus Subscription" />
          </div>

          {/* Telemetry Card */}
          <div className="card" style={{
            marginTop: '2rem',
            padding: '2rem',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), transparent)',
            borderRadius: '32px',
            border: '1px solid rgba(255,255,255,0.03)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '900', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '0.1em' }}>Neural Throughput</div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div style={{ width: '68%', height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', boxShadow: '0 0 15px var(--primary)' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--text-main)', fontWeight: '700' }}>68% Optimized</span>
              <span style={{ color: 'var(--text-muted)' }}>Level 4</span>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

          {activeSection === 'profile' && (
            <>
              <div className="card" style={{ padding: '3.5rem', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', gap: '4rem', alignItems: 'center', marginBottom: '4rem' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: '140px',
                      height: '140px',
                      borderRadius: '45px',
                      background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '4rem',
                      fontWeight: '900',
                      color: '#fff',
                      boxShadow: '0 20px 40px rgba(99, 102, 241, 0.4)',
                      transform: 'rotate(-5deg)',
                      overflow: 'hidden'
                    }}>
                      {profile.profilePicture ? (
                        <img src={profile.profilePicture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        profile.name?.charAt(0) || 'A'
                      )}
                    </div>
                    <label style={{
                      position: 'absolute',
                      bottom: '5px',
                      right: '5px',
                      width: '44px',
                      height: '44px',
                      borderRadius: '15px',
                      background: 'var(--bg-surface)',
                      border: '2px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: 'var(--primary)',
                      boxShadow: '0 5px 15px rgba(0,0,0,0.3)'
                    }}>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
                      <i className="fas fa-camera"></i>
                    </label>
                    {profile.profilePicture && (
                      <div
                        onClick={() => setProfile(prev => ({ ...prev, profilePicture: '' }))}
                        style={{
                          position: 'absolute',
                          bottom: '5px',
                          left: '5px',
                          width: '44px',
                          height: '44px',
                          borderRadius: '15px',
                          background: 'var(--bg-surface)',
                          border: '2px solid rgba(244, 63, 94, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: '#f43f5e',
                          boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
                          zIndex: 10
                        }}
                        title="Remove Picture"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.5rem' }}>Identity Management</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '400px' }}>Your profile identity is used across all generated neural reports and team collaborations.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', marginBottom: '3rem' }}>
                  <div className="form-group" style={{ width: '100%' }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>Full Name</label>
                    <input type="text" value={profile.name || ''} onChange={(e) => handleProfileChange('name', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '16px' }} />
                  </div>
                  <div className="form-group" style={{ width: '100%' }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>Email Alias</label>
                    <input type="email" value={profile.email || ''} onChange={(e) => handleProfileChange('email', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', color: "#fff", border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '16px' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', marginBottom: '4rem' }}>
                  <div className="form-group" style={{ width: '100%' }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>Nexus / Company</label>
                    <input type="text" value={profile.company || ''} onChange={(e) => handleProfileChange('company', e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '16px' }} />
                  </div>
                  <div className="form-group" style={{ width: '100%' }}>
                    <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: '800', textTransform: 'uppercase', marginBottom: '1rem', display: 'block' }}>Primary Intelligence Domain</label>
                    <input type="url" value={profile.websiteUrl || ''} onChange={(e) => handleProfileChange('websiteUrl', e.target.value)} placeholder="https://..." style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.2)', color: "#fff", border: '1px solid rgba(255,255,255,0.05)', padding: '1.25rem', borderRadius: '16px' }} />
                  </div>
                </div>

                <button className="btn-primary" onClick={saveProfile} style={{ padding: '1.25rem 3rem', borderRadius: '20px', fontWeight: '800', fontSize: '1rem', boxShadow: '0 15px 30px rgba(99,102,241,0.3)' }}>
                  Sync Identity Matrix
                </button>
              </div>

              <div className="card" style={{ padding: '3rem', borderRadius: '40px', background: 'rgba(255,255,255,0.01)' }}>
                <h4 style={{ fontSize: '1.25rem', fontWeight: '900', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <i className="fas fa-terminal" style={{ color: 'var(--primary)' }}></i> Professional Directive
                </h4>
                <textarea
                  rows="5"
                  value={profile.bio || ''}
                  onChange={(e) => handleProfileChange('bio', e.target.value)}
                  placeholder="Define your strategic SEO objectives for the neural model..."
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '24px', fontSize: '1.1rem', color: 'var(--text-main)' }}
                ></textarea>
              </div>
            </>
          )}

          {activeSection === 'account' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div className="card" style={{ padding: '3.5rem', borderRadius: '40px' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '3rem' }}>Encryption Protocol</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', marginBottom: '3.5rem' }}>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '1rem', display: 'block' }}>Current Master Key</label>
                    <input type="password" value={passwordFields.currentPassword} onChange={(e) => setPasswordFields({ ...passwordFields, currentPassword: e.target.value })} style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '16px' }} />
                  </div>
                  <div className="form-group">
                    <label style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '1rem', display: 'block' }}>New Neural Key</label>
                    <input type="password" value={passwordFields.newPassword} onChange={(e) => setPasswordFields({ ...passwordFields, newPassword: e.target.value })} style={{ background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: '16px' }} />
                  </div>
                </div>
                <button className="btn-secondary" onClick={updatePassword} style={{ padding: '1.25rem 2.5rem', borderRadius: '20px', fontWeight: '700' }}>Rotate Master Key</button>
              </div>

              <div className="card" style={{ padding: '2.5rem', borderRadius: '40px', background: 'rgba(16, 185, 129, 0.02)', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', fontSize: '1.8rem' }}>
                      <i className="fas fa-shield-halved"></i>
                    </div>
                    <div>
                      <div style={{ fontWeight: '900', fontSize: '1.3rem', color: '#10b981' }}>Biometric / Hardware 2FA</div>
                      <p style={{ margin: 0, fontSize: '1rem', color: 'rgba(16, 185, 129, 0.7)' }}>Hardware-level authentication for ultra-secure access.</p>
                    </div>
                  </div>
                  <div onClick={() => toggleSwitch('twoFA')} style={{ width: '64px', height: '32px', background: toggleStates.twoFA ? '#10b981' : 'rgba(255,255,255,0.1)', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.4s' }}>
                    <div style={{ position: 'absolute', top: '4px', left: toggleStates.twoFA ? '36px' : '4px', width: '24px', height: '24px', background: '#fff', borderRadius: '50%', transition: '0.4s' }}></div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: '2.5rem', borderRadius: '40px' }}>
                <h4 style={{ fontWeight: '900', color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Neural Terminal History</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {activeSessions.map((s, i) => (
                    <div key={i} style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <i className={`fas ${s.deviceInfo?.toLowerCase().includes('phone') ? 'fa-mobile-screen' : 'fa-laptop-code'}`} style={{ fontSize: '1.5rem', color: 'var(--primary)', opacity: 0.8 }}></i>
                        <div>
                          <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>{s.deviceInfo}</div>
                          <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{s.location} • {s.lastActive}</div>
                        </div>
                      </div>
                      {s.lastActive !== 'Current session' && <button className="btn-secondary" onClick={() => terminateSession(s._id)} style={{ color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.6rem 1.25rem', fontSize: '0.85rem', borderRadius: '12px' }}>Terminate</button>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'workspace' && (
            <div className="animate-fade-in card" style={{ padding: '3.5rem', borderRadius: '40px' }}>
              <h3 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '3.5rem' }}>Workspace Overrides</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <ControlToggle id="darkMode" label="Atmospheric Core" desc="Toggle between Deep Midnight and Aurora Light themes." />
                <ControlToggle id="compactView" label="High Density Output" desc="Condense neural cluster visualizations for expert analysis." />
                <ControlToggle id="autoRefresh" label="Real-time Synchronization" desc="Automatically refresh neural indices and ranking data." />
                <ControlToggle id="rankingChanges" label="Velocity Notifications" desc="Get prioritized alerts for critical keyword volatility." />
              </div>
              <button className="btn-primary" style={{ marginTop: '4rem', padding: '1.25rem 3rem' }} onClick={saveSettings}>Apply Global Overrides</button>
            </div>
          )}

          {activeSection === 'api' && (
            <div className="animate-fade-in card" style={{ padding: '4rem', borderRadius: '40px' }}>
              <div style={{ marginBottom: '4rem' }}>
                <h3 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '0.75rem' }}>Neural Interface (API)</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Integrate our proprietary SEO intelligence directly into your production pipelines.</p>
              </div>

              <div style={{ background: 'rgba(0,0,0,0.3)', padding: '3.5rem', borderRadius: '40px', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', zIndex: 0 }}></div>
                <label style={{ fontSize: '0.8rem', fontWeight: '900', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '1.5rem', display: 'block', letterSpacing: '0.1em' }}>Production Intelligence Key</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', position: 'relative', zIndex: 1 }}>
                  <input type="text" value={apiKey} readOnly style={{ flex: 1, fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '0.2em', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', padding: '1.5rem', borderRadius: '20px' }} />
                  <button className="btn-secondary" onClick={copyApiKey} style={{ width: '80px', borderRadius: '20px' }}><i className="fas fa-copy fa-lg"></i></button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Rotate key if you suspect unauthorized neural access.</span>
                  <button className="btn-secondary" onClick={rotateApiKey} style={{ color: '#f43f5e', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '0.8rem 1.5rem', borderRadius: '15px' }}>Rotate Key</button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'billing' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
              <div className="card" style={{
                padding: '4rem',
                borderRadius: '45px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 100%)',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '300px', height: '300px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '50%', filter: 'blur(60px)' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4rem', position: 'relative', zIndex: 1 }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '900', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>Neural Nexus Access</div>
                    <h3 style={{ fontSize: '3rem', fontWeight: '900' }}>{billing.plan}</h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent)' }}>$49<span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/mo</span></div>
                    <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Next Pulse: Nov 24, 2025</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                  <button className="btn-primary" style={{ flex: 1, padding: '1.5rem', borderRadius: '24px', fontSize: '1.1rem' }}>Evolve Subscription</button>
                  <button className="btn-secondary" style={{ flex: 1, padding: '1.5rem', borderRadius: '24px', fontSize: '1.1rem' }}>Manage Financial Node</button>
                </div>
              </div>

              <div className="card" style={{ padding: '3.5rem', borderRadius: '40px' }}>
                <h4 style={{ fontWeight: '900', marginBottom: '2.5rem', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>Secure Payment Channels</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  {billing.paymentMethods.map((m, i) => (
                    <div key={i} style={{ padding: '2rem', background: 'rgba(255,255,255,0.02)', borderRadius: '32px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                      {m.isDefault && <div style={{ position: 'absolute', top: '20px', right: '20px', padding: '0.4rem 1rem', background: 'var(--primary)', color: '#fff', fontSize: '0.7rem', borderRadius: '8px', fontWeight: '900', boxShadow: '0 5px 15px rgba(99,102,241,0.4)' }}>PRIMARY</div>}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: '60px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="fab fa-cc-visa fa-2x" style={{ opacity: 0.8 }}></i>
                        </div>
                        <div style={{ fontWeight: '800', fontSize: '1.2rem', letterSpacing: '0.05em' }}>{m.cardNumber}</div>
                      </div>
                      <div style={{ fontSize: '1rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Exp: {m.expiry}</span>
                        <i className="fas fa-ellipsis-h" style={{ cursor: 'pointer' }}></i>
                      </div>
                    </div>
                  ))}
                  <div onClick={addPaymentChannel} style={{ padding: '2rem', border: '2px dashed rgba(255,255,255,0.1)', borderRadius: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--primary)', fontWeight: '800', fontSize: '1.1rem', transition: '0.3s' }} className="table-row-hover">
                    <i className="fas fa-plus-circle" style={{ marginRight: '0.75rem' }}></i> New Channel
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Background Pulse Effects */}
      <div style={{ position: 'fixed', top: '20%', left: '-10%', width: '600px', height: '600px', background: 'rgba(99, 102, 241, 0.03)', borderRadius: '50%', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none' }}></div>
      <div style={{ position: 'fixed', bottom: '10%', right: '-5%', width: '500px', height: '500px', background: 'rgba(6, 182, 212, 0.03)', borderRadius: '50%', filter: 'blur(100px)', zIndex: -1, pointerEvents: 'none' }}></div>
    </div>
  );
};

export default Settings;
