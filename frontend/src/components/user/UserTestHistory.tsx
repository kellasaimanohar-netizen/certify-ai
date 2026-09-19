import React, { useState, useEffect } from 'react';
import {
  Clock,
  Search,
  Download,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Play,
  Eye,
  X,
  Code,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Sparkles,
  History
} from 'lucide-react';
import { generatePDFReport } from '../../utils/pdfExport';

interface UserTestHistoryProps {
  user: {
    id: number | string;
    name: string;
    email: string;
    role: string;
  };
  initialSelectedTestId?: number | null;
  onViewTestResult?: (testId: number) => void;
  onStartNewTest: () => void;
}

export const UserTestHistory: React.FC<UserTestHistoryProps> = ({
  user,
  initialSelectedTestId,
  onViewTestResult,
  onStartNewTest
}) => {
  const [tests, setTests] = useState<any[]>([]);
  const [groupedAgents, setGroupedAgents] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CERTIFIED' | 'CONDITIONAL' | 'NOT_CERTIFIED'>('ALL');

  // Detail Modal State
  const [selectedTestDetail, setSelectedTestDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const BACKEND_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '' ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      let url = `${BACKEND_URL}/api/user/tests?limit=100&group_by_agent=true`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
      if (statusFilter !== 'ALL') url += `&status=${encodeURIComponent(statusFilter)}`;
      if (dateFilter !== 'all') url += `&date_filter=${encodeURIComponent(dateFilter)}`;

      const res = await fetch(url, {
        headers: { 'X-User-Id': String(user?.id || 2) }
      });
      if (res.ok) {
        const data = await res.json();
        setTests(data.tests || []);
        if (data.grouped_agents) {
          setGroupedAgents(data.grouped_agents || []);
          // Auto-expand first agent with multiple versions if none selected
          if (!expandedAgent && data.grouped_agents.length > 0) {
            setExpandedAgent(data.grouped_agents[0].name);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load test history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user?.id, dateFilter, statusFilter]);

  useEffect(() => {
    if (initialSelectedTestId) {
      handleOpenTestDetail(initialSelectedTestId);
    }
  }, [initialSelectedTestId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleOpenTestDetail = async (testId: number) => {
    setIsDetailLoading(true);
    if (onViewTestResult) {
      onViewTestResult(testId);
    }
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/tests/${testId}`, {
        headers: { 'X-User-Id': String(user?.id || 2) }
      });
      if (res.ok) {
        const data = await res.json();
        const testData = data.test;
        const fullObj = (testData.full_result && Object.keys(testData.full_result).length > 0) ? testData.full_result : testData;
        setSelectedTestDetail({
          ...fullObj,
          ...testData,
          findings: fullObj.findings || testData.findings || [],
          audit_summary: fullObj.audit_summary || testData.audit_summary || null
        });
      } else {
        const local = tests.find(t => t.id === testId);
        if (local) setSelectedTestDetail(local);
      }
    } catch (err) {
      console.error('Failed to fetch test details:', err);
      const local = tests.find(t => t.id === testId);
      if (local) setSelectedTestDetail(local);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms) return '1m 20s';
    const totalSec = Math.round(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatDate = (isoStr: string) => {
    if (!isoStr) return 'Today';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoStr;
    }
  };

  const handleDownloadPDF = async (test: any) => {
    setDownloadingId(test.id);
    try {
      let fullObj = test.full_result || test;
      if (!fullObj.findings || fullObj.findings.length === 0) {
        const res = await fetch(`${BACKEND_URL}/api/user/tests/${test.id}`, {
          headers: { 'X-User-Id': String(user?.id || 2) }
        });
        if (res.ok) {
          const data = await res.json();
          const detail = data.test;
          fullObj = (detail.full_result && Object.keys(detail.full_result).length > 0) ? detail.full_result : detail;
        }
      }

      generatePDFReport({
        ...fullObj,
        name: `${fullObj.agent_name || test.agent_name} (${test.version || 'v1'})`,
        agent_name: fullObj.agent_name || test.agent_name,
        audit_id: fullObj.audit_id || test.audit_id,
        trust_score: fullObj.trust_score !== undefined ? fullObj.trust_score : test.trust_score,
        tier: fullObj.tier || test.tier,
        started_at: fullObj.created_at || test.created_at,
        finished_at: fullObj.created_at || test.created_at,
        tested_by_name: user?.name || 'Enterprise Security Auditor',
        tested_by_email: user?.email || 'audits@certifyai.enterprise',
        summary: fullObj.summary || {
          passed: test.pass_count || 0,
          critical_failures: test.critical_count || 0,
          warnings: test.warning_count || 0,
          total: (test.pass_count || 0) + (test.critical_count || 0) + (test.warning_count || 0)
        }
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredGroupedAgents = groupedAgents.filter(ag =>
    ag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (ag.versions && ag.versions.some((v: any) => v.agent_name?.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  return (
    <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={20} style={{ color: 'var(--accent-primary)' }} />
            Test History & Evolution Audit
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Each agent is consolidated into 1 unified instance tracking all version iterations (v1, v2, v3...) and score gains.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            background: 'var(--bg-panel-hover)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            gap: '3px'
          }}>
            <button
              onClick={() => setViewMode('grouped')}
              style={{
                padding: '7px 14px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: '700',
                border: 'none',
                background: viewMode === 'grouped' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'grouped' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: viewMode === 'grouped' ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <Layers size={14} />
              Grouped by Agent (v1, v2, v3)
            </button>
            <button
              onClick={() => setViewMode('flat')}
              style={{
                padding: '7px 14px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: '700',
                border: 'none',
                background: viewMode === 'flat' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'flat' ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: viewMode === 'flat' ? '0 2px 8px rgba(79, 70, 229, 0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              <History size={14} />
              Flat Log ({tests.length})
            </button>
          </div>

          <button className="btn btn-primary" onClick={onStartNewTest} style={{ padding: '8px 16px', fontSize: '13px', gap: '6px' }}>
            <Play size={14} fill="currentColor" />
            <span>+ Test New Agent</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '240px', maxWidth: '400px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search agent name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '34px', fontSize: '13px' }}
              />
              <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            </div>
            <button type="submit" className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '12.5px', fontWeight: '600' }}>
              Search
            </button>
          </form>

          {/* Quick Date Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Date:</span>
            <div style={{
              display: 'flex',
              background: 'var(--bg-panel-hover)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              gap: '3px'
            }}>
              {(['all', 'today', '7d', '30d'] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    background: dateFilter === d ? '#10b981' : 'transparent',
                    color: dateFilter === d ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    boxShadow: dateFilter === d ? '0 2px 6px rgba(16, 185, 129, 0.35)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {d === 'all' ? 'All' : d === 'today' ? 'Today' : d === '7d' ? '7 Days' : '30 Days'}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Status Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Status:</span>
            <div style={{
              display: 'flex',
              background: 'var(--bg-panel-hover)',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              gap: '3px'
            }}>
              {(['ALL', 'CERTIFIED', 'CONDITIONAL', 'NOT_CERTIFIED'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: 'none',
                    background: statusFilter === s ? 'var(--accent-primary)' : 'transparent',
                    color: statusFilter === s ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    boxShadow: statusFilter === s ? '0 2px 6px rgba(79, 70, 229, 0.35)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {s === 'ALL' ? 'All' : s === 'CERTIFIED' ? 'Certified' : s === 'CONDITIONAL' ? 'Conditional' : 'Not Certified'}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. GROUPED BY AGENT VIEW (ONE INSTANCE PER AGENT WITH v1, v2, v3...) */}
      {/* ========================================================================= */}
      {viewMode === 'grouped' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {isLoading ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <RefreshCw size={22} className="spin-animation" style={{ margin: '0 auto 10px auto', display: 'block', color: 'var(--accent-primary)' }} />
              Grouping agent test runs and version progression...
            </div>
          ) : filteredGroupedAgents.length > 0 ? (
            filteredGroupedAgents.map((ag) => {
              const isExpanded = expandedAgent === ag.name;
              const versions = ag.versions || [];
              const totalVersions = versions.length;
              const isTested = ag.latest_score !== null;
              const isCertified = ag.latest_status === 'CERTIFIED';
              const isConditional = ag.latest_status === 'CONDITIONAL';
              const scoreColor = isTested
                ? (isCertified ? '#10b981' : isConditional ? '#d97706' : '#ef4444')
                : 'var(--text-muted)';
              const hasImprovement = ag.score_improvement !== null && ag.score_improvement !== undefined && ag.score_improvement > 0;

              return (
                <div
                  key={ag.id || ag.name}
                  className="glass-card"
                  style={{
                    padding: '0',
                    overflow: 'hidden',
                    border: isExpanded ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                    transition: 'all 0.2s ease',
                    boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {/* Agent Card Header Row */}
                  <div
                    onClick={() => setExpandedAgent(isExpanded ? null : ag.name)}
                    style={{
                      padding: '18px 24px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px',
                      cursor: 'pointer',
                      background: isExpanded ? 'rgba(79, 70, 229, 0.04)' : 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: 'rgba(79, 70, 229, 0.1)',
                        border: '1px solid rgba(79, 70, 229, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)'
                      }}>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <h3 style={{ fontSize: '16.5px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                            {ag.name}
                          </h3>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: 'var(--accent-cyan, #0284c7)',
                            border: '1px solid rgba(56, 189, 248, 0.3)'
                          }}>
                            {ag.latest_version} (Latest)
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            • {totalVersions} {totalVersions === 1 ? 'Iteration' : 'Iterations'}
                          </span>
                        </div>

                        {/* Version progression pill chain */}
                        {ag.version_progression && ag.version_progression.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                            {ag.version_progression.map((ver: any, vIdx: number) => {
                              const vColor = ver.tier === 'CERTIFIED' ? '#10b981' : ver.tier === 'CONDITIONAL' ? '#d97706' : '#ef4444';
                              const isLatest = vIdx === ag.version_progression.length - 1;

                              return (
                                <span
                                  key={vIdx}
                                  style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    background: isLatest ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-panel-hover)',
                                    color: 'var(--text-primary)',
                                    border: isLatest ? '1px solid var(--accent-cyan, #0284c7)' : '1px solid var(--border-subtle)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontWeight: '600'
                                  }}
                                >
                                  <span>{ver.version}:</span> <strong style={{ color: vColor }}>{ver.score}%</strong>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      {hasImprovement && (
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.12)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          color: '#10b981',
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <TrendingUp size={13} />
                          +{ag.score_improvement}% gain since v1
                        </div>
                      )}

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '700', display: 'block' }}>
                          Current Score ({ag.latest_version})
                        </span>
                        <span style={{ fontSize: '20px', fontWeight: '900', color: scoreColor }}>
                          {isTested ? `${ag.latest_score}%` : '—'}
                        </span>
                      </div>

                      <span className={`status-pill ${ag.latest_status?.toLowerCase()}`} style={{
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontSize: '11.5px',
                        fontWeight: '800'
                      }}>
                        {ag.latest_status || 'UNTESTED'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Version Timeline Sub-Table */}
                  {isExpanded && (
                    <div style={{
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'var(--bg-panel-hover)',
                      padding: '18px 24px'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        textTransform: 'uppercase',
                        fontWeight: '800',
                        letterSpacing: '0.5px',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Layers size={14} style={{ color: 'var(--accent-primary)' }} />
                        <span>Version History & Test Iterations for {ag.name}</span>
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
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Date Tested</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Mode</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Score</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Delta</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Tier Status</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Criticals</th>
                              <th style={{ padding: '10px 14px', fontWeight: '700' }}>Duration</th>
                              <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ag.versions || []).map((ver: any, vIdx: number) => {
                              const isLatestVer = vIdx === (ag.versions.length - 1);
                              const vColor = ver.tier === 'CERTIFIED' ? '#10b981' : ver.tier === 'CONDITIONAL' ? '#d97706' : '#ef4444';
                              const isDownloading = downloadingId === ver.id;

                              return (
                                <tr
                                  key={ver.id || vIdx}
                                  style={{
                                    borderBottom: '1px solid var(--border-subtle)',
                                    background: isLatestVer ? 'rgba(79, 70, 229, 0.04)' : 'transparent'
                                  }}
                                  className="table-row-hover"
                                >
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{
                                      fontWeight: '800',
                                      color: isLatestVer ? 'var(--accent-primary)' : 'var(--text-primary)',
                                      background: isLatestVer ? 'rgba(79, 70, 229, 0.12)' : 'var(--bg-panel-hover)',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      border: isLatestVer ? '1px solid rgba(79, 70, 229, 0.3)' : '1px solid var(--border-subtle)',
                                      fontSize: '11.5px'
                                    }}>
                                      {ver.version} {isLatestVer && '★ (Latest)'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: '500' }}>
                                    {formatDate(ver.created_at)}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span style={{
                                      textTransform: 'uppercase',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      background: ver.mode === 'certify' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.15)',
                                      color: ver.mode === 'certify' ? '#10b981' : 'var(--accent-cyan, #0284c7)'
                                    }}>
                                      {ver.mode || 'validate'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', fontWeight: '800', fontSize: '14px', color: vColor }}>
                                    {ver.trust_score}%
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    {ver.score_delta !== undefined && ver.score_delta !== 0 ? (
                                      <span style={{ color: ver.score_delta > 0 ? '#10b981' : '#ef4444', fontWeight: '700', fontSize: '12px' }}>
                                        {ver.score_delta > 0 ? `+${ver.score_delta}%` : `${ver.score_delta}%`}
                                      </span>
                                    ) : (
                                      <span style={{ color: 'var(--text-secondary)' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 14px' }}>
                                    <span className={`status-pill ${ver.tier?.toLowerCase()}`} style={{ fontSize: '10.5px', padding: '2px 8px', fontWeight: '700' }}>
                                      {ver.tier}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', color: ver.critical_count > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: ver.critical_count > 0 ? '700' : '500' }}>
                                    {ver.critical_count || 0}
                                  </td>
                                  <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '500' }}>
                                    {formatDuration(ver.duration_ms)}
                                  </td>
                                  <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                      <button
                                        className="btn btn-ghost"
                                        onClick={() => handleOpenTestDetail(ver.id)}
                                        style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--accent-primary)', fontWeight: '700', gap: '4px' }}
                                      >
                                        <Eye size={13} /> View
                                      </button>
                                      <button
                                        className="btn btn-ghost"
                                        onClick={() => handleDownloadPDF(ver)}
                                        disabled={isDownloading}
                                        style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--text-secondary)' }}
                                        title="Download Certified PDF Report"
                                      >
                                        {isDownloading ? <RefreshCw size={13} className="spin-animation" /> : <Download size={13} />}
                                      </button>
                                    </div>
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
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No agent test records found matching your filters.
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* 2. FLAT LOG VIEW */
        /* ========================================================================= */
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Agent Name & Version</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Mode</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Trust Score</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Delta</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Criticals</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600' }}>Duration</th>
                  <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw size={18} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                      Loading test history...
                    </td>
                  </tr>
                ) : tests.length > 0 ? (
                  tests.map((test) => {
                    const isCertified = test.tier === 'CERTIFIED';
                    const isConditional = test.tier === 'CONDITIONAL';
                    const isDownloading = downloadingId === test.id;

                    return (
                      <tr
                        key={test.id}
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {formatDate(test.created_at)}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{test.agent_name}</span>
                            <span style={{
                              fontSize: '11px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: test.is_latest ? 'rgba(0, 240, 255, 0.15)' : 'rgba(255,255,255,0.06)',
                              color: test.is_latest ? '#00f0ff' : 'var(--text-muted)',
                              fontWeight: '700'
                            }}>
                              {test.version || 'v1'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontSize: '11px',
                            textTransform: 'uppercase',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: test.mode === 'certify' ? 'rgba(46,204,113,0.1)' : 'rgba(0,180,216,0.1)',
                            color: test.mode === 'certify' ? '#2ecc71' : 'var(--accent-cyan)'
                          }}>
                            {test.mode}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            fontWeight: '800',
                            color: isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c'
                          }}>
                            {test.trust_score}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {test.score_delta !== undefined && test.score_delta !== 0 ? (
                            <span style={{ color: test.score_delta > 0 ? '#2ecc71' : '#e74c3c', fontWeight: '700', fontSize: '11.5px' }}>
                              {test.score_delta > 0 ? `+${test.score_delta}%` : `${test.score_delta}%`}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`status-pill ${test.tier?.toLowerCase()}`} style={{ fontSize: '11px' }}>
                            {test.tier}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: test.critical_count > 0 ? '#e74c3c' : 'var(--text-muted)', fontWeight: test.critical_count > 0 ? '700' : '400' }}>
                          {test.critical_count}
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                          {formatDuration(test.duration_ms)}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleOpenTestDetail(test.id)}
                              style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '4px' }}
                              title="View Full Test Findings"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                            <button
                              className="btn btn-ghost"
                              onClick={() => handleDownloadPDF(test)}
                              disabled={isDownloading}
                              style={{ padding: '4px 8px', fontSize: '12px', opacity: isDownloading ? 0.6 : 1 }}
                              title="Download Certified PDF Report"
                            >
                              {isDownloading ? (
                                <RefreshCw size={13} className="spin-animation" />
                              ) : (
                                <Download size={13} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No test records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Detail Modal */}
      {(selectedTestDetail || isDetailLoading) && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }} onClick={() => setSelectedTestDetail(null)}>
          <div
            className="glass-card animate-slideup"
            style={{ width: '820px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}
            onClick={e => e.stopPropagation()}
          >
            {isDetailLoading && !selectedTestDetail ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 12px auto', display: 'block' }} />
                <span>Loading complete test audit trail...</span>
              </div>
            ) : selectedTestDetail && (
              <>
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                        {selectedTestDetail.agent_name}
                      </h2>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(0, 240, 255, 0.15)',
                        color: '#00f0ff'
                      }}>
                        {selectedTestDetail.version || 'v1'}
                      </span>
                      <span className={`status-pill ${selectedTestDetail.tier?.toLowerCase()}`} style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px' }}>
                        {selectedTestDetail.tier}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Audit ID: {selectedTestDetail.audit_id} • Conducted by {user?.name || 'Ismeet'} • {formatDate(selectedTestDetail.created_at)}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedTestDetail(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Score & Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div className="glass-card stat-card" style={{ padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Trust Score</span>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: selectedTestDetail.tier === 'CERTIFIED' ? '#2ecc71' : selectedTestDetail.tier === 'CONDITIONAL' ? '#f1c40f' : '#e74c3c' }}>
                      {selectedTestDetail.trust_score}%
                    </div>
                  </div>
                  <div className="glass-card stat-card" style={{ padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Criticals</span>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#e74c3c' }}>
                      {selectedTestDetail.critical_count || 0}
                    </div>
                  </div>
                  <div className="glass-card stat-card" style={{ padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Warnings</span>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#f1c40f' }}>
                      {selectedTestDetail.warning_count || 0}
                    </div>
                  </div>
                  <div className="glass-card stat-card" style={{ padding: '14px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Passed Rules</span>
                    <div style={{ fontSize: '22px', fontWeight: '800', color: '#2ecc71' }}>
                      {selectedTestDetail.pass_count || 0}
                    </div>
                  </div>
                </div>

                {/* Findings Breakdown */}
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 10px 0' }}>
                    Rule Evaluation Findings ({selectedTestDetail.findings?.length || 0})
                  </h4>
                  {selectedTestDetail.findings && selectedTestDetail.findings.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                      {selectedTestDetail.findings.map((f: any, idx: number) => {
                        const sev = f.severity?.toUpperCase();
                        const isPass = sev === 'PASS';
                        const isCrit = sev === 'CRITICAL';
                        return (
                          <div key={idx} style={{
                            padding: '10px 14px', borderRadius: '6px',
                            background: isPass ? 'rgba(46,204,113,0.06)' : isCrit ? 'rgba(231,76,60,0.08)' : 'rgba(241,196,15,0.06)',
                            border: `1px solid ${isPass ? 'rgba(46,204,113,0.2)' : isCrit ? 'rgba(231,76,60,0.25)' : 'rgba(241,196,15,0.2)'}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                          }}>
                            <div>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>{f.rule_id || f.id || `RULE-${idx+1}`}</span>
                              <div style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: '600' }}>{f.description || f.name || 'Safety constraint verification'}</div>
                            </div>
                            <span style={{
                              fontSize: '10.5px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px',
                              background: isPass ? '#2ecc71' : isCrit ? '#e74c3c' : '#f1c40f', color: '#0f172a'
                            }}>
                              {sev || 'PASS'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No granular diagnostic findings recorded.
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                  <button className="btn btn-secondary" onClick={() => setSelectedTestDetail(null)}>
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleDownloadPDF(selectedTestDetail)}
                    style={{ gap: '6px' }}
                  >
                    <Download size={14} />
                    <span>Download PDF Certificate</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
