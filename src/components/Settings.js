import React, { useState } from 'react';

const Settings = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const [toggleStates, setToggleStates] = useState({
    twoFA: false,
    darkMode: false,
    compactView: true,
    autoRefresh: true,
    rankingChanges: true,
    keywordOpportunities: true,
    contentGapAlerts: true,
    weeklyReports: true,
    browserNotifications: false,
    soundAlerts: false
  });

  const toggleSwitch = (key) => {
    setToggleStates({
      ...toggleStates,
      [key]: !toggleStates[key]
    });
  };

  const copyApiKey = () => {
    alert('API Key copied to clipboard!');
  };

  const cancelSubscription = () => {
    if (window.confirm('Are you sure you want to cancel your subscription?')) {
      alert('Subscription cancellation initiated. You will retain access until the end of your billing period.');
    }
  };

  const openPricingModal = () => {
    // This would scroll to pricing section if landing page was visible
    alert('Please visit the pricing section to upgrade your plan.');
  };

  return (
    <div className="page-section active">
      <div className="settings-container">
        <div className="settings-grid">
          {/* Settings Sidebar */}
          <div className="settings-sidebar">
            <ul className="settings-menu">
              <li
                className={activeSection === 'profile' ? 'active' : ''}
                onClick={() => setActiveSection('profile')}
              >
                <i className="fas fa-user"></i> Profile Settings
              </li>
              <li
                className={activeSection === 'account' ? 'active' : ''}
                onClick={() => setActiveSection('account')}
              >
                <i className="fas fa-key"></i> Account Security
              </li>
              <li
                className={activeSection === 'preferences' ? 'active' : ''}
                onClick={() => setActiveSection('preferences')}
              >
                <i className="fas fa-cog"></i> Preferences
              </li>
              <li
                className={activeSection === 'notifications' ? 'active' : ''}
                onClick={() => setActiveSection('notifications')}
              >
                <i className="fas fa-bell"></i> Notifications
              </li>
              <li
                className={activeSection === 'api' ? 'active' : ''}
                onClick={() => setActiveSection('api')}
              >
                <i className="fas fa-code"></i> API Settings
              </li>
              <li
                className={activeSection === 'billing' ? 'active' : ''}
                onClick={() => setActiveSection('billing')}
              >
                <i className="fas fa-credit-card"></i> Billing
              </li>
            </ul>
          </div>

          {/* Settings Content */}
          <div className="settings-content">
            {/* Profile Settings */}
            {activeSection === 'profile' && (
              <div className="settings-section active">
                <h2><i className="fas fa-user"></i> Profile Settings</h2>
                
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" defaultValue="saifullah nazir" placeholder="Enter your full name" />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" defaultValue="saifullahnazir@gmail.com" placeholder="Enter your email" />
                </div>

                <div className="form-group">
                  <label>Company Name</label>
                  <input type="text" defaultValue="Digital Marketing Pro" placeholder="Enter company name" />
                </div>

                <div className="form-group">
                  <label>Website URL</label>
                  <input type="url" defaultValue="https://example.com" placeholder="Enter your website URL" />
                </div>

                <div className="form-group">
                  <label>Bio</label>
                  <textarea rows="4" placeholder="Tell us about yourself and your business..." defaultValue="SEO specialist with 5+ years of experience helping businesses grow their organic traffic."></textarea>
                </div>

                <button className="btn btn-primary">
                  <i className="fas fa-save"></i> Save Changes
                </button>
              </div>
            )}

            {/* Account Security */}
            {activeSection === 'account' && (
              <div className="settings-section active">
                <h2><i className="fas fa-key"></i> Account Security</h2>
                
                <div className="form-group">
                  <label>Current Password</label>
                  <input type="password" placeholder="Enter current password" />
                </div>

                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" placeholder="Enter new password" />
                </div>

                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" placeholder="Confirm new password" />
                </div>

                <button className="btn btn-primary">
                  <i className="fas fa-lock"></i> Update Password
                </button>

                <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                <h3 style={{ marginBottom: '1.5rem' }}>Two-Factor Authentication</h3>
                
                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Enable 2FA</h4>
                    <p>Add an extra layer of security to your account</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.twoFA ? 'active' : ''}`}
                    onClick={() => toggleSwitch('twoFA')}
                  ></div>
                </div>

                <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                <h3 style={{ marginBottom: '1.5rem' }}>Active Sessions</h3>
                
                <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Chrome on Windows</p>
                      <p style={{ fontSize: '0.85rem', color: '#666' }}>Rawalpindi, Pakistan • Current session</p>
                    </div>
                    <span style={{ color: '#2ecc71', fontWeight: 600 }}>Active</span>
                  </div>
                </div>

                <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: '0.3rem' }}>Safari on iPhone</p>
                      <p style={{ fontSize: '0.85rem', color: '#666' }}>Last active 2 hours ago</p>
                    </div>
                    <button className="btn btn-danger" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      Revoke
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences */}
            {activeSection === 'preferences' && (
              <div className="settings-section active">
                <h2><i className="fas fa-cog"></i> Preferences</h2>
                
                <div className="form-group">
                  <label>Language</label>
                  <select>
                    <option>English (US)</option>
                    <option>English (UK)</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Timezone</label>
                  <select>
                    <option>Pakistan Standard Time (PKT)</option>
                    <option>Eastern Time (ET)</option>
                    <option>Pacific Time (PT)</option>
                    <option>Central European Time (CET)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Default Report Format</label>
                  <select>
                    <option>PDF</option>
                    <option>HTML</option>
                    <option>Excel (XLSX)</option>
                    <option>CSV</option>
                  </select>
                </div>

                <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                <h3 style={{ marginBottom: '1.5rem' }}>Dashboard Preferences</h3>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Dark Mode</h4>
                    <p>Use dark theme for the dashboard</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.darkMode ? 'active' : ''}`}
                    onClick={() => toggleSwitch('darkMode')}
                  ></div>
                </div>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Compact View</h4>
                    <p>Show more data in less space</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.compactView ? 'active' : ''}`}
                    onClick={() => toggleSwitch('compactView')}
                  ></div>
                </div>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Auto-refresh Data</h4>
                    <p>Automatically update dashboard every 5 minutes</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.autoRefresh ? 'active' : ''}`}
                    onClick={() => toggleSwitch('autoRefresh')}
                  ></div>
                </div>

                <button className="btn btn-primary">
                  <i className="fas fa-save"></i> Save Preferences
                </button>
              </div>
            )}

            {/* Notifications */}
            {activeSection === 'notifications' && (
              <div className="settings-section active">
                <h2><i className="fas fa-bell"></i> Notification Settings</h2>
                
                <h3 style={{ marginBottom: '1.5rem' }}>Email Notifications</h3>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Ranking Changes</h4>
                    <p>Get notified when your keyword rankings change significantly</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.rankingChanges ? 'active' : ''}`}
                    onClick={() => toggleSwitch('rankingChanges')}
                  ></div>
                </div>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>New Keyword Opportunities</h4>
                    <p>Receive alerts about new keyword opportunities</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.keywordOpportunities ? 'active' : ''}`}
                    onClick={() => toggleSwitch('keywordOpportunities')}
                  ></div>
                </div>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Content Gap Alerts</h4>
                    <p>Get notified when new content gaps are identified</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.contentGapAlerts ? 'active' : ''}`}
                    onClick={() => toggleSwitch('contentGapAlerts')}
                  ></div>
                </div>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Weekly Reports</h4>
                    <p>Receive weekly performance summary via email</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.weeklyReports ? 'active' : ''}`}
                    onClick={() => toggleSwitch('weeklyReports')}
                  ></div>
                </div>

                <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                <h3 style={{ marginBottom: '1.5rem' }}>In-App Notifications</h3>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Browser Notifications</h4>
                    <p>Show desktop notifications for important updates</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.browserNotifications ? 'active' : ''}`}
                    onClick={() => toggleSwitch('browserNotifications')}
                  ></div>
                </div>

                <div className="preference-row">
                  <div className="preference-info">
                    <h4>Sound Alerts</h4>
                    <p>Play sound when new notifications arrive</p>
                  </div>
                  <div
                    className={`toggle-switch ${toggleStates.soundAlerts ? 'active' : ''}`}
                    onClick={() => toggleSwitch('soundAlerts')}
                  ></div>
                </div>

                <button className="btn btn-primary">
                  <i className="fas fa-save"></i> Save Notification Settings
                </button>
              </div>
            )}

            {/* API Settings */}
            {activeSection === 'api' && (
              <div className="settings-section active">
                <h2><i className="fas fa-code"></i> API Settings</h2>
                
                <p style={{ color: '#666', marginBottom: '2rem' }}>Use our API to integrate SEO insights into your own applications and workflows.</p>

                <div className="form-group">
                  <label>API Key</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <input type="text" defaultValue="sk_live_abc123xyz789..." readOnly style={{ flex: 1 }} />
                    <button className="btn btn-secondary" onClick={copyApiKey}>
                      <i className="fas fa-copy"></i> Copy
                    </button>
                  </div>
                </div>

                <button className="btn btn-danger" style={{ marginBottom: '2rem' }}>
                  <i className="fas fa-sync"></i> Regenerate API Key
                </button>

                <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                <h3 style={{ marginBottom: '1.5rem' }}>API Usage</h3>

                <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '10px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ color: '#666' }}>Requests this month</span>
                    <span style={{ fontWeight: 600 }}>8,450 / 10,000</span>
                  </div>
                  <div style={{ background: '#e0e0e0', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                    <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', width: '84.5%', height: '100%' }}></div>
                  </div>
                </div>

                <h3 style={{ margin: '2rem 0 1.5rem 0' }}>API Documentation</h3>
                
                <a href="#" style={{ display: 'block', background: '#f8f9fa', padding: '1rem', borderRadius: '10px', textDecoration: 'none', color: '#333', marginBottom: '0.5rem' }}>
                  <i className="fas fa-book" style={{ color: '#667eea', marginRight: '0.5rem' }}></i> View Full API Documentation
                </a>
                <a href="#" style={{ display: 'block', background: '#f8f9fa', padding: '1rem', borderRadius: '10px', textDecoration: 'none', color: '#333' }}>
                  <i className="fas fa-code" style={{ color: '#667eea', marginRight: '0.5rem' }}></i> Code Examples & SDKs
                </a>
              </div>
            )}

            {/* Billing */}
            {activeSection === 'billing' && (
              <div className="settings-section active">
                <h2><i className="fas fa-credit-card"></i> Billing & Subscription</h2>
                
                <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '2rem', borderRadius: '15px', marginBottom: '2rem' }}>
                  <h3 style={{ marginBottom: '0.5rem' }}>Professional Plan</h3>
                  <p style={{ opacity: 0.9, marginBottom: '1.5rem' }}>$99/month • Billed monthly</p>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" style={{ background: 'white', color: '#667eea' }} onClick={openPricingModal}>
                      <i className="fas fa-arrow-up"></i> Upgrade Plan
                    </button>
                    <button className="btn btn-secondary" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none' }} onClick={cancelSubscription}>
                      Cancel Subscription
                    </button>
                  </div>
                </div>

                <h3 style={{ marginBottom: '1.5rem' }}>Payment Method</h3>

                <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '10px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontWeight: 600, marginBottom: '0.3rem' }}>
                        <i className="fas fa-credit-card" style={{ marginRight: '0.5rem' }}></i> •••• •••• •••• 4242
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#666' }}>Expires 12/2026</p>
                    </div>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      <i className="fas fa-edit"></i> Update
                    </button>
                  </div>
                </div>

                <button className="btn btn-secondary">
                  <i className="fas fa-plus"></i> Add Payment Method
                </button>

                <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #e0e0e0' }} />

                <h3 style={{ marginBottom: '1.5rem' }}>Billing History</h3>

                <table className="keyword-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Oct 1, 2025</td>
                      <td>Professional Plan - Monthly</td>
                      <td>$99.00</td>
                      <td><span className="performance-badge badge-strong">Paid</span></td>
                      <td><a href="#" style={{ color: '#667eea' }}><i className="fas fa-download"></i> Download</a></td>
                    </tr>
                    <tr>
                      <td>Sep 1, 2025</td>
                      <td>Professional Plan - Monthly</td>
                      <td>$99.00</td>
                      <td><span className="performance-badge badge-strong">Paid</span></td>
                      <td><a href="#" style={{ color: '#667eea' }}><i className="fas fa-download"></i> Download</a></td>
                    </tr>
                    <tr>
                      <td>Aug 1, 2025</td>
                      <td>Professional Plan - Monthly</td>
                      <td>$99.00</td>
                      <td><span className="performance-badge badge-strong">Paid</span></td>
                      <td><a href="#" style={{ color: '#667eea' }}><i className="fas fa-download"></i> Download</a></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

