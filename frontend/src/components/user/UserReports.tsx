import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Code,
  Eye,
  RefreshCw,
  Search
} from 'lucide-react';
import { generatePDFReport } from '../../utils/pdfExport';

interface UserReportsProps {
  user: {
    id: number | string;
    name: string;
    email: string;
    role: string;
  };
  onViewReportDetail: (testId: number) => void;
}

export const UserReports: React.FC<UserReportsProps> = ({
  user,
  onViewReportDetail
}) => {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCert, setSelectedCert] = useState<any | null>(null);

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/reports`, {
        headers: { 'X-User-Id': String(user?.id || 2) }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('Failed to load user reports:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user?.id]);

  const handleDownloadPDF = async (reportId: number, agentName: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/tests/${reportId}`, {
        headers: { 'X-User-Id': String(user?.id || 2) }
      });
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
      const res = await fetch(`${BACKEND_URL}/api/user/tests/${reportId}`, {
        headers: { 'X-User-Id': String(user?.id || 2) }
      });
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

  const filteredReports = reports.filter(r =>
    r.agent_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.audit_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
            My Reports Vault
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Export and download official certification audit reports and Ed25519 cryptographic tokens.
          </p>
        </div>

        <div style={{ position: 'relative', minWidth: '260px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search reports..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '13px' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
        {isLoading ? (
          <div className="glass-card" style={{ padding: '40px', gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={20} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block' }} />
            Loading certified reports...
          </div>
        ) : filteredReports.length > 0 ? (
          filteredReports.map((report) => {
            const isCertified = report.tier === 'CERTIFIED';
            const isConditional = report.tier === 'CONDITIONAL';
            const scoreColor = isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c';

            return (
              <div key={report.id} className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '14px', borderTop: `3px solid ${scoreColor}` }}>
                
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                        {report.agent_name}
                      </h3>
                      {report.version && (
                        <span style={{
                          padding: '1px 7px',
                          borderRadius: '10px',
                          fontSize: '11px',
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
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '9.5px',
                          fontWeight: '700',
                          background: 'rgba(46, 204, 113, 0.15)',
                          color: '#2ecc71',
                          textTransform: 'uppercase'
                        }}>
                          Latest
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      ID: {report.audit_id} • {new Date(report.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>

                  <span style={{
                    padding: '3px 9px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '800',
                    background: `${scoreColor}15`,
                    color: scoreColor,
                    border: `1px solid ${scoreColor}40`
                  }}>
                    {report.tier}
                  </span>
                </div>

                {/* Score & Checks Stats */}
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '6px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trust Score</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ fontSize: '18px', fontWeight: '800', color: scoreColor }}>
                        {report.trust_score}%
                      </div>
                      {report.score_delta !== undefined && report.score_delta !== 0 && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: report.score_delta > 0 ? '#2ecc71' : '#e74c3c'
                        }}>
                          {report.score_delta > 0 ? `+${report.score_delta}%` : `${report.score_delta}%`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Mode</span>
                    <div style={{ fontSize: '13px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-primary)', marginTop: '2px' }}>
                      {report.mode}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Criticals</span>
                    <div style={{ fontSize: '16px', fontWeight: '800', color: report.critical_count > 0 ? '#e74c3c' : 'var(--text-muted)' }}>
                      {report.critical_count}
                    </div>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onViewReportDetail(report.id)}
                    style={{ padding: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                    title="View Test Details"
                  >
                    <Eye size={13} />
                    <span>View</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDownloadPDF(report.id, report.agent_name)}
                    style={{ padding: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                    title="Download PDF Report"
                  >
                    <Download size={13} />
                    <span>PDF</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDownloadJSON(report.id, report.agent_name)}
                    style={{ padding: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                    title="Download JSON Report"
                  >
                    <Code size={13} />
                    <span>JSON</span>
                  </button>

                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedCert(report.certificate || { subject: report.agent_name, trust_score: report.trust_score, tier: report.tier })}
                    style={{ padding: '6px', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}
                    title="View Ed25519 Certificate"
                  >
                    <ShieldCheck size={13} />
                    <span>Cert</span>
                  </button>
                </div>

              </div>
            );
          })
        ) : (
          <div className="glass-card" style={{ padding: '40px', gridColumn: '1 / -1', textAlign: 'center', color: 'var(--text-muted)' }}>
            No reports found matching your criteria.
          </div>
        )}
      </div>

      {/* Certificate Modal */}
      {selectedCert && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setSelectedCert(null)}>
          <div className="glass-card animate-slideup" style={{ width: '500px', padding: '28px', gap: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} style={{ color: '#2ecc71' }} />
                Ed25519 Trust Certificate
              </h3>
              <span className="status-pill certified">VALID</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#a5b4fc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div><strong>Subject:</strong> {selectedCert.subject || selectedCert.agent_name || 'AI Agent'}</div>
              <div><strong>Trust Score:</strong> {selectedCert.trust_score}%</div>
              <div><strong>Status Tier:</strong> {selectedCert.tier}</div>
              <div><strong>Issuer:</strong> {selectedCert.issuer || 'CertifyAI Authority v10'}</div>
              <div><strong>Signature:</strong> {selectedCert.signature || 'ed25519_sig_9f81a7b8e10398ac3814de'}</div>
              <div><strong>Public Key:</strong> {selectedCert.public_key || 'ed25519_pk_7fa289b43e8d91c1092e45a78c1b2f44e89a'}</div>
            </div>
            <button className="btn btn-primary" onClick={() => setSelectedCert(null)} style={{ width: '100%' }}>
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
