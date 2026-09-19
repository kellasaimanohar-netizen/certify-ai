import React from 'react';
import { Shield, Download, Search, ChevronUp, ChevronDown, ExternalLink, ShieldCheck, AlertTriangle, HelpCircle, FileJson, AlertCircle } from 'lucide-react';
import type { Finding } from '../mockData';

interface FindingsExplorerProps {
  filteredFindings: Finding[];
  expandedFinding: string | null;
  setExpandedFinding: (id: string | null) => void;
  expandedTechDetails: Record<string, boolean>;
  setExpandedTechDetails: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  severityFilter: string;
  setSeverityFilter: (filter: string) => void;
  handleDownloadReport: () => void;
  handleDownloadPDF?: () => void;
}

export const FindingsExplorer: React.FC<FindingsExplorerProps> = ({
  filteredFindings,
  expandedFinding,
  setExpandedFinding,
  expandedTechDetails,
  setExpandedTechDetails,
  searchTerm,
  setSearchTerm,
  severityFilter,
  setSeverityFilter,
  handleDownloadReport,
  handleDownloadPDF,
}) => {
  return (
    <div className="glass-card" style={{ gap: '20px' }}>
      <div className="glass-card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', border: 'none', padding: 0, margin: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 className="glass-card-title">
            <Shield size={16} style={{ color: 'var(--accent-primary)' }} /> 
            Rule Findings Explorer
          </h3>
          <button 
            onClick={handleDownloadReport}
            className="btn btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '11.5px',
              height: '32px',
              borderRadius: 'var(--radius-sm)'
            }}
            title="Download Report JSON for Developers"
          >
            <FileJson size={13} /> Export JSON
          </button>
          
          {handleDownloadPDF && (
            <button 
              onClick={handleDownloadPDF}
              className="btn btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '11.5px',
                height: '32px',
                borderRadius: 'var(--radius-sm)'
              }}
              title="Download Branded PDF Security Report"
            >
              <Download size={13} /> Export PDF
            </button>
          )}
        </div>
        
        {/* Search and Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
          <div className="search-input-wrapper" style={{ maxWidth: '200px', flex: 1, minWidth: '130px' }}>
            <Search size={14} />
            <input 
              type="text" 
              className="search-field"
              placeholder="Search rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ height: '32px', borderRadius: 'var(--radius-sm)' }}
            />
          </div>
          
          <div className="quick-severity-pills">
            <button className={`quick-pill ${severityFilter === 'all' ? 'active' : ''}`} onClick={() => setSeverityFilter('all')}>All</button>
            <button className={`quick-pill ${severityFilter === 'critical' ? 'active' : ''}`} onClick={() => setSeverityFilter('critical')}>Critical</button>
            <button className={`quick-pill ${severityFilter === 'warning' ? 'active' : ''}`} onClick={() => setSeverityFilter('warning')}>Warning</button>
            <button className={`quick-pill ${severityFilter === 'pass' ? 'active' : ''}`} onClick={() => setSeverityFilter('pass')}>Pass</button>
            <button className={`quick-pill ${severityFilter === 'skipped' ? 'active' : ''}`} onClick={() => setSeverityFilter('skipped')}>Skipped</button>
          </div>
        </div>
      </div>

      {/* Findings list */}
      <div className="findings-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredFindings.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '13.5px', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-panel-hover)' }}>
            <HelpCircle size={28} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto' }} />
            No findings match the current search or filters.
          </div>
        ) : (
          filteredFindings.map(f => {
            const isExpanded = expandedFinding === f.id;
            const isTechExpanded = !!expandedTechDetails[f.id];
            const severityClass = f.passed ? 'pass' : f.severity.toLowerCase();
            
            // Icon Selector based on state
            let StatusIcon = ShieldCheck;
            let iconColor = 'var(--color-pass)';
            
            if (!f.passed) {
              if (f.severity === 'CRITICAL') {
                StatusIcon = AlertCircle;
                iconColor = 'var(--color-critical)';
              } else if (f.severity === 'WARNING') {
                StatusIcon = AlertTriangle;
                iconColor = 'var(--color-warning)';
              } else {
                StatusIcon = AlertCircle;
                iconColor = 'var(--color-info)';
              }
            }

            return (
              <div key={f.id} className={`finding-card-v2 ${severityClass}`} style={{
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                borderLeft: `4px solid ${iconColor}`,
                backgroundColor: isExpanded ? 'var(--bg-panel-hover)' : 'var(--bg-panel)',
                transition: 'all var(--transition-fast)',
                overflow: 'hidden',
                maxWidth: '100%',
                minWidth: 0
              }}>
                {/* Header clickable */}
                <div 
                  className="finding-card-header"
                  onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    gap: '12px'
                  }}
                >
                  <div className="finding-header-info" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                    <StatusIcon size={16} style={{ color: iconColor, flexShrink: 0 }} />
                    <span className="finding-pill-status" style={{
                      fontSize: '9.5px',
                      fontWeight: '700',
                      padding: '2.5px 7px',
                      borderRadius: 'var(--radius-xs)',
                      background: f.passed ? 'var(--color-pass-bg)' : f.severity === 'CRITICAL' ? 'var(--color-critical-bg)' : 'var(--color-warning-bg)',
                      color: iconColor,
                      flexShrink: 0
                    }}>
                      {f.passed ? 'PASS' : f.severity}
                    </span>
                    <span className="finding-id-mono" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', flexShrink: 0 }}>
                      {f.id}
                    </span>
                    <span className="finding-title-text" style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.title}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span className="finding-phase-tag" style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-panel)',
                      border: '1px solid var(--border-subtle)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-xs)',
                      textTransform: 'uppercase',
                      fontWeight: '600'
                    }}>
                      {f.phase}
                    </span>
                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {/* Expandable details */}
                {isExpanded && (
                  <div className="finding-card-body" style={{
                    padding: '20px 24px',
                    borderTop: '1px solid var(--border-subtle)',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    <div className="finding-body-section">
                      <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: '700', marginBottom: '4px' }}>Description</h4>
                      <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{f.description}</p>
                    </div>

                    {!f.passed && f.remediation && (
                      <div className="finding-body-section remediation-box" style={{
                        backgroundColor: 'var(--color-critical-bg)',
                        borderLeft: '3px solid var(--color-critical)',
                        padding: '12px 16px',
                        borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                        marginTop: '4px'
                      }}>
                        <h4 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--color-critical)', letterSpacing: '0.05em', fontWeight: '700', marginBottom: '4px' }}>Remediation Guidance</h4>
                        <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', fontWeight: '500', lineHeight: '1.5' }}>{f.remediation}</p>
                      </div>
                    )}

                    {/* Technical Details Accordion */}
                    <div className="tech-details-container" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '4px' }}>
                      <button 
                        className="tech-details-toggle-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTechDetails(prev => ({
                            ...prev,
                            [f.id]: !prev[f.id]
                          }));
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: '600',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: 'var(--radius-xs)',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        {isTechExpanded ? 'Hide Compliance Metadata' : 'View Standards, CWEs & Evidence'}
                        <ChevronDown size={12} style={{ transform: isTechExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                      </button>

                      {isTechExpanded && (
                        <div className="tech-details-content animate-slideup" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                          <div className="tech-details-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            {/* Standards Mapping */}
                            <div>
                              <h5 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Regulatory Standards</h5>
                              <div className="tech-standards-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {f.standards && f.standards.length > 0 ? (
                                  f.standards.map((std, idx) => (
                                    <a 
                                      key={idx}
                                      href={std.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="standard-link-badge"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 8px',
                                        borderRadius: 'var(--radius-xs)',
                                        border: '1px solid var(--border-subtle)',
                                        backgroundColor: 'var(--bg-panel)',
                                        fontSize: '11.5px',
                                        color: 'var(--text-secondary)',
                                        transition: 'all var(--transition-fast)'
                                      }}
                                    >
                                      <span style={{ color: 'var(--accent-cyan)', fontWeight: '600' }}>{std.framework.replace(/_/g, ' ').toUpperCase()}</span>
                                      <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{std.identifier}</strong>
                                      <ExternalLink size={10} style={{ opacity: 0.6 }} />
                                    </a>
                                  ))
                                ) : (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No standard mappings</span>
                                )}
                              </div>
                            </div>

                            {/* CWE and MITRE ATLAS */}
                            <div>
                              <h5 style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Vulnerability Frameworks</h5>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {f.cwe && f.cwe.map(c => (
                                  <span key={c} className="vuln-cwe-badge" style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '10.5px',
                                    color: 'var(--accent-purple)',
                                    background: 'rgba(139, 92, 246, 0.08)',
                                    border: '1px solid rgba(139, 92, 246, 0.2)',
                                    padding: '3px 7px',
                                    borderRadius: 'var(--radius-xs)'
                                  }}>{c}</span>
                                ))}
                                {f.mitre_atlas && f.mitre_atlas.map(m => (
                                  <span key={m} className="vuln-mitre-badge" style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '10.5px',
                                    color: 'var(--accent-cyan)',
                                    background: 'var(--color-info-bg)',
                                    border: '1px solid var(--color-info-border)',
                                    padding: '3px 7px',
                                    borderRadius: 'var(--radius-xs)'
                                  }}>{m}</span>
                                ))}
                                {(!f.cwe || f.cwe.length === 0) && (!f.mitre_atlas || f.mitre_atlas.length === 0) && (
                                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None mapped</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Evidence logs */}
                          {f.evidence && f.evidence.length > 0 && (
                            <div className="tech-evidence-log" style={{
                              backgroundColor: 'var(--bg-terminal)',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '12px 16px'
                            }}>
                              <div className="evidence-header-v2" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                paddingBottom: '6px',
                                marginBottom: '8px'
                              }}>
                                <span>DIAGNOSTIC EVIDENCE LOG</span>
                                {f.evidence.some(ev => ev.redacted) && <span className="redacted-warn" style={{ color: 'var(--color-critical)', fontWeight: '700' }}>[PII REDACTED]</span>}
                              </div>
                              <pre className="evidence-code" style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11.5px',
                                color: '#a5b4fc',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                maxHeight: '160px',
                                overflowY: 'auto',
                                lineHeight: '1.5'
                              }}>
                                {f.evidence.map((ev) => `[${ev.kind}] ${ev.content}`).join('\n')}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
