import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const Dashboard = ({ currentUser, authToken, API_BASE_URL, onNavigate }) => {
  const [dashboardData, setDashboardData] = useState({
    keywordClusters: 0,
    contentGaps: 0,
    serpInsights: 0,
    seoScore: 0,
    latestAudit: null,
    history: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard/overview`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        const data = await response.json();
        if (response.ok) {
          console.log('[Dashboard] Data Received:', data);
          setDashboardData(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (authToken) {
      fetchDashboardData();
    }
  }, [authToken, API_BASE_URL]);

  const stats = [
    {
      label: 'Overall SEO Score',
      value: dashboardData.latestAudit ? `${dashboardData.latestAudit.score}/100` : 'N/A',
      icon: 'fa-chart-line',
      color: '#10b981',
      trend: dashboardData.latestAudit?.scoreTrend || ''
    },
    {
      label: 'Ranking Keywords',
      value: dashboardData.latestAudit ? dashboardData.latestAudit.rankingKeywords.toLocaleString() : '0',
      icon: 'fa-key',
      color: '#6366f1',
      trend: dashboardData.latestAudit?.rankingKeywordsTrend || ''
    },
    {
      label: 'Total Backlinks',
      value: dashboardData.latestAudit ? dashboardData.latestAudit.totalBacklinks.toLocaleString() : '0',
      icon: 'fa-link',
      color: '#06b6d4',
      trend: dashboardData.latestAudit?.totalBacklinksTrend || ''
    },
    {
      label: 'Monthly Traffic',
      value: dashboardData.latestAudit ? dashboardData.latestAudit.monthlyTraffic : '0',
      icon: 'fa-users',
      color: '#f59e0b',
      trend: dashboardData.latestAudit?.monthlyTrafficTrend || ''
    },
  ];

  const recentActivity = [
    { id: 1, action: 'SEO Audit completed', site: dashboardData.latestAudit?.url || 'No recent audits', time: dashboardData.latestAudit ? new Date(dashboardData.latestAudit.timestamp).toLocaleDateString() : '', status: dashboardData.latestAudit ? 'Success' : 'None' },
    { id: 2, action: 'Keyword Research', site: 'Wait for activity...', time: '', status: 'None' },
    { id: 3, action: 'Content Gap Analysis', site: 'Wait for activity...', time: '', status: 'None' },
  ];

  // Process and format history data for the chart
  const formattedHistory = (dashboardData.history || []).map((item, index) => {
    try {
      const d = item.createdAt ? new Date(item.createdAt) : null;
      if (!d || isNaN(d.getTime())) {
        return { ...item, date: `Audit #${index + 1}`, score: item.score || 0 };
      }
      return {
        ...item,
        date: `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
        score: item.score || 0
      };
    } catch (e) {
      return { ...item, date: `Audit #${index + 1}`, score: 0 };
    }
  });

  const chartData = (formattedHistory.length > 0) ? formattedHistory : [
    { date: 'Mon', score: 65 },
    { date: 'Tue', score: 70 },
    { date: 'Wed', score: 68 },
    { date: 'Thu', score: 72 },
    { date: 'Fri', score: 80 },
    { date: 'Sat', score: 84 },
    { date: 'Sun', score: 84 },
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Analyzing your SEO ecosystem...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page page-section active">
      <header className="dashboard-header">
        <div className="welcome-text">
          <h1>Welcome back, {currentUser?.name || 'User'}!</h1>
          <p>
            {dashboardData.latestAudit
              ? `Showing latest analysis for: ${dashboardData.latestAudit.url}`
              : "No audit data found. Perform your first SEO audit to see your stats here."}
          </p>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={() => window.location.reload()}>
            <i className="fas fa-sync"></i> Sync Data
          </button>

        </div>
      </header>

      <div className="stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card card">
            <div className="stat-icon" style={{ backgroundColor: `${stat.color}15`, color: stat.color }}>
              <i className={`fas ${stat.icon}`}></i>
            </div>
            <div className="stat-info">
              <span className="stat-label">{stat.label}</span>
              <div className="stat-value-group">
                <span className="stat-value">{stat.value}</span>
                <span className="stat-trend" style={{ color: stat.trend.startsWith('+') ? '#10b981' : '#ef4444' }}>
                  {stat.trend}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="grid-main">
          <div className="card main-chart-card">
            <div className="card-header">
              <h3>SEO Score Progression</h3>
              <div className="chart-filters">
                <button className="btn-glass active">Last 10 Audits</button>
              </div>
            </div>
            <div className="chart-container" style={{ width: '100%', height: '300px', marginTop: '20px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={15}
                    padding={{ left: 10, right: 10 }}
                  />
                  <YAxis
                    stroke="rgba(255,255,255,0.4)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
                      backdropFilter: 'blur(8px)'
                    }}
                    itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                    labelStyle={{ color: 'rgba(255,255,255,0.5)', marginBottom: '4px', fontSize: '11px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#10b981"
                    strokeWidth={4}
                    fillOpacity={1}
                    fill="url(#colorScore)"
                    animationDuration={1500}
                    dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#1e293b' }}
                    activeDot={{ r: 6, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid-side">
          <div className="card activity-card">
            <div className="card-header">
              <h3>Recent Activity</h3>
              <a href="#" className="view-all">View All</a>
            </div>
            <div className="activity-list">
              {recentActivity.map((item) => (
                <div key={item.id} className="activity-item">
                  <div className="activity-icon">
                    <i className="fas fa-history"></i>
                  </div>
                  <div className="activity-details">
                    <div className="activity-title">{item.action}</div>
                    <div className="activity-meta">
                      <span>{item.site}</span> • <span>{item.time}</span>
                    </div>
                  </div>
                  <div className={`activity-status ${item.status.toLowerCase().replace(' ', '-')}`}>
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card quick-actions-card">
            <div className="card-header">
              <h3>Quick Actions</h3>
            </div>
            <div className="quick-actions-grid">
              <button className="action-btn" onClick={() => onNavigate('keyword-research')}>
                <i className="fas fa-search"></i>
                <span>Keyword</span>
              </button>
              <button className="action-btn" onClick={() => onNavigate('seo-audit')}>
                <i className="fas fa-file-medical"></i>
                <span>SEO Audit</span>
              </button>
              <button className="action-btn" onClick={() => onNavigate('content-gap')}>
                <i className="fas fa-spell-check"></i>
                <span>Content</span>
              </button>
              <button className="action-btn" onClick={() => onNavigate('reports')}>
                <i className="fas fa-chart-bar"></i>
                <span>Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
