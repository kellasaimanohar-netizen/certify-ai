import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Search,
  FileText,
  CheckCircle2,
  ChevronDown,
  Play,
  RefreshCw,
  Info,
  Download,
  Activity,
  AlertCircle,
  Sun,
  Moon,
  User,
  Settings,
  Bell,
  Code,
  ArrowRightLeft,
  LogOut,
  X,
  Zap,
  Sparkles
} from 'lucide-react';
import './App.css';

import { Sidebar, type NavTabType } from './components/Sidebar';
import { AdminLogin, type AdminUser } from './components/AdminLogin';

// User Workspace Components
import { UserDashboard } from './components/user/UserDashboard';
import { UserTestAgent } from './components/user/UserTestAgent';
import { UserTestHistory } from './components/user/UserTestHistory';
import { UserReports } from './components/user/UserReports';
import { UserProfile } from './components/user/UserProfile';

// Admin Workspace Components
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminTestingActivity } from './components/admin/AdminTestingActivity';
import { AdminUsers } from './components/admin/AdminUsers';
import { AdminAgents } from './components/admin/AdminAgents';
import { AdminReports } from './components/admin/AdminReports';
import { AdminAnalytics } from './components/admin/AdminAnalytics';
import { AdminSettings } from './components/admin/AdminSettings';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

import { BACKEND_URL } from './utils/apiConfig';

const DEFAULT_SYED: AdminUser = {
  id: 1,
  user_id: '1',
  name: 'Syed',
  email: 'syed@certifyai.in',
  role: 'ADMIN',
  department: 'Enterprise AI Governance',
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  status: 'Active'
};

const DEFAULT_ISMEET: AdminUser = {
  id: 2,
  user_id: '2',
  name: 'Ismeet',
  email: 'ismeet@certifyai.in',
  role: 'USER',
  department: 'AI Quality Assurance & Testing',
  avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  status: 'Active'
};

function parsePathToTab(path: string): { tab: NavTabType; roleHint?: 'ADMIN' | 'USER' } {
  const cleanPath = path.toLowerCase().replace(/\/$/, '');
  
  if (!cleanPath || cleanPath === '' || cleanPath === '/login') return { tab: 'login' };
  
  if (cleanPath === '/admin' || cleanPath === '/admin/dashboard') {
    return { tab: 'admin-dashboard', roleHint: 'ADMIN' };
  }
  if (cleanPath === '/admin/activity' || cleanPath === '/admin/testing-activity') {
    return { tab: 'admin-activity', roleHint: 'ADMIN' };
  }
  if (cleanPath === '/admin/users') {
    return { tab: 'admin-users', roleHint: 'ADMIN' };
  }
  if (cleanPath === '/admin/agents') {
    return { tab: 'admin-agents', roleHint: 'ADMIN' };
  }
  if (cleanPath === '/admin/reports') {
    return { tab: 'admin-reports', roleHint: 'ADMIN' };
  }
  if (cleanPath === '/admin/analytics') {
    return { tab: 'admin-analytics', roleHint: 'ADMIN' };
  }
  if (cleanPath === '/admin/settings') {
    return { tab: 'admin-settings', roleHint: 'ADMIN' };
  }

  if (cleanPath === '/user' || cleanPath === '/user/dashboard') {
    return { tab: 'user-dashboard', roleHint: 'USER' };
  }
  if (cleanPath === '/user/test-agent' || cleanPath === '/user/runner') {
    return { tab: 'user-test-agent', roleHint: 'USER' };
  }
  if (cleanPath === '/user/tests' || cleanPath === '/user/history') {
    return { tab: 'user-tests', roleHint: 'USER' };
  }
  if (cleanPath === '/user/agents') {
    return { tab: 'user-dashboard', roleHint: 'USER' };
  }
  if (cleanPath === '/user/reports') {
    return { tab: 'user-reports', roleHint: 'USER' };
  }
  if (cleanPath === '/user/profile') {
    return { tab: 'user-profile', roleHint: 'USER' };
  }

  // Default fallback to login
  return { tab: 'login' };
}

