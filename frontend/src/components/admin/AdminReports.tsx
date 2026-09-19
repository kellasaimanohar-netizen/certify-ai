import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Code,
  ShieldCheck,
  Search,
  RefreshCw,
  Eye,
  Filter
} from 'lucide-react';
import { generatePDFReport } from '../../utils/pdfExport';

interface AdminReportsProps {
  onViewTestDetails: (testId: number) => void;
}

export const AdminReports: React.FC<AdminReportsProps> = ({
  onViewTestDetails
}) => {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');

  // Export filters
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [exportDateFilter, setExportDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');

  const BACKEND_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '' ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/reports`);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('Failed to load admin reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDownloadPDF = async (reportId: number, agentName: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/tests/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        const fullObj = data.test.full_result || data.test;
        const doc = generatePDFReport(fullObj);
        doc.save(`${agentName}_audit_report.pdf`);
      }
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  const handleDownloadJSON = async (reportId: number, agentName: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/tests/${reportId}`);
      if (res.ok) {
        const data = await res.json();
        const fullObj = data.test.full_result || data.test;
        const blob = new Blob([JSON.stringify(fullObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${agentName}_audit_report.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to export JSON:', err);
    }
  };

  const handleExportAll = () => {
    let exportUrl = `${BACKEND_URL}/api/admin/reports/export?format=${exportFormat}`;
    if (exportDateFilter !== 'all') exportUrl += `&date_filter=${exportDateFilter}`;
    if (selectedUserFilter !== 'all') exportUrl += `&user=${encodeURIComponent(selectedUserFilter)}`;
    if (selectedStatusFilter !== 'all') exportUrl += `&status=${encodeURIComponent(selectedStatusFilter)}`;

    window.open(exportUrl, '_blank');
  };

  const filteredReports = reports.filter(r => {
    const matchSearch = r.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.tested_by_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        r.audit_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUser = selectedUserFilter === 'all' || r.tested_by_name.toLowerCase() === selectedUserFilter.toLowerCase();
    const matchStatus = selectedStatusFilter === 'all' || r.tier === selectedStatusFilter;
    return matchSearch && matchUser && matchStatus;
  });

  return (
    <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
            Organization Reports & Audit Exports
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Supervise, download, and export all enterprise AI certification audit reports for regulatory filings.
          </p>
        </div>

        {/* 1-Click Export Section */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.25)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Export Format:</span>
          <button
            className={`btn ${exportFormat === 'csv' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setExportFormat('csv'); handleExportAll(); }}
            style={{ padding: '4px 10px', fontSize: '11.5px' }}
          >
            <Download size={12} />
            <span>CSV</span>
          </button>
          <button
            className={`btn ${exportFormat === 'json' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setExportFormat('json'); handleExportAll(); }}
            style={{ padding: '4px 10px', fontSize: '11.5px' }}
          >
            <Code size={12} />
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="glass-card" style={{ padding: '14px 20px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search report, agent, or tester..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '13px' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'CERTIFIED', 'CONDITIONAL', 'NOT_CERTIFIED'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSelectedStatusFilter(s)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '600',
                border: 'none',
                background: selectedStatusFilter === s ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: selectedStatusFilter === s ? '#fff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              {s === 'all' ? 'All' : s === 'CERTIFIED' ? 'Certified' : s === 'CONDITIONAL' ? 'Conditional' : 'Not Certified'}
            </button>
          ))}
        </div>
      </div>

      {/* Reports Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Report / ID</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Agent Name</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Tested By</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Date</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Score</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={18} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    Loading all enterprise reports...
                  </td>
                </tr>
              ) : filteredReports.length > 0 ? (
                filteredReports.map((report) => {
                  const isCertified = report.tier === 'CERTIFIED';
                  const isConditional = report.tier === 'CONDITIONAL';

                  return (
                    <tr
                      key={report.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)' }}>
                        {report.audit_id}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{report.agent_name}</span>
                          {report.version && (
                            <span style={{
                              padding: '1px 6px',
                              borderRadius: '8px',
                              fontSize: '10.5px',
                              fontWeight: '800',
                              background: 'rgba(0, 240, 255, 0.15)',
                              color: 'var(--accent-cyan)',
                              border: '1px solid rgba(0, 240, 255, 0.3)'
                            }}>
                              {report.version}
                            </span>
                          )}
                          {report.is_latest && (
                            <span style={{
                              padding: '1px 5px',
                              borderRadius: '4px',
                              fontSize: '9px',
                              fontWeight: '700',
                              background: 'rgba(46, 204, 113, 0.15)',
                              color: '#2ecc71',
                              textTransform: 'uppercase'
                            }}>
                              Latest
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{report.tested_by_name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({report.tested_by_email})</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                        {new Date(report.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontWeight: '800',
                            color: isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c'
                          }}>
                            {report.trust_score}%
                          </span>
                          {report.score_delta !== undefined && report.score_delta !== 0 && (
                            <span style={{
                              fontSize: '10.5px',
                              fontWeight: '700',
                              color: report.score_delta > 0 ? '#2ecc71' : '#e74c3c'
                            }}>
                              {report.score_delta > 0 ? `+${report.score_delta}%` : `${report.score_delta}%`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`status-pill ${report.tier.toLowerCase()}`} style={{ fontSize: '10.5px' }}>
                          {report.tier}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => onViewTestDetails(report.id)}
                            style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-cyan)' }}
                            title="View Full Test Details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleDownloadPDF(report.id, report.agent_name)}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            title="Download PDF"
                          >
                            <Download size={13} />
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleDownloadJSON(report.id, report.agent_name)}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            title="Download JSON"
                          >
                            <Code size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No reports match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
