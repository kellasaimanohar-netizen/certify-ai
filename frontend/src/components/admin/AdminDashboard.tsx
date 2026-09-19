import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Activity,
  Layers,
  Users,
  TrendingUp,
  Clock,
  ArrowUpRight,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { getTimeGreeting } from '../../utils/timeGreeting';

interface AdminDashboardProps {
  user: {
    id: number | string;
    name: string;
    email: string;
    role: string;
  };
  onNavigate: (tab: string) => void;
  onViewTestDetails: (testId: number) => void;
}

const TIER_COLORS: Record<string, string> = {
  CERTIFIED: '#2ecc71',
  CONDITIONAL: '#f1c40f',
  NOT_CERTIFIED: '#e74c3c'
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  user,
  onNavigate,
  onViewTestDetails
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
    kpis: {
      tests_today: number;
      agents_today: number;
      total_tests: number;
      average_score: number;
      certified_count: number;
      conditional_count: number;
      not_certified_count: number;
      critical_findings_count: number;
    };
    recent_activity: any[];
  }>({
    kpis: {
      tests_today: 0,
      agents_today: 0,
      total_tests: 0,
      average_score: 0,
      certified_count: 0,
      conditional_count: 0,
      not_certified_count: 0,
      critical_findings_count: 0
    },
    recent_activity: []
  });

  const BACKEND_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '' ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  const fetchAdminDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminDashboard();
  }, []);

  const pieData = [
    { name: 'Certified', value: dashboardData.kpis.certified_count, color: '#2ecc71' },
    { name: 'Conditional', value: dashboardData.kpis.conditional_count, color: '#f1c40f' },
    { name: 'Not Certified', value: dashboardData.kpis.not_certified_count, color: '#e74c3c' }
  ].filter(d => d.value > 0);

  const formatDate = (isoStr: string) => {
    if (!isoStr) return 'Today';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
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

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const timeGreeting = getTimeGreeting();

  return (
    <div className="admin-dashboard-wrapper animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Header Banner */}
      <div className="glass-card" style={{
        padding: '24px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px',
        background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.08) 0%, rgba(112, 0, 255, 0.04) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.2)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontSize: '24px' }}>🛡️</span>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {timeGreeting.greeting} {user?.name || 'Syed'} {timeGreeting.emoji}
            </h1>
            <span className="role-tag-badge admin" style={{
              background: 'rgba(0, 240, 255, 0.15)',
              color: 'var(--accent-cyan)',
              border: '1px solid rgba(0, 240, 255, 0.3)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: '700'
            }}>ADMIN</span>
          </div>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Organization testing overview & autonomous fleet governance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="btn btn-secondary"
            onClick={fetchAdminDashboard}
            title="Refresh Metrics"
            style={{ padding: '9px 14px', fontSize: '13px' }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            className="btn btn-primary"
            onClick={() => onNavigate('activity')}
            style={{
              padding: '10px 18px',
              fontSize: '13.5px',
              fontWeight: '600',
              gap: '8px'
            }}
          >
            <Activity size={15} />
            <span>View Testing Activity</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px'
      }}>
        {/* KPI 1: Tests Today */}
        <div className="glass-card stat-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Tests Today
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--accent-cyan)', margin: '8px 0 2px 0' }}>
            {dashboardData.kpis.tests_today}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Conducted today</span>
        </div>

        {/* KPI 2: Agents Tested Today */}
        <div className="glass-card stat-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Agents Today
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#a855f7', margin: '8px 0 2px 0' }}>
            {dashboardData.kpis.agents_today}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Unique agents tested</span>
        </div>

        {/* KPI 3: Total Tests */}
        <div className="glass-card stat-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Tests
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', margin: '8px 0 2px 0' }}>
            {dashboardData.kpis.total_tests}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>All-time evaluations</span>
        </div>

        {/* KPI 4: Average Score */}
        <div className="glass-card stat-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Avg Score
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1c40f', margin: '8px 0 2px 0' }}>
            {dashboardData.kpis.average_score}%
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Organization average</span>
        </div>

        {/* KPI 5: Certified */}
        <div className="glass-card stat-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Certified
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#2ecc71', margin: '8px 0 2px 0' }}>
            {dashboardData.kpis.certified_count}
          </div>
          <span style={{ fontSize: '11px', color: '#2ecc71', fontWeight: '600' }}>Passed all gates</span>
        </div>

        {/* KPI 6: Conditional */}
        <div className="glass-card stat-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Conditional
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#f1c40f', margin: '8px 0 2px 0' }}>
            {dashboardData.kpis.conditional_count}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Warnings flagged</span>
        </div>

        {/* KPI 7: Not Certified */}
        <div className="glass-card stat-card" style={{ padding: '18px' }}>
          <span style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Not Certified
          </span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#e74c3c', margin: '8px 0 2px 0' }}>
            {dashboardData.kpis.not_certified_count}
          </div>
          <span style={{ fontSize: '11px', color: '#e74c3c' }}>Critical failures</span>
        </div>
      </div>

      {/* 3. Main Section: WHO TESTED WHAT (Testing Activity Table) */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={17} style={{ color: 'var(--accent-cyan)' }} />
              Testing Activity — Who Tested Which Agent?
            </h3>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              Real-time surveillance of all AI agent evaluations across the enterprise
            </span>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => onNavigate('activity')}
            style={{ fontSize: '12px', padding: '6px 14px', gap: '6px' }}
          >
            <span>Full Activity Log</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>User</th>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>Agent</th>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>Date</th>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>Time</th>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>Score</th>
                <th style={{ padding: '10px 14px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {dashboardData.recent_activity.length > 0 ? (
                dashboardData.recent_activity.map((item) => {
                  const isCertified = item.tier === 'CERTIFIED';
                  const isConditional = item.tier === 'CONDITIONAL';

                  return (
                    <tr
                      key={item.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.15s' }}
                      className="table-row-hover"
                      onClick={() => onViewTestDetails(item.id)}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'linear-gradient(135deg, #2ecc71, #00b4d8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#fff' }}>
                            {item.tested_by_name ? item.tested_by_name[0].toUpperCase() : 'U'}
                          </div>
                          <span>{item.tested_by_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {item.agent_name}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        {formatDate(item.created_at)}
                      </td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {formatTime(item.created_at)}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontWeight: '800',
                          color: isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c'
                        }}>
                          {item.trust_score}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
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
                      <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewTestDetails(item.id);
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-cyan)', gap: '4px' }}
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
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No testing activity yet. Once users start testing agents, their activity will appear here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Mini Analytics Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Certification Distribution Pie Chart */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px' }}>
            Certification Distribution
          </h3>
          <div style={{ width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '8px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                      padding: '8px 12px'
                    }}
                    labelStyle={{ color: '#ffffff', fontWeight: '800', fontSize: '12px' }}
                    itemStyle={{ color: '#ffffff', fontWeight: '600', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No distribution data yet.</span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '11.5px', marginTop: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2ecc71' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71' }}></span>
              Certified ({dashboardData.kpis.certified_count})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f1c40f' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f1c40f' }}></span>
              Conditional ({dashboardData.kpis.conditional_count})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e74c3c' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e74c3c' }}></span>
              Not Certified ({dashboardData.kpis.not_certified_count})
            </span>
          </div>
        </div>

        {/* Quick Actions & Governance Hub Card */}
        <div className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={17} style={{ color: 'var(--accent-cyan)' }} />
                <span>Enterprise Governance Hub</span>
              </h3>
              <span style={{
                fontSize: '10.5px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'rgba(46, 204, 113, 0.15)',
                color: '#2ecc71',
                border: '1px solid rgba(46, 204, 113, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2ecc71' }}></span>
                LIVE
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Supervise AI safety researchers, audit logs, and export certification records for EU AI Act & NIST AI RMF regulatory audits.
            </p>
          </div>

          {/* Regulatory Standards Compliance Matrix */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.18)',
            padding: '12px',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2ecc71', flexShrink: 0 }}></span>
              <span><strong>EU AI Act:</strong> <span style={{ color: '#2ecc71' }}>Enforced</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38bdf8', flexShrink: 0 }}></span>
              <span><strong>NIST AI RMF:</strong> <span style={{ color: '#38bdf8' }}>Compliant</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a855f7', flexShrink: 0 }}></span>
              <span><strong>OWASP Top 10:</strong> <span style={{ color: '#a855f7' }}>Guarded</span></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f1c40f', flexShrink: 0 }}></span>
              <span><strong>Ed25519 Signatures:</strong> <span style={{ color: '#f1c40f' }}>Active</span></span>
            </div>
          </div>

          {/* Quick Action Navigation Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('users')}
              style={{
                fontSize: '12px',
                padding: '9px 12px',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(56, 189, 248, 0.08)',
                borderColor: 'rgba(56, 189, 248, 0.25)',
                color: 'var(--text-primary)'
              }}
            >
              <Users size={14} style={{ color: '#38bdf8' }} />
              <span style={{ fontWeight: '600' }}>Manage Users</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('agents')}
              style={{
                fontSize: '12px',
                padding: '9px 12px',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(168, 85, 247, 0.08)',
                borderColor: 'rgba(168, 85, 247, 0.25)',
                color: 'var(--text-primary)'
              }}
            >
              <Layers size={14} style={{ color: '#a855f7' }} />
              <span style={{ fontWeight: '600' }}>Agent Fleet</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('analytics')}
              style={{
                fontSize: '12px',
                padding: '9px 12px',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(46, 204, 113, 0.08)',
                borderColor: 'rgba(46, 204, 113, 0.25)',
                color: 'var(--text-primary)'
              }}
            >
              <TrendingUp size={14} style={{ color: '#2ecc71' }} />
              <span style={{ fontWeight: '600' }}>Deep Analytics</span>
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('reports')}
              style={{
                fontSize: '12px',
                padding: '9px 12px',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(241, 196, 15, 0.08)',
                borderColor: 'rgba(241, 196, 15, 0.25)',
                color: 'var(--text-primary)'
              }}
            >
              <FileText size={14} style={{ color: '#f1c40f' }} />
              <span style={{ fontWeight: '600' }}>Export Reports</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
