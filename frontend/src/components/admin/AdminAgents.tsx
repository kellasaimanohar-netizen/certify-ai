import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Award,
  Sparkles,
  History,
  FileText
} from 'lucide-react';

export const AdminAgents: React.FC = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected agent detail drilldown
  const [selectedAgentId, setSelectedAgentId] = useState<number | string | null>(null);
  const [agentDetail, setAgentDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '' ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  const fetchAgents = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/agents`);
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (err) {
      console.error('Failed to load fleet agents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleSelectAgent = async (agentId: number | string) => {
    setSelectedAgentId(agentId);
    setIsDetailLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgentDetail(data);
      }
    } catch (err) {
      console.error('Failed to load agent details:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (a.description && a.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // ==========================================
  // VIEW: AGENT DETAILS (Agent drilldown)
  // ==========================================
  if (selectedAgentId && agentDetail) {
    const ag = agentDetail.agent;
    const stats = agentDetail.stats || {};
    const history = agentDetail.history || [];
    const progression = agentDetail.version_progression || [];
    const hasImprovement = stats.score_improvement !== null && stats.score_improvement !== undefined && stats.score_improvement > 0;

    return (
      <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Navigation row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSelectedAgentId(null);
              setAgentDetail(null);
            }}
            style={{ padding: '6px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Agent Fleet</span>
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/ Agent Version Evolution ({ag.name})</span>
        </div>

        {/* Agent Header Card */}
        <div className="glass-card" style={{ padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                {ag.name}
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(0, 240, 255, 0.12)',
                color: '#00f0ff',
                border: '1px solid rgba(0, 240, 255, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <Sparkles size={10} />
                {stats.latest_version || 'v1'} (Latest)
              </span>
              <span className={`status-pill ${stats.latest_status?.toLowerCase()}`} style={{ fontSize: '11px', textTransform: 'uppercase' }}>
                {stats.latest_status}
              </span>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {ag.description}
            </p>
          </div>

          {stats.score_improvement !== null && stats.score_improvement !== undefined && (
            <div style={{
              background: stats.score_improvement >= 0 ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
              border: `1px solid ${stats.score_improvement >= 0 ? 'rgba(46, 204, 113, 0.3)' : 'rgba(231, 76, 60, 0.3)'}`,
              color: stats.score_improvement >= 0 ? '#2ecc71' : '#e74c3c',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <TrendingUp size={16} />
              {stats.score_improvement >= 0 ? `+${stats.score_improvement}% Score Gain Since v1` : `${stats.score_improvement}% Score Variance`}
            </div>
          )}
        </div>

        {/* Agent Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Total Versions</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>{stats.total_iterations || history.length}</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Initial Score (v1)</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#f1c40f', marginTop: '4px' }}>{stats.first_score || stats.latest_score || '—'}%</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Current Score ({stats.latest_version || 'v1'})</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#00f0ff', marginTop: '4px' }}>{stats.latest_score || '—'}%</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Best Score</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#2ecc71', marginTop: '4px' }}>{stats.best_score || '—'}%</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Lowest Score</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#e74c3c', marginTop: '4px' }}>{stats.lowest_score || '—'}%</div>
          </div>
        </div>

        {/* Version Iteration Timeline Banner */}
        {progression.length > 0 && (
          <div className="glass-card" style={{ padding: '20px 24px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px', display: 'block', marginBottom: '12px' }}>
              Version Iterations Sequence ({progression.length} Iterations)
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', paddingBottom: '6px' }}>
              {progression.map((ver: any, vIdx: number) => {
                const vColor = ver.tier === 'CERTIFIED' ? '#2ecc71' : ver.tier === 'CONDITIONAL' ? '#f1c40f' : '#e74c3c';
                const isLatest = vIdx === progression.length - 1;

                return (
                  <div
                    key={vIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      background: isLatest ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                      border: `1px solid ${isLatest ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                      flexShrink: 0
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: '800', color: isLatest ? '#00f0ff' : 'var(--text-primary)' }}>
                      {ver.version} {isLatest && '★'}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: vColor }}>
                      {ver.score}%
                    </span>
                    <span className={`status-pill ${ver.tier?.toLowerCase()}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                      {ver.tier}
                    </span>
                    {vIdx < progression.length - 1 && (
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)', marginLeft: '4px' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Testing History Table */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Testing & Version Audit History ({history.length} Runs)
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Version</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Tested By</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Mode</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Score</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Delta</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Criticals</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any, idx: number) => {
                  const isLatest = idx === 0;
                  const vColor = h.tier === 'CERTIFIED' ? '#2ecc71' : h.tier === 'CONDITIONAL' ? '#f1c40f' : '#e74c3c';

                  return (
                    <tr key={h.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: isLatest ? 'rgba(0, 240, 255, 0.03)' : 'transparent' }}>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontWeight: '800',
                          color: isLatest ? '#00f0ff' : 'var(--text-primary)',
                          background: isLatest ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px'
                        }}>
                          {h.version || `v${history.length - idx}`} {isLatest && '★'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: 'var(--text-primary)' }}>{h.tested_by_name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{h.created_at ? new Date(h.created_at).toLocaleString() : '—'}</td>
                      <td style={{ padding: '12px 14px', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>{h.mode}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '800', color: vColor }}>{h.trust_score}%</td>
                      <td style={{ padding: '12px 14px' }}>
                        {h.score_delta !== undefined && h.score_delta !== 0 ? (
                          <span style={{ color: h.score_delta > 0 ? '#2ecc71' : '#e74c3c', fontWeight: '700', fontSize: '12px' }}>
                            {h.score_delta > 0 ? `+${h.score_delta}%` : `${h.score_delta}%`}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span className={`status-pill ${h.tier.toLowerCase()}`} style={{ fontSize: '10.5px' }}>{h.tier}</span>
                      </td>
                      <td style={{ padding: '12px 14px', color: h.critical_count > 0 ? '#e74c3c' : 'var(--text-muted)', fontWeight: h.critical_count > 0 ? '700' : '400' }}>{h.critical_count}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{(h.duration_ms / 1000).toFixed(1)}s</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  }

  // ==========================================
  // VIEW: MAIN AGENTS LIST (1 Instance Per Agent)
  // ==========================================
  return (
    <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={22} style={{ color: '#00f0ff' }} />
            Monitored Agent Fleet (Grouped by Instance)
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Each agent is consolidated into 1 unified instance tracking all version iterations (v1, v2, v3...) and score gains.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ position: 'relative', minWidth: '260px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search fleet agents..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '32px', fontSize: '13px', height: '38px' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <button
            className="btn-secondary"
            onClick={fetchAgents}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '38px', padding: '0 14px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Agents Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Agent Name</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Current Version</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Version Progression</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Current Score</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Evolution Gain</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Latest Status</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Last Tested By</th>
                <th style={{ padding: '14px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={20} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block', color: '#00f0ff' }} />
                    Loading agent fleet & version metrics...
                  </td>
                </tr>
              ) : filteredAgents.map((ag) => {
                const isTested = ag.latest_score !== null;
                const isCertified = ag.latest_status === 'CERTIFIED';
                const isConditional = ag.latest_status === 'CONDITIONAL';
                const scoreColor = isTested
                  ? (isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c')
                  : 'var(--text-muted)';

                const totalVersions = ag.total_iterations || (ag.versions ? ag.versions.length : 0);
                const progression = ag.version_progression || [];
                const hasImprovement = ag.score_improvement !== null && ag.score_improvement !== undefined && ag.score_improvement > 0;

                return (
                  <tr
                    key={ag.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.15s' }}
                    className="table-row-hover"
                    onClick={() => handleSelectAgent(ag.id)}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      <div>
                        {ag.name}
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: '400', marginTop: '2px' }}>
                          {totalVersions} Test Iterations
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11.5px',
                        fontWeight: '700',
                        color: totalVersions > 0 ? '#00f0ff' : 'var(--text-muted)',
                        background: totalVersions > 0 ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        border: totalVersions > 0 ? '1px solid rgba(0, 240, 255, 0.25)' : '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '2px 8px',
                        borderRadius: '10px'
                      }}>
                        {ag.latest_version || `v${ag.version}`}
                      </span>
                    </td>

                    {/* Version progression stepper pills */}
                    <td style={{ padding: '14px 16px' }}>
                      {progression.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                          {progression.slice(-4).map((ver: any, vIdx: number) => {
                            const vColor = ver.tier === 'CERTIFIED' ? '#2ecc71' : ver.tier === 'CONDITIONAL' ? '#f1c40f' : '#e74c3c';
                            const isLatest = vIdx === progression.slice(-4).length - 1;

                            return (
                              <span
                                key={vIdx}
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  background: isLatest ? 'rgba(0, 240, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                                  color: isLatest ? '#00f0ff' : 'var(--text-secondary)',
                                  border: `1px solid ${isLatest ? 'rgba(0, 240, 255, 0.3)' : 'rgba(255, 255, 255, 0.06)'}`,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <strong>{ver.version}:</strong> <span style={{ color: vColor }}>{ver.score}%</span>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Untested</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px', fontWeight: '800', fontSize: '14px', color: scoreColor }}>
                      {isTested ? `${ag.latest_score}%` : '—'}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      {hasImprovement ? (
                        <span style={{
                          color: '#2ecc71',
                          fontWeight: '800',
                          fontSize: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: 'rgba(46, 204, 113, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '10px'
                        }}>
                          <TrendingUp size={12} /> +{ag.score_improvement}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: '14px 16px' }}>
                      <span className={`status-pill ${ag.latest_status?.toLowerCase()}`} style={{ fontSize: '10.5px' }}>
                        {ag.latest_status || 'UNTESTED'}
                      </span>
                    </td>

                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                      {ag.last_tested_by || '—'}
                    </td>

                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAgent(ag.id);
                        }}
                        style={{ padding: '4px 10px', fontSize: '12px', color: '#00f0ff', gap: '4px' }}
                      >
                        <History size={13} />
                        <span>Timeline</span>
                        <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