function App() {
  // 1. Initial Route Resolution
  const initialRoute = parsePathToTab(window.location.pathname);

  // 2. Current Authenticated User (null by default on initial entry or /login)
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => {
    if (initialRoute.tab === 'login') {
      return null;
    }
    const saved = localStorage.getItem('certifyai_admin_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.role) {
          return parsed;
        }
      } catch {
        // Ignore parse error
      }
    }
    return null;
  });

  // 3. Navigation State - defaults to 'login' when at root or /login
  const [activeTab, setActiveTabState] = useState<NavTabType>(() => {
    if (initialRoute.tab === 'login') {
      return 'login';
    }
    const saved = localStorage.getItem('certifyai_admin_user');
    if (!saved) {
      return 'login';
    }
    return initialRoute.tab;
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme-mode');
    return saved ? saved === 'dark' : true;
  });

  // Notifications & User Profile Menu
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Navigation props/parameters
  const [preselectedAgentForTest, setPreselectedAgentForTest] = useState<string>('HR Compensation Agent');
  const [selectedTestIdForView, setSelectedTestIdForView] = useState<number | null>(null);

  // Sync tab with URL
  const setActiveTab = useCallback((tab: NavTabType) => {
    setActiveTabState(tab);
    if (tab === 'login') {
      window.history.pushState(null, '', '/login');
    } else if (tab.startsWith('admin-') || tab === 'admin') {
      const sub = tab.replace('admin-', '');
      window.history.pushState(null, '', `/admin/${sub === 'admin' ? 'dashboard' : sub}`);
    } else {
      const sub = tab.replace('user-', '');
      window.history.pushState(null, '', `/user/${sub === 'user' ? 'dashboard' : sub}`);
    }
  }, []);

  // Ensure URL is /login when on login tab or not authenticated
  useEffect(() => {
    if (!currentUser || activeTab === 'login') {
      if (window.location.pathname !== '/login') {
        window.history.replaceState(null, '', '/login');
      }
    }
  }, [currentUser, activeTab]);

  // Listen to browser forward/back buttons
  useEffect(() => {
    const handlePopState = () => {
      const route = parsePathToTab(window.location.pathname);
      const saved = localStorage.getItem('certifyai_admin_user');
      if (!saved) {
        setCurrentUser(null);
        setActiveTabState('login');
        return;
      }
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
        if (route.tab === 'login') {
          setActiveTabState(parsed.role === 'ADMIN' ? 'admin-dashboard' : 'user-dashboard');
        } else {
          setActiveTabState(route.tab);
        }
      } catch {
        setCurrentUser(null);
        setActiveTabState('login');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Switch between Syed (ADMIN) and Ismeet (USER) seamlessly
  const handleSwitchUser = async (targetRole: 'ADMIN' | 'USER') => {
    const targetEmail = targetRole === 'ADMIN' ? 'syed@certifyai.in' : 'ismeet@certifyai.in';
    const targetPass = targetRole === 'ADMIN' ? 'admin' : 'user';

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, password: targetPass })
      });

      if (res.ok) {
        const data = await res.json();
        const u = data.user || data;
        setCurrentUser(u);
        localStorage.setItem('certifyai_admin_user', JSON.stringify(u));
        localStorage.setItem('certifyai_admin_token', data.token);
        
        if (targetRole === 'ADMIN') {
          setActiveTab('admin-dashboard');
          triggerToast(`Switched workspace to Syed (ADMIN)`, 'success');
        } else {
          setActiveTab('user-dashboard');
          triggerToast(`Switched workspace to Ismeet (USER)`, 'success');
        }
      } else {
        // Fallback to local user
        const fallback = targetRole === 'ADMIN' ? DEFAULT_SYED : DEFAULT_ISMEET;
        setCurrentUser(fallback);
        localStorage.setItem('certifyai_admin_user', JSON.stringify(fallback));
        if (targetRole === 'ADMIN') {
          setActiveTab('admin-dashboard');
          triggerToast(`Switched workspace to Syed (ADMIN)`, 'success');
        } else {
          setActiveTab('user-dashboard');
          triggerToast(`Switched workspace to Ismeet (USER)`, 'success');
        }
      }
    } catch (err) {
      const fallback = targetRole === 'ADMIN' ? DEFAULT_SYED : DEFAULT_ISMEET;
      setCurrentUser(fallback);
      localStorage.setItem('certifyai_admin_user', JSON.stringify(fallback));
      if (targetRole === 'ADMIN') {
        setActiveTab('admin-dashboard');
        triggerToast(`Switched workspace to Syed (ADMIN)`, 'success');
      } else {
        setActiveTab('user-dashboard');
        triggerToast(`Switched workspace to Ismeet (USER)`, 'success');
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('certifyai_admin_user');
    localStorage.removeItem('certifyai_admin_token');
    setCurrentUser(null);
    setActiveTab('login');
    triggerToast('Logged out successfully', 'info');
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  // Apply dark/light mode class to root
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme-mode', 'dark');
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme-mode', 'light');
    }
  }, [isDarkMode]);

  // If activeTab === 'login' or not logged in, render login screen
  if (!currentUser || activeTab === 'login') {
    return (
      <AdminLogin
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === 'ADMIN') {
            setActiveTab('admin-dashboard');
          } else {
            setActiveTab('user-dashboard');
          }
          triggerToast(`Welcome back, ${user.name || user.full_name || 'User'}!`, 'success');
        }}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        portalMode={currentUser ? (isAdmin ? 'admin' : 'user') : undefined}
      />
    );
  }

  return (
    <div className={`app-layout ${isAdmin ? 'admin-layout' : 'user-layout'}`}>
      
      {/* 1. Sidebar Navigation */}
      <Sidebar
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        currentUser={currentUser}
        onOpenLogin={() => setActiveTab('login')}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
      />

      {/* 2. Main Workspace Content Area */}
      <div className="main-content-layout">
        
        {/* Top Navbar */}
        <header className="top-navigation-header" style={{
          height: '64px',
          background: isDarkMode ? 'rgba(10, 15, 29, 0.85)' : '#ffffff',
          borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
          padding: '0 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 90
        }}>
          
          {/* Left Breadcrumb */}
          <div className="header-breadcrumbs" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px' }}>
            <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: '500' }}>CertifyAI</span>
            <span style={{ color: isDarkMode ? '#475569' : '#cbd5e1' }}>&gt;</span>
            <span style={{
              color: isDarkMode ? (isAdmin ? 'var(--accent-cyan)' : '#10b981') : (isAdmin ? '#2563eb' : '#2563eb'),
              fontWeight: '700'
            }}>
              {isAdmin ? 'Admin Governance' : 'User Testing Studio'}
            </span>
            <span style={{ color: isDarkMode ? '#475569' : '#cbd5e1' }}>&gt;</span>
            <span style={{ color: isDarkMode ? '#f8fafc' : '#0f172a', fontWeight: '600', textTransform: 'capitalize' }}>
              {activeTab.replace('admin-', '').replace('user-', '').replace(/-/g, ' ')}
            </span>
          </div>

          {/* Right Controls Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            
            {/* Global Search Bar */}
            <div style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={14} style={{ position: 'absolute', left: '12px', color: isDarkMode ? '#64748b' : '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search agents, tests, reports..."
                style={{
                  padding: '7px 14px 7px 34px',
                  borderRadius: '10px',
                  border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                  background: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc',
                  color: isDarkMode ? '#f8fafc' : '#0f172a',
                  fontSize: '12.5px',
                  width: '240px',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
              />
            </div>

            {/* Swagger Docs Link */}
            <a
              href="http://127.0.0.1:8000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{
                fontSize: '12px',
                padding: '6px 10px',
                gap: '6px',
                color: isDarkMode ? '#94a3b8' : '#64748b'
              }}
              title="Interactive OpenAPI Backend Docs"
            >
              <Code size={13} />
              <span>API</span>
            </a>

            {/* Notifications Bell with Red Indicator */}
            <button
              onClick={() => setIsNotificationsOpen(true)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '6px',
                position: 'relative',
                cursor: 'pointer',
                color: isDarkMode ? '#94a3b8' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Activity Notifications"
            >
              <Bell size={17} />
              <span style={{
                position: 'absolute', top: '3px', right: '3px', width: '8px', height: '8px',
                borderRadius: '50%', background: '#ef4444',
                boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)'
              }}></span>
            </button>

            {/* User Profile Pill */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px 4px 4px',
                background: isDarkMode ? 'rgba(0,0,0,0.3)' : '#ffffff',
                borderRadius: '24px',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                boxShadow: isDarkMode ? 'none' : '0 2px 8px rgba(0,0,0,0.03)',
                cursor: 'pointer'
              }}
              onClick={() => {
                if (!isAdmin) setActiveTab('user-profile');
              }}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: isAdmin ? 'linear-gradient(135deg, #00f0ff, #7000ff)' : 'linear-gradient(135deg, #06b6d4, #10b981)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '800', color: '#ffffff',
                boxShadow: isAdmin ? '0 0 8px rgba(0, 240, 255, 0.4)' : '0 0 8px rgba(6, 182, 212, 0.4)'
              }}>
                {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
              </div>
              <span style={{ fontSize: '13px', fontWeight: '700', color: isDarkMode ? '#f8fafc' : '#0f172a' }}>
                {currentUser.name}
              </span>
              <span style={{
                fontSize: '10px', fontWeight: '800', padding: '1px 7px', borderRadius: '10px',
                background: isAdmin ? (isDarkMode ? 'rgba(0,240,255,0.15)' : '#eff6ff') : (isDarkMode ? 'rgba(16,185,129,0.15)' : '#dcfce7'),
                color: isAdmin ? (isDarkMode ? 'var(--accent-cyan)' : '#2563eb') : (isDarkMode ? '#10b981' : '#15803d'),
                border: `1px solid ${isAdmin ? (isDarkMode ? 'rgba(0,240,255,0.3)' : '#bfdbfe') : (isDarkMode ? 'rgba(16,185,129,0.3)' : '#bbf7d0')}`
              }}>
                {currentUser.role}
              </span>
              <ChevronDown size={13} style={{ color: isDarkMode ? '#64748b' : '#94a3b8' }} />
            </div>

          </div>
        </header>

        {/* Dynamic Workspace Body */}
        <main className="page-container">
          
          {/* ========================================================= */}
          {/* USER WORKSPACE ROUTES (ISMEET)                            */}
          {/* ========================================================= */}
          {(!isAdmin || activeTab.startsWith('user-') || activeTab === 'dashboard') && (
            <>
              {/* Tab 1: User Dashboard */}
              {(activeTab === 'user-dashboard' || activeTab === 'dashboard') && (
                <UserDashboard
                  user={currentUser}
                  onStartNewTest={() => setActiveTab('user-test-agent')}
                  onViewTestResult={(testId) => {
                    setSelectedTestIdForView(testId);
                    setActiveTab('user-tests');
                  }}
                  onNavigate={(tab) => {
                    if (tab === 'tests') setActiveTab('user-tests');
                    else if (tab === 'agents') setActiveTab('user-agents');
                    else if (tab === 'reports') setActiveTab('user-reports');
                    else setActiveTab(tab as NavTabType);
                  }}
                />
              )}

              {/* Tab 2: Test Agent */}
              {(activeTab === 'user-test-agent' || activeTab === 'runner') && (
                <UserTestAgent
                  user={currentUser}
                  preselectedAgentName={preselectedAgentForTest}
                  onTestCompleted={() => {
                    triggerToast('AI agent audit completed and recorded in database!', 'success');
                  }}
                  onNavigate={(tab) => setActiveTab(tab as NavTabType)}
                />
              )}

              {/* Tab 3: My Tests */}
              {(activeTab === 'user-tests' || activeTab === 'tests') && (
                <UserTestHistory
                  user={currentUser}
                  initialSelectedTestId={selectedTestIdForView}
                  onStartNewTest={() => setActiveTab('user-test-agent')}
                  onViewTestResult={(testId) => {
                    setSelectedTestIdForView(testId);
                  }}
                />
              )}

              {/* Tab 4: My Reports */}
              {(activeTab === 'user-reports' || activeTab === 'reports') && (
                <UserReports
                  user={currentUser}
                  onViewReportDetail={(testId) => {
                    setSelectedTestIdForView(testId);
                    setActiveTab('user-tests');
                  }}
                />
              )}

              {/* Tab 5: User Profile */}
              {(activeTab === 'user-profile' || activeTab === 'profile') && (
                <UserProfile user={currentUser} />
              )}
            </>
          )}

          {/* ========================================================= */}
          {/* ADMIN WORKSPACE ROUTES (SYED)                             */}
          {/* ========================================================= */}
          {isAdmin && (
            <>
              {/* Tab 1: Admin Dashboard */}
              {(activeTab === 'admin-dashboard' || activeTab === 'admin') && (
                <AdminDashboard
                  user={currentUser}
                  onNavigate={(tab) => {
                    if (tab === 'activity') setActiveTab('admin-activity');
                    else if (tab === 'users') setActiveTab('admin-users');
                    else if (tab === 'agents') setActiveTab('admin-agents');
                    else if (tab === 'reports') setActiveTab('admin-reports');
                    else if (tab === 'analytics') setActiveTab('admin-analytics');
                    else setActiveTab(tab as NavTabType);
                  }}
                  onViewTestDetails={(testId: number) => {
                    setSelectedTestIdForView(testId);
                    setActiveTab('admin-activity');
                  }}
                />
              )}

              {/* Tab 2: Testing Activity (Who Tested What) */}
              {activeTab === 'admin-activity' && (
                <AdminTestingActivity
                  initialSelectedTestId={selectedTestIdForView}
                />
              )}

              {/* Tab 3: User Management */}
              {activeTab === 'admin-users' && (
                <AdminUsers />
              )}

              {/* Tab 4: Monitored Agent Fleet */}
              {activeTab === 'admin-agents' && (
                <AdminAgents />
              )}

              {/* Tab 5: Organization Reports Vault */}
              {activeTab === 'admin-reports' && (
                <AdminReports
                  onViewTestDetails={(testId: number) => {
                    setSelectedTestIdForView(testId);
                    setActiveTab('admin-activity');
                  }}
                />
              )}

              {/* Tab 6: Deep Analytics & Heatmaps */}
              {activeTab === 'admin-analytics' && (
                <AdminAnalytics />
              )}

              {/* Tab 7: Engine Settings */}
              {activeTab === 'admin-settings' && (
                <AdminSettings />
              )}
            </>
          )}

        </main>

      </div>

      {/* Floating Notifications Drawer */}
      {isNotificationsOpen && (
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px',
          background: 'rgba(10, 15, 29, 0.95)', backdropFilter: 'blur(20px)',
          borderLeft: '1px solid var(--border-subtle)', zIndex: 1000,
          display: 'flex', flexDirection: 'column', padding: '24px', gap: '16px',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={18} style={{ color: isAdmin ? 'var(--accent-cyan)' : '#10b981' }} />
              <span>Activity Stream</span>
            </h3>
            <button className="btn btn-ghost" onClick={() => setIsNotificationsOpen(false)} style={{ padding: '6px' }}>
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', marginBottom: '2px' }}>Audit Engine Status</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>All 17 evaluation phases calibrated and operational.</div>
            </div>

            <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(0, 240, 255, 0.08)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '2px' }}>Role-Based Access</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Two-role governance active: Syed (ADMIN), Ismeet (USER).</div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Alerts */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '10px', pointerEvents: 'none'
      }}>
        {toasts.map(t => (
          <div
            key={t.id}
            className="animate-slideup"
            style={{
              padding: '12px 18px',
              borderRadius: '10px',
              background: 'rgba(10, 15, 29, 0.95)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${t.type === 'success' ? '#10b981' : (t.type === 'error' ? '#ff3366' : 'var(--accent-cyan)')}`,
              color: '#fff',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              pointerEvents: 'auto'
            }}
          >
            {t.type === 'success' && <CheckCircle2 size={16} style={{ color: '#10b981' }} />}
            {t.type === 'error' && <AlertCircle size={16} style={{ color: '#ff3366' }} />}
            {t.type === 'info' && <Info size={16} style={{ color: 'var(--accent-cyan)' }} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

    </div>
  );
}

export default App;
