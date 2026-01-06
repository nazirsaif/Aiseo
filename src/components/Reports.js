import React from 'react';

const Reports = () => {
  const generateNewReport = () => {
    alert('Starting new report generation... This may take a few minutes.');
  };

  const viewReport = (id) => {
    alert('Opening report #' + id + ' in viewer...');
  };

  const downloadReportFile = (id) => {
    alert('Downloading report #' + id + '...');
  };

  const reports = [
    {
      id: 1,
      icon: 'fa-file-pdf',
      date: 'Oct 28, 2025',
      title: 'Monthly SEO Performance Report',
      type: 'Comprehensive',
      pages: 24,
      description: 'Complete analysis of keyword rankings, traffic trends, and competitor insights for October 2025.'
    },
    {
      id: 2,
      icon: 'fa-chart-bar',
      date: 'Oct 21, 2025',
      title: 'Keyword Gap Analysis',
      type: 'Detailed',
      pages: 18,
      description: 'Identified 45 keyword opportunities and content gaps compared to top 3 competitors.'
    },
    {
      id: 3,
      icon: 'fa-search',
      date: 'Oct 14, 2025',
      title: 'SERP Feature Analysis',
      type: 'Quick',
      pages: 12,
      description: 'Analysis of featured snippets, people also ask, and other SERP features for your keywords.'
    },
    {
      id: 4,
      icon: 'fa-users',
      date: 'Oct 7, 2025',
      title: 'Competitor Benchmarking',
      type: 'Strategic',
      pages: 30,
      description: 'In-depth comparison with 5 main competitors including backlink analysis and content strategy.'
    },
    {
      id: 5,
      icon: 'fa-lightbulb',
      date: 'Sep 30, 2025',
      title: 'Content Optimization Recommendations',
      type: 'Actionable',
      pages: 15,
      description: 'AI-powered suggestions for improving 20 underperforming pages with specific action items.'
    },
    {
      id: 6,
      icon: 'fa-mobile-alt',
      date: 'Sep 23, 2025',
      title: 'Technical SEO Audit',
      type: 'Technical',
      pages: 28,
      description: 'Complete technical audit covering site speed, mobile-friendliness, crawlability, and indexing issues.'
    }
  ];

  return (
    <div className="page-section active">
      <div className="input-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2><i className="fas fa-file-alt"></i> SEO Reports</h2>
          <button className="btn btn-primary" onClick={generateNewReport}>
            <i className="fas fa-plus"></i> Generate New Report
          </button>
        </div>
      </div>

      <div className="reports-grid">
        {reports.map((report) => (
          <div key={report.id} className="report-card">
            <div className="report-header">
              <div className="report-icon">
                <i className={`fas ${report.icon}`}></i>
              </div>
              <span className="report-date">{report.date}</span>
            </div>
            <h3 className="report-title">{report.title}</h3>
            <div className="report-meta">
              <span><i className="fas fa-chart-line"></i> {report.type}</span>
              <span><i className="fas fa-file"></i> {report.pages} pages</span>
            </div>
            <p style={{ color: '#666', fontSize: '0.9rem', margin: '1rem 0' }}>{report.description}</p>
            <div className="report-actions">
              <button className="btn btn-secondary" onClick={() => viewReport(report.id)}>
                <i className="fas fa-eye"></i> View
              </button>
              <button className="btn btn-primary" onClick={() => downloadReportFile(report.id)}>
                <i className="fas fa-download"></i> Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Reports;

