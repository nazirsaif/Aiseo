import React, { useEffect, useState, useRef } from 'react';
import notification from '../utils/notification';
import html2pdf from 'html2pdf.js';

const Reports = ({ authToken, API_BASE_URL, onNavigate }) => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const viewerRef = useRef(null);

  useEffect(() => {
    if (!authToken) return;

    const loadReports = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/reports`, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.reports) && data.reports.length > 0) {
          setReports(data.reports);
        } else {
          // Fallback to demo reports if no real data yet
          setReports([
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
          ]);
        }
      } catch (err) {
        console.error('Failed to load reports', err);
      }
    };

    loadReports();
  }, [authToken, API_BASE_URL]);

  const generateNewReport = () => {
    if (onNavigate) {
      onNavigate('seo-audit');
    } else {
      notification.info('Starting new report generation... This may take a few minutes.');
    }
  };

  const fetchReportDetails = async (id) => {
    if (typeof id === 'number') {
      notification.info('This is a demo report. Generate a real report to view its specific details.');
      return null;
    }
    
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/seo-audit/${id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      setIsLoading(false);
      
      if (res.ok) {
        return data;
      } else {
        notification.error('Failed to fetch full report details');
        return null;
      }
    } catch (err) {
      console.error(err);
      notification.error('Error connecting to the server');
      setIsLoading(false);
      return null;
    }
  };

  const viewReport = async (id) => {
    const reportData = await fetchReportDetails(id);
    if (reportData) {
      setSelectedReport(reportData);
    }
  };

  const downloadReportFile = async (id) => {
    let reportData = await fetchReportDetails(id);
    if (reportData) {
      setSelectedReport(reportData);
      
      // Wait roughly for React to render the modal, then trigger PDF gen
      setTimeout(() => {
        handleDownloadPDF();
      }, 500);
    }
  };

  const handleDownloadPDF = () => {
    if (!viewerRef.current) return;
    
    const urlName = selectedReport?.url ? selectedReport.url.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'report';
    const opt = {
      margin:       0.5,
      filename:     `SEO_Report_${urlName}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    notification.info('Generating PDF document...');
    html2pdf().set(opt).from(viewerRef.current).save().then(() => {
        notification.success('Report downloaded successfully!');
    });
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#2ecc71';
    if (score >= 80) return '#3498db';
    if (score >= 70) return '#f39c12';
    if (score >= 60) return '#e67e22';
    return '#e74c3c';
  };

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

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
        </div>
      )}

      {selectedReport && (
        <div className="report-modal" style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '2rem'
        }}>
          <div style={{
            background: 'white', width: '100%', maxWidth: '800px', height: '90vh',
            borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', borderRadius: '12px 12px 0 0' }}>
              <h3 style={{ margin: 0 }}><i className="fas fa-file-alt"></i> Report Details</h3>
              <div>
                <button className="btn btn-primary" onClick={handleDownloadPDF} style={{ marginRight: '1rem', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>
                  <i className="fas fa-download"></i> Download PDF
                </button>
                <button className="btn btn-secondary" onClick={() => setSelectedReport(null)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}>
                  <i className="fas fa-times"></i> Close
                </button>
              </div>
            </div>
            
            <div style={{ padding: '2rem', overflowY: 'auto', flex: 1, backgroundColor: '#ffffff' }} id="pdf-container">
              <div ref={viewerRef} style={{ padding: '2rem', backgroundColor: '#ffffff', color: '#333' }}>
                <div style={{ borderBottom: '2px solid #3498db', paddingBottom: '1rem', marginBottom: '2rem' }}>
                  <h1 style={{ margin: '0 0 0.5rem 0', color: '#2c3e50' }}>SEO Insights Report</h1>
                  <p style={{ margin: 0, fontSize: '1.1rem', color: '#7f8c8d' }}>
                    <strong>Website:</strong> {selectedReport.url || 'N/A'}
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#95a5a6' }}>
                    <strong>Generated on:</strong> {new Date(selectedReport.createdAt || Date.now()).toLocaleString()}
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                  <div>
                    <h2 style={{ fontSize: '1.2rem', color: '#34495e', margin: '0 0 0.5rem 0' }}>Overall Performance</h2>
                    <p style={{ margin: 0, color: '#7f8c8d' }}>Aggregated results from the audit.</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: getScoreColor(selectedReport.score || (selectedReport.aggregate && selectedReport.aggregate.averageScore) || 0) }}>
                      {selectedReport.score || (selectedReport.aggregate && selectedReport.aggregate.averageScore) || 'N/A'}
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: getScoreColor(selectedReport.score || (selectedReport.aggregate && selectedReport.aggregate.averageScore) || 0) }}>
                      Grade {selectedReport.grade || (selectedReport.aggregate && selectedReport.aggregate.grade) || 'N/A'}
                    </div>
                  </div>
                </div>

                {selectedReport.elements && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ color: '#2c3e50', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>On-Page Elements</h3>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f2f6' }}><strong>Title:</strong> {selectedReport.elements.title || 'Missing'}</li>
                      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f2f6' }}><strong>Meta Description:</strong> {selectedReport.elements.metaDescription || 'Missing'}</li>
                      <li style={{ padding: '0.5rem 0', borderBottom: '1px solid #f1f2f6' }}><strong>H1 Tags:</strong> {selectedReport.elements.h1Count}</li>
                      <li style={{ padding: '0.5rem 0' }}><strong>Word Count:</strong> {selectedReport.elements.wordCount} words</li>
                    </ul>
                  </div>
                )}

                {(selectedReport.audit?.issues?.length > 0 || selectedReport.aggregate?.topIssues?.length > 0) && (
                  <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ color: '#e74c3c', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Technical Issues</h3>
                    {(selectedReport.audit?.issues || selectedReport.aggregate?.topIssues).slice(0, 10).map((issue, idx) => (
                      <div key={idx} style={{ padding: '0.8rem', marginBottom: '0.5rem', backgroundColor: '#fff5f5', borderLeft: '4px solid #e74c3c', borderRadius: '4px' }}>
                        <strong style={{ color: '#c0392b' }}>{issue.type || issue.issueType || 'Alert'}:</strong> {issue.message}
                      </div>
                    ))}
                  </div>
                )}

                {(selectedReport.audit?.recommendations?.length > 0 || selectedReport.aggregate?.recommendations?.length > 0) && (
                  <div>
                    <h3 style={{ color: '#27ae60', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Recommendations</h3>
                    <ul style={{ paddingLeft: '1.5rem', color: '#2c3e50' }}>
                      {(selectedReport.audit?.recommendations || selectedReport.aggregate?.recommendations).map((rec, idx) => (
                        <li key={idx} style={{ padding: '0.3rem 0' }}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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


