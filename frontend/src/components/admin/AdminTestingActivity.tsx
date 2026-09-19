import React, { useState, useEffect } from 'react';
import {
  Activity,
  Search,
  Filter,
  Eye,
  Download,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Clock,
  Layers,
  Users,
  Code,
  ChevronDown,
  X
} from 'lucide-react';
import { generatePDFReport } from '../../utils/pdfExport';

interface AdminTestingActivityProps {
  initialSelectedTestId?: number | null;
}

export const AdminTestingActivity: React.FC<AdminTestingActivityProps> = ({
  initialSelectedTestId
}) => {
  const [tests, setTests] = useState<any[]>([]);
  const [groupedAgents, setGroupedAgents] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedAgentId, setExpandedAgentId] = useState<string | number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedUser, setSelectedUser] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [minScore, setMinScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('');

  // Dropdown options
  const [allUsersList, setAllUsersList] = useState<any[]>([]);
  const [allAgentsList, setAllAgentsList] = useState<any[]>([]);

  // Selected test detail modal
  const [selectedTestDetail, setSelectedTestDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [expandedFindingIdx, setExpandedFindingIdx] = useState<number | null>(null);

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const fetchFiltersData = async () => {
    try {
      const [uRes, aRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/admin/users`),
        fetch(`${BACKEND_URL}/api/admin/agents`)
      ]);
      if (uRes.ok) {
        const uData = await uRes.json();
        setAllUsersList(uData.users || []);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        setAllAgentsList(aData.agents || []);
      }
    } catch (err) {
      console.error('Failed to load filter choices:', err);
    }
  };

  const fetchActivity = async () => {
    setIsLoading(true);
    try {
      let url = `${BACKEND_URL}/api/admin/activity?limit=100&group_by_agent=true`;
      if (selectedUser !== 'all') url += `&user=${encodeURIComponent(selectedUser)}`;
      if (selectedAgent !== 'all') url += `&agent=${encodeURIComponent(selectedAgent)}`;
      if (selectedStatus !== 'all') url += `&status=${encodeURIComponent(selectedStatus)}`;
      if (selectedDateFilter !== 'all') url += `&date_filter=${encodeURIComponent(selectedDateFilter)}`;
      if (minScore) url += `&min_score=${encodeURIComponent(minScore)}`;
      if (maxScore) url += `&max_score=${encodeURIComponent(maxScore)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setTests(data.tests || []);
        setGroupedAgents(data.grouped_agents || []);
      }
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiltersData();
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [selectedUser, selectedAgent, selectedStatus, selectedDateFilter, minScore, maxScore]);

  useEffect(() => {
    if (initialSelectedTestId) {
      handleOpenTestDetail(initialSelectedTestId);
    }
  }, [initialSelectedTestId]);

  const handleOpenTestDetail = async (testId: number) => {
    setIsDetailLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/tests/${testId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTestDetail(data.test);
      }
    } catch (err) {
      console.error('Failed to load test details:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleDownloadPDF = (testObj: any) => {
    const fullObj = testObj.full_result || testObj;
    const doc = generatePDFReport(fullObj);
    doc.save(`${testObj.agent_name || 'agent'}_audit_report.pdf`);
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return 'Today';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const formatTime = (isoStr: string) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '—';
    }
  };

  return (
    <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} style={{ color: 'var(--accent-cyan)' }} />
            Testing Activity — Who Tested What?
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Complete historical audit trail of all AI agent evaluations conducted across the organization.
          </p>
        </div>

        <button className="btn btn-secondary" onClick={fetchActivity} style={{ padding: '8px 14px', fontSize: '12.5px', gap: '6px' }}>
          <RefreshCw size={13} className={isLoading ? 'spin-animation' : ''} />
          <span>Refresh Feed</span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="glass-card" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* Row 1: Dropdown filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          
          {/* User filter */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              User
            </label>
            <select
              className="form-input"
              value={selectedUser}
              onChange={e => setSelectedUser(e.target.value)}
              style={{ fontSize: '12.5px', padding: '6px 10px' }}
            >
              <option value="all">All Users</option>
              {allUsersList.map(u => (
                <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>

          {/* Agent filter */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Agent
            </label>
            <select
              className="form-input"
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              style={{ fontSize: '12.5px', padding: '6px 10px' }}
            >
              <option value="all">All Agents</option>
              {allAgentsList.map(a => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
              Status Tier
            </label>
            <select
              className="form-input"
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{ fontSize: '12.5px', padding: '6px 10px' }}
            >
              <option value="all">All Statuses</option>
              <option value="CERTIFIED">Certified</option>
              <option value="CONDITIONAL">Conditional</option>
              <option value="NOT_CERTIFIED">Not Certified</option>
            </select>
          </div>

          {/* Min & Max Score */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Min Score
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="0"
                value={minScore}
                onChange={e => setMinScore(e.target.value)}
                style={{ fontSize: '12.5px', padding: '6px 10px' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Max Score
              </label>
              <input
                type="number"
                className="form-input"
                placeholder="100"
                value={maxScore}
                onChange={e => setMaxScore(e.target.value)}
                style={{ fontSize: '12.5px', padding: '6px 10px' }}
              />
            </div>
          </div>

        </div>

        {/* Row 2: Date pills & View Mode Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Date Period:</span>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.25)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              {(['all', 'today', 'yesterday', '7d', '30d'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDateFilter(d)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    border: 'none',
                    background: selectedDateFilter === d ? 'var(--accent-cyan)' : 'transparent',
                    color: selectedDateFilter === d ? '#0f172a' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {d === 'all' ? 'All Time' : d === 'today' ? 'Today' : d === 'yesterday' ? 'Yesterday' : d === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>View Mode:</span>
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.25)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setViewMode('grouped')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  border: 'none',
                  background: viewMode === 'grouped' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'grouped' ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Layers size={12} />
                <span>Grouped by Agent (1 Instance)</span>
              </button>
              <button
                onClick={() => setViewMode('flat')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  border: 'none',
                  background: viewMode === 'flat' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'flat' ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Clock size={12} />
                <span>All Test Runs Log</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Activity Content Area */}
      {viewMode === 'grouped' ? (
        /* Grouped 1-Instance View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {isLoading ? (
            <div className="glass-card" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={18} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              Loading unified agent fleet iterations...
            </div>
          ) : groupedAgents.length > 0 ? (
            groupedAgents.map((agent) => {
              const isExpanded = expandedAgentId === (agent.agent_id || agent.agent_name);
              const latestScore = agent.latest_score !== undefined && agent.latest_score !== null ? agent.latest_score : (agent.trust_score || 0);
              const effectiveTier = agent.latest_tier || agent.latest_status || agent.tier || (latestScore >= 80 ? 'CERTIFIED' : latestScore >= 70 ? 'CONDITIONAL' : 'NOT_CERTIFIED');
              const isCertified = effectiveTier === 'CERTIFIED';
              const isConditional = effectiveTier === 'CONDITIONAL';
              const scoreColor = isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c';
              const versions: any[] = agent.versions || [];

              return (
                <div key={agent.agent_id || agent.agent_name} className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                  {/* Summary Bar */}
                  <div
                    style={{
                      padding: '16px 22px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      borderLeft: `4px solid ${scoreColor}`,
                      background: isExpanded ? 'rgba(255,255,255,0.03)' : 'transparent',
                      transition: 'background 0.2s',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                    onClick={() => setExpandedAgentId(isExpanded ? null : (agent.agent_id || agent.agent_name))}
                  >
                    {/* Left: Agent info & Version count */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(0, 240, 255, 0.1)', border: '1px solid rgba(0, 240, 255, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
                        <Layers size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h3 style={{ fontSize: '15.5px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                            {agent.agent_name}
                          </h3>
                          <span style={{
                            padding: '1px 8px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            fontWeight: '800',
                            background: 'rgba(0, 240, 255, 0.15)',
                            color: 'var(--accent-cyan)',
                            border: '1px solid rgba(0, 240, 255, 0.3)'
                          }}>
                            {agent.latest_version || `v${versions.length || 1}`}
                          </span>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            ({versions.length} total {versions.length === 1 ? 'iteration' : 'iterations'})
                          </span>
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          Latest Audit: {agent.latest_audit_id || agent.audit_id || '—'} • Last tested by {agent.last_tested_by_name || 'Auditor'}
                        </span>
                      </div>
                    </div>

                    {/* Middle: Interactive Version Progression Stepper */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', marginRight: '4px' }}>Evolution:</span>
                      {versions.map((ver, idx) => {
                        const vScore = ver.trust_score || 0;
                        const vCert = ver.tier === 'CERTIFIED';
                        const vCond = ver.tier === 'CONDITIONAL';
                        const vCol = vCert ? '#2ecc71' : vCond ? '#f1c40f' : '#e74c3c';

                        return (
                          <React.Fragment key={ver.id || idx}>
                            <button
                              onClick={() => handleOpenTestDetail(ver.id)}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                border: `1px solid ${vCol}40`,
                                background: `${vCol}15`,
                                color: vCol,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s'
                              }}
                              title={`Click to inspect ${ver.version}: ${vScore}% (${ver.tier})`}
                            >
                              <span>{ver.version}:</span>
                              <span>{vScore}%</span>
                            </button>
                            {idx < versions.length - 1 && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>→</span>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {agent.score_improvement !== undefined && agent.score_improvement !== 0 && (
                        <span style={{
                          marginLeft: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: agent.score_improvement > 0 ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)',
                          color: agent.score_improvement > 0 ? '#2ecc71' : '#e74c3c',
                          border: `1px solid ${agent.score_improvement > 0 ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'}`
                        }}>
                          {agent.score_improvement > 0 ? `+${agent.score_improvement}% gain` : `${agent.score_improvement}%`}
                        </span>
                      )}
                    </div>

                    {/* Right: Score, Tier, and Accordion Trigger */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: scoreColor }}>
                          {latestScore}%
                        </div>
                        {effectiveTier && (
                          <span style={{
                            display: 'inline-block',
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            background: `${scoreColor}15`,
                            color: scoreColor,
                            border: `1px solid ${scoreColor}40`
                          }}>
                            {effectiveTier}
                          </span>
                        )}
                      </div>

                      <ChevronDown
                        size={18}
                        style={{
                          transform: isExpanded ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s',
                          color: 'var(--text-muted)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Expanded Iteration History Drawer */}
                  {isExpanded && (
                    <div style={{
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'var(--bg-panel-hover)',
                      padding: '18px 24px'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '800',
                        textTransform: 'uppercase',
                        color: 'var(--text-primary)',
                        marginBottom: '12px',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Clock size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>All Test Runs for {agent.agent_name} (Chronological Evolution)</span>
                      </div>
                      <div style={{
                        borderRadius: '10px',
                        overflow: 'hidden',
                        border: '1px solid var(--border-subtle)',
                        background: 'var(--bg-panel)'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                          <thead>
                            <tr style={{
                              color: 'var(--text-secondary)',
                              background: 'var(--bg-panel-hover)',
                              textAlign: 'left',
                              borderBottom: '1px solid var(--border-subtle)'
                            }}>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Version</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Audit ID</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Tested By</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Date & Time</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Mode</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Score</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Status</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {versions.map((verRun) => {
                              const isCert = verRun.tier === 'CERTIFIED';
                              const isCond = verRun.tier === 'CONDITIONAL';
                              const col = isCert ? '#10b981' : isCond ? '#d97706' : '#ef4444';

                              return (
                                <tr
                                  key={verRun.id}
                                  style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                  className="table-row-hover"
                                >
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      fontSize: '11.5px',
                                      fontWeight: '800',
                                      background: 'rgba(56, 189, 248, 0.15)',
                                      color: 'var(--accent-cyan, #0284c7)',
                                      border: '1px solid rgba(56, 189, 248, 0.3)'
                                    }}>
                                      {verRun.version}
                                    </span>
                                    {verRun.is_latest && (
                                      <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '800', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                        LATEST
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {verRun.audit_id}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: '600' }}>
                                    {verRun.tested_by_name || 'Auditor'}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                                    {formatDate(verRun.created_at)} {formatTime(verRun.created_at)}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{
                                      fontSize: '11px',
                                      textTransform: 'uppercase',
                                      fontWeight: '700',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      background: verRun.mode === 'certify' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.15)',
                                      color: verRun.mode === 'certify' ? '#10b981' : 'var(--accent-cyan, #0284c7)'
                                    }}>
                                      {verRun.mode}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{ fontWeight: '800', fontSize: '13.5px', color: col }}>
                                      {verRun.trust_score}%
                                    </span>
                                    {verRun.score_delta !== undefined && verRun.score_delta !== 0 && (
                                      <span style={{ marginLeft: '6px', fontSize: '11px', fontWeight: '700', color: verRun.score_delta > 0 ? '#10b981' : '#ef4444' }}>
                                        {verRun.score_delta > 0 ? `+${verRun.score_delta}%` : `${verRun.score_delta}%`}
                                      </span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span className={`status-pill ${verRun.tier?.toLowerCase()}`} style={{ fontSize: '10.5px', fontWeight: '700', padding: '2px 8px' }}>
                                      {verRun.tier}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                    <button
                                      className="btn btn-ghost"
                                      onClick={() => handleOpenTestDetail(verRun.id)}
                                      style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '700', gap: '4px' }}
                                    >
                                      <Eye size={13} />
                                      <span>Inspect Run</span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No agents match your filter criteria.
            </div>
          )}
        </div>
      ) : (
        /* Flat Chronological Audit Log Table */
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>User</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Agent & Version</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Time</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Mode</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Score</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw size={18} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      Loading testing activity...
                    </td>
                  </tr>
                ) : tests.length > 0 ? (
                  tests.map((item) => {
                    const isCertified = item.tier === 'CERTIFIED';
                    const isConditional = item.tier === 'CONDITIONAL';

                    return (
                      <tr
                        key={item.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.15s' }}
                        className="table-row-hover"
                        onClick={() => handleOpenTestDetail(item.id)}
                      >
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #2ecc71, #00b4d8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', fontWeight: '700', color: '#fff' }}>
                              {item.tested_by_name ? item.tested_by_name[0].toUpperCase() : 'U'}
                            </div>
                            <div>
                              <div>{item.tested_by_name}</div>
                              <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{item.tested_by_email}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{item.agent_name}</span>
                            {item.version && (
                              <span style={{
                                padding: '1px 6px',
                                borderRadius: '8px',
                                fontSize: '10.5px',
                                fontWeight: '800',
                                background: 'rgba(0, 240, 255, 0.15)',
                                color: 'var(--accent-cyan)',
                                border: '1px solid rgba(0, 240, 255, 0.3)'
                              }}>
                                {item.version}
                              </span>
                            )}
                            {item.is_latest && (
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
                          {formatDate(item.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {formatTime(item.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: item.mode === 'certify' ? 'rgba(46,204,113,0.1)' : 'rgba(0,180,216,0.1)', color: item.mode === 'certify' ? '#2ecc71' : 'var(--accent-cyan)' }}>
                            {item.mode}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{
                              fontWeight: '800',
                              color: isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c'
                            }}>
                              {item.trust_score}%
                            </span>
                            {item.score_delta !== undefined && item.score_delta !== 0 && (
                              <span style={{
                                fontSize: '10.5px',
                                fontWeight: '700',
                                color: item.score_delta > 0 ? '#2ecc71' : '#e74c3c'
                              }}>
                                {item.score_delta > 0 ? `+${item.score_delta}%` : `${item.score_delta}%`}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`status-pill ${item.tier.toLowerCase()}`} style={{
                            padding: '3px 9px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: isCertified ? 'rgba(46,204,113,0.15)' : isConditional ? 'rgba(241,196,15,0.15)' : 'rgba(231,76,60,0.15)',
                            color: isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c',
                            border: `1px solid ${isCertified ? 'rgba(46,204,113,0.3)' : isConditional ? 'rgba(241,196,15,0.3)' : 'rgba(231,76,60,0.3)'}`
                          }}>
                            {item.tier}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            className="btn btn-ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTestDetail(item.id);
                            }}
                            style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--accent-cyan)', gap: '4px' }}
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No test activity matches the specified filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Detail Modal / Drawer */}
      {selectedTestDetail && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }} onClick={() => setSelectedTestDetail(null)}>
          <div
            className="glass-card animate-slideup"
            style={{ width: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                    {selectedTestDetail.agent_name}
                  </h2>
                  {selectedTestDetail.version && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '800',
                      background: 'rgba(0, 240, 255, 0.15)',
                      color: 'var(--accent-cyan)',
                      border: '1px solid rgba(0, 240, 255, 0.3)'
                    }}>
                      {selectedTestDetail.version}
                    </span>
                  )}
                  <span className={`status-pill ${selectedTestDetail.tier?.toLowerCase()}`} style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px' }}>
                    {selectedTestDetail.tier}
                  </span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  Audit ID: {selectedTestDetail.audit_id} • Conducted by {selectedTestDetail.tested_by_name} ({selectedTestDetail.tested_by_email})
                </span>
              </div>

              <button className="btn btn-ghost" onClick={() => setSelectedTestDetail(null)} style={{ padding: '6px' }}>
                <X size={18} />
              </button>
            </div>

            {/* Test Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '14px', borderRadius: '8px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Trust Score</span>
                <div style={{ fontSize: '22px', fontWeight: '900', color: selectedTestDetail.tier === 'CERTIFIED' ? '#2ecc71' : selectedTestDetail.tier === 'CONDITIONAL' ? '#f1c40f' : '#e74c3c' }}>
                  {selectedTestDetail.trust_score}%
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Execution Mode</span>
                <div style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', marginTop: '4px' }}>
                  {selectedTestDetail.mode}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Critical Failures</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: selectedTestDetail.critical_count > 0 ? '#e74c3c' : 'var(--text-muted)' }}>
                  {selectedTestDetail.critical_count}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Duration</span>
                <div style={{ fontSize: '13px', fontWeight: '700', marginTop: '4px' }}>
                  {(selectedTestDetail.duration_ms / 1000).toFixed(1)}s
                </div>
              </div>
            </div>

            {/* Findings List */}
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>
                Evaluated Safety Checks & Findings
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                {(selectedTestDetail.full_result?.findings || []).map((f: any, idx: number) => {
                  const sev = (f.severity || 'PASS').toUpperCase();
                  const isExpanded = expandedFindingIdx === idx;

                  return (
                    <div key={idx} style={{ border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                      <div
                        onClick={() => setExpandedFindingIdx(isExpanded ? null : idx)}
                        style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '1px 6px',
                            borderRadius: '3px',
                            background: sev === 'CRITICAL' ? 'rgba(231,76,60,0.2)' : sev === 'WARNING' ? 'rgba(241,196,15,0.2)' : 'rgba(46,204,113,0.2)',
                            color: sev === 'CRITICAL' ? '#e74c3c' : sev === 'WARNING' ? '#f1c40f' : '#2ecc71'
                          }}>
                            {sev}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                            {f.rule_id || `RULE-${idx+1}`}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                            {f.description}
                          </span>
                        </div>
                        <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
                      </div>

                      {isExpanded && (
                        <div style={{ padding: '0 14px 12px 14px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px' }}>
                          {f.remediation && (
                            <div style={{ color: '#2ecc71', background: 'rgba(46,204,113,0.08)', padding: '6px 10px', borderRadius: '4px' }}>
                              <strong>Remediation:</strong> {f.remediation}
                            </div>
                          )}
                          {f.actual && <div><strong>Observed:</strong> {f.actual}</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => handleDownloadPDF(selectedTestDetail)}>
                <Download size={14} />
                <span>Export PDF Report</span>
              </button>
              <button className="btn btn-primary" onClick={() => setSelectedTestDetail(null)}>
                Close Details
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
