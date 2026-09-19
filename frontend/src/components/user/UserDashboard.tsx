import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Shield,
  Play,
  TrendingUp,
  Award,
  Layers,
  Activity,
  ArrowUpRight,
  Clock,
  ChevronRight,
  RefreshCw,
  FileText,
  User,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Zap,
  BookOpen,
  History,
  Calendar,
  BarChart3,
  Sliders,
  Check,
  Flame,
  Search,
  Filter
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine
} from 'recharts';
import { getTimeGreeting } from '../../utils/timeGreeting';

interface UserDashboardProps {
  onStartNewTest: () => void;
  onViewTestResult: (testId: number) => void;
  onNavigate: (tab: string) => void;
  user: {
    id: number | string;
    name: string;
    email: string;
    role: string;
    avatar_url?: string;
  };
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  onStartNewTest,
  onViewTestResult,
  onNavigate,
  user
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [analyticsView, setAnalyticsView] = useState<'trends' | 'categories' | 'phases'>('trends');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [dashboardData, setDashboardData] = useState<{
    kpis: {
      total_tests: number;
      tests_this_week: number;
      agents_tested: number;
      average_score: number;
      certified_count: number;
      pass_count?: number;
      fail_count?: number;
      running_count?: number;
    };
    recent_tests: any[];
    score_trends: {
      '7d': any[];
      '30d': any[];
      '90d': any[];
    };
    categories?: any[];
    phase_matrix?: any[];
    vulnerabilities?: {
      critical: number;
      warning: number;
      low: number;
      passed: number;
    };
  }>({
    kpis: {
      total_tests: 10,
      tests_this_week: 3,
      agents_tested: 7,
      average_score: 73.5,
      certified_count: 5,
      pass_count: 7,
      fail_count: 2,
      running_count: 1
    },
    recent_tests: [],
    score_trends: {
      '7d': [
        { date: 'Sep 12', score: 68, count: 2 },
        { date: 'Sep 13', score: 74, count: 1 },
        { date: 'Sep 14', score: 71, count: 3 },
        { date: 'Sep 15', score: 79, count: 2 },
        { date: 'Sep 16', score: 82, count: 4 },
        { date: 'Sep 17', score: 78, count: 1 },
        { date: 'Sep 18', score: 85, count: 3 }
      ],
      '30d': [],
      '90d': []
    },
    categories: [
      { category: 'Prompt Injection Defense', score: 88, status: 'Strong', tests: 18, color: '#00f0ff' },
      { category: 'PII & Data Leakage', score: 94, status: 'Optimal', tests: 22, color: '#2ecc71' },
      { category: 'Tool & Action Safety', score: 82, status: 'Strong', tests: 15, color: '#a855f7' },
      { category: 'Hallucination Control', score: 79, status: 'Moderate', tests: 14, color: '#f59e0b' },
      { category: 'Jailbreak Immunity', score: 86, status: 'Strong', tests: 19, color: '#3b82f6' },
      { category: 'Output & Bias Governance', score: 91, status: 'Optimal', tests: 16, color: '#ec4899' }
    ],
    phase_matrix: [
      { phase_num: 1, phase_id: 'phase01', name: 'Static Rule Linting', pass_rate: 96, status: 'PASSED' },
      { phase_num: 2, phase_id: 'phase02', name: 'Model & Tool Inventory', pass_rate: 92, status: 'PASSED' },
      { phase_num: 3, phase_id: 'phase03', name: 'AST Static Code Analysis', pass_rate: 88, status: 'PASSED' },
      { phase_num: 4, phase_id: 'phase04', name: 'Direct Prompt Injection', pass_rate: 84, status: 'PASSED' },
      { phase_num: 5, phase_id: 'phase05', name: 'Indirect Prompt Injection', pass_rate: 76, status: 'WARNING' },
      { phase_num: 6, phase_id: 'phase06', name: 'Agent Jailbreaks', pass_rate: 82, status: 'PASSED' },
      { phase_num: 7, phase_id: 'phase07', name: 'Tool Argument Poisoning', pass_rate: 89, status: 'PASSED' },
      { phase_num: 8, phase_id: 'phase08', name: 'Privilege Escalation', pass_rate: 85, status: 'PASSED' },
      { phase_num: 9, phase_id: 'phase09', name: 'Excessive Tool Perms', pass_rate: 79, status: 'WARNING' },
      { phase_num: 10, phase_id: 'phase10', name: 'SSRF & Network Boundary', pass_rate: 94, status: 'PASSED' },
      { phase_num: 11, phase_id: 'phase11', name: 'State Deserialization', pass_rate: 91, status: 'PASSED' },
      { phase_num: 12, phase_id: 'phase12', name: 'Denial of Wallet (DoW)', pass_rate: 72, status: 'WARNING' },
      { phase_num: 13, phase_id: 'phase13', name: 'Hallucination Benchmark', pass_rate: 78, status: 'WARNING' },
      { phase_num: 14, phase_id: 'phase14', name: 'Context Budget Exhaustion', pass_rate: 85, status: 'PASSED' },
      { phase_num: 15, phase_id: 'phase15', name: 'PII & Secret Extraction', pass_rate: 95, status: 'PASSED' },
      { phase_num: 16, phase_id: 'phase16', name: 'Multi-Turn Drift Attack', pass_rate: 80, status: 'PASSED' },
      { phase_num: 17, phase_id: 'phase17', name: 'Supply Chain Verification', pass_rate: 88, status: 'PASSED' },
      { phase_num: 18, phase_id: 'phase18', name: 'Autonomous Sandboxing', pass_rate: 93, status: 'PASSED' },
      { phase_num: 19, phase_id: 'phase19', name: 'Browser Exploitation', pass_rate: 86, status: 'PASSED' }
    ],
    vulnerabilities: {
      critical: 2,
      warning: 6,
      low: 11,
      passed: 38
    }
  });

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/user/dashboard`, {
        headers: {
          'X-User-Id': String(user?.id || 2)
        }
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(prev => ({
          ...prev,
          ...data,
          kpis: {
            ...prev.kpis,
            ...(data.kpis || {})
          },
          score_trends: {
            ...prev.score_trends,
            ...(data.score_trends || {})
          }
        }));
      }
    } catch (err) {
      console.error('Failed to load user dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user?.id]);

  const activeTrendData = dashboardData.score_trends[timeRange] || dashboardData.score_trends['7d'] || [];

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
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return isoStr;
    }
  };

  const filteredRecentTests = dashboardData.recent_tests.filter(t => {
    const matchesSearch = t.agent_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.audit_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || t.tier?.toUpperCase() === statusFilter.toUpperCase();
    return matchesSearch && matchesStatus;
  });

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 10000); // refreshes real-time every 10 seconds
    return () => clearInterval(timer);
  }, []);

  const timeGreeting = getTimeGreeting();
  const todayFormatted = currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="user-dashboard-wrapper animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* ── 1. HERO GREETING BANNER ───────────────────────────────── */}
      <div style={{
        padding: '28px 36px',
        borderRadius: '20px',
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(240, 246, 255, 0.95) 60%, rgba(224, 238, 255, 0.95) 100%)',
        border: '1px solid rgba(191, 219, 254, 0.8)',
        boxShadow: '0 10px 30px rgba(37, 99, 235, 0.06)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '28px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        
        {/* Subtle decorative background watermarks */}
        <div style={{
          position: 'absolute',
          right: '-50px',
          top: '-50px',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(56, 189, 248, 0.05) 60%, transparent 80%)',
          filter: 'blur(40px)',
          pointerEvents: 'none'
        }} />

        {/* ── LEFT COLUMN: Greeting, Status Pills, Action Buttons ───── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', zIndex: 2, flex: 1 }}>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '900',
              color: '#0f172a',
              margin: '0 0 6px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              letterSpacing: '-0.5px'
            }}>
              <span>{timeGreeting.greeting}</span>
              <span style={{ color: '#3b82f6' }}>{user?.name || 'Ismeet'}</span>
              <span style={{ fontSize: '24px' }}>{timeGreeting.emoji}</span>
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: '500' }}>
              {timeGreeting.subtext}
            </p>
          </div>

          {/* Status Pills Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.85)',
            border: '1px solid #e2e8f0',
            padding: '6px 16px',
            borderRadius: '12px',
            width: 'fit-content',
            fontSize: '12.5px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#16a34a',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: '800',
                fontSize: '11px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }} />
                USER
              </span>
            </div>

            <span style={{ color: '#cbd5e1' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', whiteSpace: 'nowrap' }}>
              <Shield size={13} color="#3b82f6" />
              <span style={{ color: '#64748b' }}>Workspace:</span>
              <span style={{ fontWeight: '700', color: '#1e293b' }}>Enterprise</span>
            </div>

            <span style={{ color: '#cbd5e1' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', whiteSpace: 'nowrap' }}>
              <Calendar size={13} color="#8b5cf6" />
              <span style={{ color: '#64748b' }}>Today:</span>
              <span style={{ fontWeight: '700', color: '#1e293b' }}>{todayFormatted}</span>
            </div>

            <span style={{ color: '#cbd5e1' }}>|</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', whiteSpace: 'nowrap' }}>
              <Clock size={13} color="#f59e0b" />
              <span style={{ color: '#64748b' }}>Last Login:</span>
              <span style={{ fontWeight: '700', color: '#1e293b' }}>2 hours ago</span>
            </div>
          </div>

          {/* Action Button */}
          <div>
            <button
              onClick={onStartNewTest}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #6366f1 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '11px 22px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <Play size={15} fill="#ffffff" />
              <span>+ Test New Agent</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Holographic 3D Logo & Floating Chips ────── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          zIndex: 2,
          minWidth: '280px'
        }}>
          {/* Main 3D Glowing Card */}
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: '280px',
            height: '110px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Center Delta Badge */}
            <div style={{
              width: '74px',
              height: '74px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
              border: '2px solid rgba(191, 219, 254, 0.9)',
              boxShadow: '0 12px 30px rgba(37, 99, 235, 0.18), 0 0 0 6px rgba(59, 130, 246, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 3
            }}>
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L2 20H22L12 3Z" fill="url(#heroDeltaGrad)" />
                <path d="M12 8L6 18H18L12 8Z" fill="#ffffff" opacity="0.9" />
                <defs>
                  <linearGradient id="heroDeltaGrad" x1="2" y1="3" x2="22" y2="20" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#00f0ff" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Floating Chip 1: Analyze */}
            <div style={{
              position: 'absolute',
              top: '8px',
              left: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#1e293b',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Activity size={11} color="#3b82f6" />
              <span>Analyze</span>
            </div>

            {/* Floating Chip 2: Validate */}
            <div style={{
              position: 'absolute',
              bottom: '8px',
              left: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#1e293b',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <ShieldCheck size={11} color="#2563eb" />
              <span>Validate</span>
            </div>

            {/* Floating Chip 3: Certify */}
            <div style={{
              position: 'absolute',
              top: '8px',
              right: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#1e293b',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <CheckCircle2 size={11} color="#22c55e" />
              <span>Certify</span>
            </div>

            {/* Floating Chip 4: Improve */}
            <div style={{
              position: 'absolute',
              bottom: '8px',
              right: '10px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: '700',
              color: '#1e293b',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <BarChart3 size={11} color="#8b5cf6" />
              <span>Improve</span>
            </div>
          </div>

          {/* Operational status pill */}
          <div style={{
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '4px 12px',
            fontSize: '11.5px',
            fontWeight: '600',
            color: '#1e293b',
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            cursor: 'pointer'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span>All Systems Operational</span>
            <ChevronRight size={12} color="#94a3b8" />
          </div>
        </div>

      </div>

      {/* ── 2. TOP 4 KPI METRIC CARDS WITH SPARKLINES ──────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px'
      }}>
        
        {/* KPI 1: TOTAL TESTS */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '18px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <FileText size={18} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                TOTAL TESTS
              </span>
            </div>

            <button
              onClick={() => onNavigate('tests')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '14px 0 6px 0' }}>
            <span style={{ fontSize: '36px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
              {dashboardData.kpis.total_tests}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>
              ↑ 28% <span style={{ color: '#94a3b8', fontWeight: '500' }}>vs. last week</span>
            </span>
          </div>

          {/* Embedded Blue Wave Sparkline */}
          <div style={{ height: '38px', margin: '4px 0 10px 0', width: '100%' }}>
            <svg viewBox="0 0 200 40" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="blueSpark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,30 Q30,10 60,25 T120,15 T160,28 T200,8 L200,40 L0,40 Z"
                fill="url(#blueSpark)"
              />
              <path
                d="M0,30 Q30,10 60,25 T120,15 T160,28 T200,8"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
            <span>7 passed • 2 failed • 1 running</span>
          </div>
        </div>

        {/* KPI 2: AGENTS TESTED */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '18px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(168, 85, 247, 0.1)',
                color: '#a855f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Layers size={18} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                AGENTS TESTED
              </span>
            </div>

            <button
              onClick={() => onNavigate('agents')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '14px 0 6px 0' }}>
            <span style={{ fontSize: '36px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
              {dashboardData.kpis.agents_tested}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>
              ↑ 17% <span style={{ color: '#94a3b8', fontWeight: '500' }}>vs. last week</span>
            </span>
          </div>

          {/* Embedded Purple Bar Sparkline */}
          <div style={{ height: '38px', margin: '4px 0 10px 0', display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
            {[35, 50, 40, 70, 95, 60, 80, 55, 90, 100].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: i >= 7 ? '#a855f7' : 'rgba(168, 85, 247, 0.35)',
                  borderRadius: '3px 3px 0 0',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7' }} />
            <span>Unique AI agent models</span>
          </div>
        </div>

        {/* KPI 3: AVERAGE SCORE */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '18px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(34, 197, 94, 0.1)',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp size={18} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                AVERAGE SCORE
              </span>
            </div>

            <button
              onClick={() => setAnalyticsView('trends')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '14px 0 6px 0' }}>
            <span style={{ fontSize: '36px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
              {dashboardData.kpis.average_score}%
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>
              ↑ 12% <span style={{ color: '#94a3b8', fontWeight: '500' }}>vs. last week</span>
            </span>
          </div>

          {/* Embedded Emerald Wave Sparkline */}
          <div style={{ height: '38px', margin: '4px 0 10px 0', width: '100%' }}>
            <svg viewBox="0 0 200 40" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <path
                d="M0,28 Q25,35 50,20 T100,25 T150,12 T200,6"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
            <span>Mean trust score rating</span>
          </div>
        </div>

        {/* KPI 4: CERTIFIED */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '18px 20px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Award size={18} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                CERTIFIED
              </span>
            </div>

            <button
              onClick={() => onNavigate('reports')}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '14px 0 6px 0' }}>
            <span style={{ fontSize: '36px', fontWeight: '900', color: '#0f172a', lineHeight: 1 }}>
              {dashboardData.kpis.certified_count}
            </span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>
              ↑ 25% <span style={{ color: '#94a3b8', fontWeight: '500' }}>vs. last week</span>
            </span>
          </div>

          {/* Embedded Gold Bar Sparkline */}
          <div style={{ height: '38px', margin: '4px 0 10px 0', display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
            {[30, 45, 40, 60, 50, 75, 85, 80, 95, 100].map((h, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${h}%`,
                  background: i >= 6 ? '#f59e0b' : 'rgba(245, 158, 11, 0.35)',
                  borderRadius: '3px 3px 0 0',
                  transition: 'all 0.3s ease'
                }}
              />
            ))}
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            <span>Enterprise production ready</span>
          </div>
        </div>

      </div>

      {/* ── 3. EXPANDED ANALYTICS & CHARTS SECTION ─────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.8fr 1.2fr',
        gap: '20px'
      }}>
        
        {/* Left Main Chart Card: Trust Score & Multi-Dimensional Evolution */}
        <div className="glass-card" style={{
          padding: '24px',
          borderRadius: '16px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="#3b82f6" />
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Trust Score Evolution & Safety Benchmarks
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Continuous evaluation performance against enterprise thresholds
              </p>
            </div>

            {/* View Selector & Time Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <button
                  onClick={() => setAnalyticsView('trends')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: analyticsView === 'trends' ? '#ffffff' : 'transparent',
                    color: analyticsView === 'trends' ? '#2563eb' : '#64748b',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: analyticsView === 'trends' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Trend Area
                </button>
                <button
                  onClick={() => setAnalyticsView('categories')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: analyticsView === 'categories' ? '#ffffff' : 'transparent',
                    color: analyticsView === 'categories' ? '#2563eb' : '#64748b',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: analyticsView === 'categories' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  Safety Pillars
                </button>
                <button
                  onClick={() => setAnalyticsView('phases')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: analyticsView === 'phases' ? '#ffffff' : 'transparent',
                    color: analyticsView === 'phases' ? '#2563eb' : '#64748b',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: analyticsView === 'phases' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  19 Phases Matrix
                </button>
              </div>

              {/* Time Range Pills */}
              <div style={{ display: 'flex', background: '#f8fafc', padding: '3px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                {(['7d', '30d', '90d'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTimeRange(t)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      border: 'none',
                      background: timeRange === t ? '#3b82f6' : 'transparent',
                      color: timeRange === t ? '#ffffff' : '#64748b',
                      cursor: 'pointer'
                    }}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Render Active View */}
          <div style={{ width: '100%', height: '260px', marginTop: 'auto' }}>
            {analyticsView === 'trends' && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={activeTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="userScoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.4} />
                  <ReferenceLine y={75} stroke="#3b82f6" strokeDasharray="3 3" strokeOpacity={0.35} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#0f172a',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                    }}
                    formatter={(value: any, _name: any, item: any) => [
                      `${value}% (${item?.payload?.count > 0 ? `${item.payload.count} tests` : 'Rolling avg'})`,
                      'Trust Score'
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#2563eb"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#userScoreGrad)"
                    connectNulls={true}
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      if (!cx || !cy) return null;
                      const isEvalDay = payload?.has_test || (payload?.count && payload.count > 0) || timeRange === '7d';
                      if (isEvalDay) {
                        return (
                          <circle
                            key={`dot-${cx}-${cy}`}
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill="#2563eb"
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                        );
                      }
                      return null;
                    }}
                    activeDot={{ r: 6, fill: '#2563eb', stroke: '#ffffff', strokeWidth: 2.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {analyticsView === 'categories' && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboardData.categories || []} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="category" stroke="#94a3b8" fontSize={10} tickLine={false} interval={0} angle={-15} textAnchor="end" />
                  <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#0f172a'
                    }}
                    formatter={(value: any) => [`${value}%`, 'Compliance Rating']}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {(dashboardData.categories || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}

            {analyticsView === 'phases' && (
              <div style={{
                height: '100%',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px',
                paddingRight: '6px'
              }}>
                {(dashboardData.phase_matrix || []).map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#94a3b8', width: '22px' }}>
                        P{p.phase_num}
                      </span>
                      <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#1e293b' }}>
                        {p.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '45px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${p.pass_rate}%`,
                          height: '100%',
                          background: p.pass_rate >= 85 ? '#22c55e' : (p.pass_rate >= 75 ? '#f59e0b' : '#ef4444')
                        }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#0f172a' }}>
                        {p.pass_rate}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Benchmarks Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '12px',
            marginTop: '12px',
            borderTop: '1px solid #f1f5f9',
            fontSize: '11.5px',
            color: '#64748b'
          }}>
            <div style={{ display: 'flex', gap: '16px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
                <span>Platinum ≥90%</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                <span>Gold ≥75%</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
                <span>Silver ≥60%</span>
              </span>
            </div>

            <button
              onClick={fetchDashboard}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RefreshCw size={12} className={isLoading ? 'spin-animation' : ''} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* Right Side: Security Governance & Vulnerability Breakdown */}
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#16a34a" />
                Security Risk Distribution
              </h3>
              <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a' }}>
                Optimal
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Evaluation findings across active agent models
            </p>
          </div>

          {/* 4 Severity Meters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: 'Passed Tests', count: dashboardData.vulnerabilities?.passed || 38, total: 50, color: '#22c55e', desc: 'Compliant with safety policy' },
              { label: 'Low Severity Findings', count: dashboardData.vulnerabilities?.low || 11, total: 50, color: '#3b82f6', desc: 'Minor style or telemetry drift' },
              { label: 'Moderate Warnings', count: dashboardData.vulnerabilities?.warning || 6, total: 50, color: '#f59e0b', desc: 'Potential tool scope mismatch' },
              { label: 'Critical Vulnerabilities', count: dashboardData.vulnerabilities?.critical || 2, total: 50, color: '#ef4444', desc: 'Injection & auth bypass alerts' }
            ].map((sev, idx) => (
              <div key={idx} style={{ padding: '10px 14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#1e293b' }}>{sev.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: sev.color }}>{sev.count}</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${(sev.count / sev.total) * 100}%`, height: '100%', background: sev.color, borderRadius: '3px' }} />
                </div>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>{sev.desc}</span>
              </div>
            ))}
          </div>

          {/* Quick CTA to Test */}
          <div style={{
            marginTop: 'auto',
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
            border: '1px solid rgba(191, 219, 254, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>Ready for a new scan?</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Run 19 automated phases in 30s</div>
            </div>
            <button
              onClick={onStartNewTest}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Start Scan
            </button>
          </div>
        </div>

      </div>

      {/* ── 4. RECENT TEST RUNS & EVALUATION HISTORY ───────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#3b82f6" />
              Recent Evaluation Runs
            </h3>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>Latest test runs conducted by {user?.name || 'Ismeet'}</span>
          </div>

          {/* Search & Status Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search agent or audit ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  padding: '6px 12px 6px 30px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                  width: '180px'
                }}
              />
            </div>

            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
              {['ALL', 'CERTIFIED', 'FAILED'].map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    background: statusFilter === s ? '#ffffff' : 'transparent',
                    color: statusFilter === s ? '#2563eb' : '#64748b',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('tests')}
              style={{ fontSize: '12px', padding: '6px 12px', gap: '6px' }}
            >
              <span>View All History</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Agent Name</th>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Evaluation Date</th>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Trust Score</th>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Certification Tier</th>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>Duration</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecentTests.length > 0 ? (
                filteredRecentTests.map((test) => {
                  const isCertified = test.tier === 'CERTIFIED';
                  const isConditional = test.tier === 'CONDITIONAL';

                  return (
                    <tr
                      key={test.id}
                      style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                      className="table-row-hover"
                    >
                      <td style={{ padding: '12px', fontWeight: '700', color: '#0f172a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            width: '8px', height: '8px', borderRadius: '50%',
                            background: isCertified ? '#22c55e' : isConditional ? '#f59e0b' : '#ef4444'
                          }}></span>
                          <span>{test.agent_name}</span>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: '700',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: test.is_latest ? 'rgba(37, 99, 235, 0.12)' : 'rgba(100, 116, 139, 0.1)',
                            color: test.is_latest ? '#2563eb' : '#64748b'
                          }}>
                            {test.version || 'v1'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', color: '#64748b' }}>
                        {formatDate(test.created_at)}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                          <span style={{
                            fontWeight: '800',
                            fontSize: '13.5px',
                            color: isCertified ? '#16a34a' : isConditional ? '#d97706' : '#dc2626'
                          }}>
                            {test.trust_score}%
                          </span>
                          {test.score_delta !== undefined && test.score_delta !== 0 && (
                            <span style={{
                              fontSize: '11px',
                              fontWeight: '700',
                              color: test.score_delta > 0 ? '#16a34a' : '#dc2626'
                            }}>
                              {test.score_delta > 0 ? `+${test.score_delta}%` : `${test.score_delta}%`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '800',
                          background: isCertified ? 'rgba(34, 197, 94, 0.12)' : isConditional ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                          color: isCertified ? '#16a34a' : isConditional ? '#d97706' : '#dc2626',
                          border: `1px solid ${isCertified ? 'rgba(34, 197, 94, 0.3)' : isConditional ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {test.tier}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: '#64748b', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {formatDuration(test.duration_ms)}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          onClick={() => onViewTestResult(test.id)}
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            color: '#2563eb',
                            gap: '4px',
                            fontWeight: '600'
                          }}
                        >
                          <span>View Result</span>
                          <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    No evaluations found. Start your first AI agent audit!
                    <div style={{ marginTop: '12px' }}>
                      <button
                        onClick={onStartNewTest}
                        style={{
                          background: '#2563eb',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          padding: '8px 16px',
                          fontSize: '12.5px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        + Test New Agent
                      </button>
                    </div>
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
