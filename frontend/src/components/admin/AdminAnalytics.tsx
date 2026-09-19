import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  BarChart2,
  PieChart as PieIcon,
  Activity,
  Calendar,
  RefreshCw,
  Users,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const AdminAnalytics: React.FC = () => {
  const [days, setDays] = useState<number>(30);
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const BACKEND_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '' ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/analytics?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const certColors: Record<string, string> = {
    CERTIFIED: '#2ecc71',
    CONDITIONAL: '#f1c40f',
    NOT_CERTIFIED: '#e74c3c',
    FRAMEWORK_VALIDATION_ONLY: '#38bdf8',
    UNTESTED: '#94a3b8'
  };

  const formatTierLabel = (tier: string) => {
    switch (tier) {
      case 'CERTIFIED': return 'Certified';
      case 'CONDITIONAL': return 'Conditional';
      case 'NOT_CERTIFIED': return 'Not Certified';
      case 'FRAMEWORK_VALIDATION_ONLY': return 'Framework Only';
      default: return tier.replace(/_/g, ' ');
    }
  };

  const volumeTrend = analyticsData?.volume_trend || [];
  const certDist = (analyticsData?.certification_distribution || []).map((d: any) => ({
    name: d.tier,
    value: d.count,
    color: certColors[d.tier] || 'var(--accent-cyan)'
  }));
  const agentRankings = analyticsData?.agent_rankings || [];
  const userRankings = analyticsData?.user_rankings || [];

  return (
    <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart2 size={20} style={{ color: 'var(--accent-cyan)' }} />
            Organization Analytics & Statistical Trends
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Deep inspection of evaluation volume, certification pass rates, and fleet performance.
          </p>
        </div>

        {/* Days Toggle */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                border: 'none',
                background: days === d ? 'var(--accent-cyan)' : 'transparent',
                color: days === d ? '#0f172a' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              {d} Days
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Test Volume & Score Trend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        
        {/* Test Volume Chart */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} style={{ color: 'var(--accent-cyan)' }} />
            Test Volume (Tests per Day)
          </h3>
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    padding: '8px 12px'
                  }}
                  labelStyle={{ color: '#ffffff', fontWeight: '800', fontSize: '12px', marginBottom: '4px' }}
                  itemStyle={{ color: '#38bdf8', fontWeight: '700', fontSize: '12px' }}
                  formatter={(v: any) => [v, 'Tests Conducted']}
                />
                <Bar dataKey="test_count" fill="var(--accent-cyan)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score Trend Over Time */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} style={{ color: '#2ecc71' }} />
            Mean Trust Score Evolution
          </h3>
          <div style={{ width: '100%', height: '220px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={volumeTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="analyticsScoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ecc71" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2ecc71" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                    padding: '8px 12px'
                  }}
                  labelStyle={{ color: '#ffffff', fontWeight: '800', fontSize: '12px', marginBottom: '4px' }}
                  itemStyle={{ color: '#2ecc71', fontWeight: '700', fontSize: '12px' }}
                  formatter={(v: any) => [`${v}%`, 'Average Trust Score']}
                />
                <Area type="monotone" dataKey="avg_score" stroke="#2ecc71" strokeWidth={2.5} fill="url(#analyticsScoreGrad)" connectNulls={true} dot={{ r: 3, fill: '#2ecc71' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Row 2: Certification Distribution & Rankings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Certification Distribution Donut Chart */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieIcon size={16} style={{ color: '#a855f7' }} />
            Certification Status Distribution
          </h3>
          <div style={{ width: '100%', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {certDist.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={certDist} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {certDist.map((entry: any, idx: number) => (
                      <Cell key={`cell-${idx}`} fill={entry.color} />
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
                    labelStyle={{ color: '#ffffff', fontWeight: '800', fontSize: '12px', marginBottom: '4px' }}
                    itemStyle={{ color: '#ffffff', fontWeight: '600', fontSize: '12px' }}
                    formatter={(val: any, name: any) => [val, formatTierLabel(String(name))]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No distribution records.</span>
            )}
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px 10px',
            fontSize: '11.5px',
            marginTop: '12px',
            padding: '0 4px'
          }}>
            {certDist.map((d: any) => (
              <span
                key={d.name}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: d.color,
                  background: `${d.color}15`,
                  border: `1px solid ${d.color}35`,
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontWeight: '700',
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: d.color, flexShrink: 0 }}></span>
                <span>{formatTierLabel(d.name)}</span>
                <span style={{ opacity: 0.85, fontWeight: '800' }}>({d.value})</span>
              </span>
            ))}
          </div>
        </div>

        {/* Agent Performance Ranking */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} style={{ color: '#f1c40f' }} />
            Agent Performance Rankings
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {agentRankings.map((ag: any, idx: number) => (
              <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{ag.agent_name}</span>
                  <span style={{ fontWeight: '700', color: ag.avg_score >= 80 ? '#2ecc71' : ag.avg_score >= 60 ? '#f1c40f' : '#e74c3c' }}>
                    {ag.avg_score}% ({ag.test_count} tests)
                  </span>
                </div>
                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${ag.avg_score}%`,
                    height: '100%',
                    background: ag.avg_score >= 80 ? '#2ecc71' : ag.avg_score >= 60 ? '#f1c40f' : '#e74c3c',
                    borderRadius: '3px'
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Performance Ranking */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} style={{ color: 'var(--accent-cyan)' }} />
            User Testing Volume & Quality
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {userRankings.map((u: any, idx: number) => (
              <div key={idx} style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{u.name}</span>
                  <span style={{ fontWeight: '700', color: '#2ecc71' }}>
                    {u.test_count} tests • Avg: {u.avg_score}%
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
