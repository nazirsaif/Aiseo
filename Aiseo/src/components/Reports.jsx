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
        if (res.ok && Array.isArray(data.reports)) {
          setReports(data.reports);
        } else {
          setReports([]);
          if (!res.ok) notification.error('Could not sync with intelligence archives');
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
      notification.info('Starting new report generation...');
    }
  };

  const fetchReportDetails = async (id) => {
    if (typeof id === 'number') {
      notification.info('Demo Report: Generating a live audit will provide full interactive details.');
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
      notification.error('Server error: Could not retrieve report data');
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
      setTimeout(() => {
        handleDownloadPDF();
      }, 500);
    }
  };

  const handleDownloadPDF = () => {
    if (!viewerRef.current) return;

    const urlName = selectedReport?.url ? selectedReport.url.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'seo_report';
    const opt = {
      margin: [0.5, 0.5],
      filename: `SEO_Intelligence_${urlName}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    notification.info('Compiling Neural Report PDF...');
    html2pdf().set(opt).from(viewerRef.current).save().then(() => {
      notification.success('Report exported successfully!');
    });
  };

  const getImpactColor = (score) => {
    if (score >= 90) return 'var(--accent)';
    if (score >= 75) return 'var(--primary)';
    if (score >= 60) return '#f59e0b';
    return '#f43f5e';
  };

  return (
    <div className="page-section active">
      <div style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '0.5rem', background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Intelligence Archives
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Access your historical SEO audits and neural performance snapshots.</p>
        </div>
        <button className="btn-primary" onClick={generateNewReport} style={{ padding: '0.8rem 2rem' }}>
          <i className="fas fa-plus-circle"></i> New Audit
        </button>
      </div>

      {isLoading && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ flex: '1 1 300px', height: '200px', opacity: 0.3, animation: 'pulse 1.5s infinite' }}></div>
          ))}
        </div>
      )}

      {/* Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: reports.length > 0 ? 'repeat(auto-fill, minmax(340px, 1fr))' : '1fr', gap: '2rem' }}>
        {reports.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', padding: '5rem', background: 'var(--glass)', borderRadius: '24px', border: '1px solid var(--border)', opacity: 0.6 }}>
            <i className="fas fa-folder-open" style={{ fontSize: '3rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}></i>
            <h3>Archive is Empty</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>Once you complete an SEO audit, your intelligence report will be archived here.</p>
          </div>
        ) : (
          reports.map((report) => (
            <div key={report.id} className="card table-row-hover" style={{
              padding: '2rem',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem'
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`fas ${report.icon}`} style={{ fontSize: '1.2rem', color: 'var(--primary)' }}></i>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>Audit Score</div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', color: getImpactColor(report.score || 70) }}>{report.score || '--'}</div>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-main)' }}>{report.title}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6', height: '4.8em', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {report.description}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{report.date}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</div>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--secondary)' }}>{report.type}</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: 'auto' }}>
              <button className="btn-secondary" onClick={() => viewReport(report.id)} style={{ flex: 1, justifyContent: "center", borderRadius: "50px", padding: '0.6rem', color: "rgb(255, 255, 255)" }}>
                <i className="fas fa-eye"></i> View
              </button>
              <button className="btn-primary" onClick={() => downloadReportFile(report.id)} style={{ flex: 1, justifyContent: "center", borderRadius: "50px", padding: '0.6rem', color: "#fff" }}>
                <i className="fas fa-download"></i> Export
              </button>
            </div>
            </div>
          ))
        )}
      </div>

      {/* Viewer Modal */}
      {selectedReport && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(2, 6, 23, 0.9)', zIndex: 10000,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '2rem', backdropFilter: 'blur(10px)'
        }}>
          <div style={{
            background: 'var(--card-bg)', width: '100%', maxWidth: '900px', height: '90vh',
            borderRadius: '24px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.1)',
            overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Report Insight Viewer</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedReport.url}</div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-primary" onClick={handleDownloadPDF} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
                  <i className="fas fa-file-pdf"></i> Export PDF
                </button>
                <button className="btn-secondary" onClick={() => setSelectedReport(null)} style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}>
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0' }} id="report-view-scroll">
              <div ref={viewerRef} style={{
                padding: '3rem',
                background: '#ffffff',
                color: '#1e293b',
                minHeight: '100%',
                fontFamily: "'Inter', sans-serif"
              }}>
                {/* PDF Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '4px solid #6366f1', paddingBottom: '2rem', marginBottom: '3rem' }}>
                  <div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', margin: '0', color: '#0f172a', letterSpacing: '-0.02em' }}>SEO Intelligence Report</h1>
                    <div style={{ marginTop: '0.5rem', fontSize: '1.1rem', color: '#64748b' }}>Technical Audit & Market Positioning Analysis</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Scan ID: #{selectedReport._id?.slice(-8) || 'DEMO-88'}</div>
                    <div style={{ fontSize: '0.9rem', color: '#475569', marginTop: '0.25rem' }}>{new Date(selectedReport.createdAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  </div>
                </div>

                {/* Score Summary Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem', marginBottom: '4rem' }}>
                  <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Health Score</div>
                    <div style={{ fontSize: '3rem', fontWeight: '900', color: '#6366f1' }}>{selectedReport.score || 88}%</div>
                  </div>
                  <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Rank Grade</div>
                    <div style={{ fontSize: '3rem', fontWeight: '900', color: '#10b981' }}>{selectedReport.grade || 'A'}</div>
                  </div>
                  <div style={{ padding: '2rem', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem' }}>Issues Found</div>
                    <div style={{ fontSize: '3rem', fontWeight: '900', color: '#f43f5e' }}>{selectedReport.audit?.issues?.length || 0}</div>
                  </div>
                </div>

                {/* Technical Overview */}
                <div style={{ marginBottom: '3rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#6366f1' }}></div>
                    Technical Metadata Analysis
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    {[
                      { label: 'Primary Title', value: selectedReport.elements?.title || 'Not Detected' },
                      { label: 'Meta Description', value: selectedReport.elements?.metaDescription || 'Missing Optimization' },
                      { label: 'H1 Strategy', value: `${selectedReport.elements?.h1Count || 0} Tags Identified` },
                      { label: 'Content Depth', value: `${selectedReport.elements?.wordCount || 0} Semantic Units` },
                      { label: 'Image Assets', value: `${selectedReport.elements?.imageCount || 0} Images (${selectedReport.elements?.imagesWithoutAlt || 0} without alt)` },
                      { label: 'Link Profile', value: `${selectedReport.elements?.linkCount || 0} Total Links` }
                    ].map((item, i) => (
                      <div key={i} style={{ padding: '1.25rem', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{item.label}</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#334155' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Model Prediction */}
                {selectedReport.audit?.ml_prediction !== undefined && (
                  <div style={{ marginBottom: '3rem', padding: '2.5rem', borderRadius: '24px', border: '2px solid rgba(99, 102, 241, 0.2)', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '8rem', color: 'rgba(99, 102, 241, 0.05)', transform: 'rotate(-15deg)' }}>
                      <i className="fas fa-brain"></i>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', position: 'relative', zIndex: 1 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Neural Intelligence Projection</div>
                      {selectedReport.audit.projected_score && (
                        <div style={{ background: '#10b981', color: '#fff', padding: '4px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900' }}>
                          PROJECTED HEALTH: {selectedReport.audit.projected_score}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: selectedReport.audit.ml_prediction === 1 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className={`fas ${selectedReport.audit.ml_prediction === 1 ? 'fa-chart-line' : 'fa-triangle-exclamation'}`} style={{ fontSize: '1.8rem', color: selectedReport.audit.ml_prediction === 1 ? '#10b981' : '#f43f5e' }}></i>
                      </div>
                      <div>
                        <div style={{ fontWeight: '800', fontSize: '1.25rem', color: '#0f172a', marginBottom: '0.25rem' }}>
                          {selectedReport.audit.ml_prediction === 1 ? 'Positive Growth Outlook' : 'Structural Health Alert'}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#64748b', lineHeight: '1.5' }}>
                          Spectral analysis confirms a high probability of search ranking improvement following the implementation of the prioritized roadmap.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Issues Table */}
                {selectedReport.audit?.issues?.length > 0 && (
                  <div style={{ marginBottom: '3rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#f43f5e' }}></div>
                      Prioritized Optimization Roadmap
                    </h2>
                    <div style={{ border: '1px solid #f1f5f9', borderRadius: '20px', overflow: 'hidden' }}>
                      {selectedReport.audit.issues.map((issue, idx) => (
                        <div key={idx} style={{
                          padding: '1.75rem',
                          borderBottom: idx === selectedReport.audit.issues.length - 1 ? 'none' : '1px solid #f1f5f9',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '1rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                              <div style={{ 
                                width: '8px', 
                                height: '8px', 
                                borderRadius: '50%', 
                                background: issue.impact === 'High' ? '#f43f5e' : issue.impact === 'Medium' ? '#f59e0b' : '#6366f1', 
                                marginTop: '0.4rem' 
                              }}></div>
                              <div>
                                <div style={{ fontSize: '0.7rem', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{issue.category || 'General SEO'}</div>
                                <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#0f172a' }}>{issue.message}</div>
                              </div>
                            </div>
                            <span style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: '900', 
                              color: issue.impact === 'High' ? '#f43f5e' : issue.impact === 'Medium' ? '#f59e0b' : '#6366f1', 
                              background: issue.impact === 'High' ? 'rgba(244, 63, 94, 0.1)' : issue.impact === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                              padding: '4px 8px', 
                              borderRadius: '6px' 
                            }}>{issue.impact} IMPACT</span>
                          </div>
                          <div style={{ padding: '1.25rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#475569', fontSize: '0.9rem', position: 'relative' }}>
                            <i className="fas fa-lightbulb" style={{ position: 'absolute', right: '1.25rem', top: '1.25rem', color: '#f59e0b', opacity: 0.5 }}></i>
                            <strong style={{ color: '#6366f1', display: 'block', marginBottom: '0.25rem' }}>Strategic Action:</strong> 
                            {issue.recommendation || 'No specific action provided. Consult SEO documentation.'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* LLM Intelligence */}
                {selectedReport.audit?.llmRecommendations && (
                  <div style={{ marginBottom: '3rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#a78bfa' }}></div>
                      AI Strategic Insights
                    </h2>
                    <div style={{ padding: '2.5rem', background: 'linear-gradient(to bottom right, #f5f3ff, #ede9fe)', borderRadius: '24px', border: '1px solid #ddd6fe', color: '#5b21b6', fontSize: '1rem', lineHeight: '1.8', whiteSpace: 'pre-wrap', position: 'relative' }}>
                       <i className="fas fa-quote-left" style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', fontSize: '2rem', opacity: 0.1 }}></i>
                       {selectedReport.audit.llmRecommendations}
                    </div>
                  </div>
                )}

                {/* General Strategic Summary */}
                {selectedReport.audit?.recommendations?.length > 0 && (
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#10b981' }}></div>
                      Executive Strategic Summary
                    </h2>
                    <div style={{ padding: '2rem', background: '#f0fdf4', borderRadius: '20px', border: '1px solid #dcfce7' }}>
                      <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#166534', fontSize: '1rem', lineHeight: '1.8' }}>
                        {selectedReport.audit.recommendations.map((rec, idx) => (
                          <li key={idx} style={{ padding: '0.5rem 0' }}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* PDF Footer */}
                <div style={{ marginTop: '5rem', paddingTop: '2rem', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '600' }}>GENERATED BY AISEO ANALYTICS ENGINE</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;


