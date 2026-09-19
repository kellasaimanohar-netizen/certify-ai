import React, { useState } from 'react';
import {
  Terminal,
  Play,
  Clock,
  Layers,
  FileText,
  User,
  Activity,
  Users,
  TrendingUp,
  Settings,
  Menu,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  Shield,
  LayoutDashboard,
  CheckCircle2,
  Lock,
  ArrowRightLeft,
  Sparkles,
  Zap
} from 'lucide-react';
import type { AdminUser } from './AdminLogin';

export type NavTabType =
  // User Routes
  | 'user-dashboard'
  | 'user-test-agent'
  | 'user-tests'
  | 'user-agents'
  | 'user-reports'
  | 'user-profile'
  // Admin Routes
  | 'admin-dashboard'
  | 'admin-activity'
  | 'admin-users'
  | 'admin-agents'
  | 'admin-reports'
  | 'admin-analytics'
  | 'admin-settings'
  // General / Legacy Aliases
  | 'runner'
  | 'tests'
  | 'reports'
  | 'agents'
  | 'dashboard'
  | 'profile'
  | 'admin'
  | 'login'
  | 'results'
  | 'rules'
  | 'datasources'
  | 'copilot';

interface SidebarProps {
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (val: boolean) => void;
  activeTab: NavTabType;
  setActiveTab: (val: NavTabType) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  currentUser?: AdminUser | null;
  onOpenLogin?: () => void;
  onLogout?: () => void;
  onSwitchUser?: (targetRole: 'ADMIN' | 'USER') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  activeTab,
  setActiveTab,
  isDarkMode,
  setIsDarkMode,
  currentUser,
  onOpenLogin,
  onLogout,
  onSwitchUser
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const isAdmin = currentUser?.role === 'ADMIN';
  const displayName = currentUser?.name || currentUser?.full_name || (isAdmin ? 'Syed' : 'Ismeet');
  const displayRole = currentUser?.role || (isAdmin ? 'ADMIN' : 'USER');
  const displayInitials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className={`enterprise-sidebar ${isSidebarCollapsed ? 'collapsed' : ''} ${isAdmin ? 'admin-sidebar-mode' : 'user-sidebar-mode'}`}>
      
      {/* 1. Header & Brand */}
      <div className="sidebar-brand-row">
        <div 
          className="sidebar-brand-group" 
          onClick={() => isAdmin ? setActiveTab('admin-dashboard') : setActiveTab('user-dashboard')} 
          style={{ cursor: 'pointer' }}
        >
          <div className="sidebar-brand-emblem" style={{
            background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
            boxShadow: '0 0 16px rgba(168, 85, 247, 0.45)'
          }}>
            <span className="brand-a-symbol">⚡</span>
          </div>
          {!isSidebarCollapsed && (
            <div className="sidebar-brand-info">
              <span className="sidebar-brand-title">
                CertifyAI <span className="v10-tag" style={{
                  background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                  color: '#fff'
                }}>{isAdmin ? 'ADMIN' : 'USER'}</span>
              </span>
              <span className="sidebar-brand-desc">
                {isAdmin ? 'Enterprise AI Governance' : 'Autonomous Testing Studio'}
              </span>
            </div>
          )}
        </div>

        <button
          className="sidebar-collapse-toggle"
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <Menu size={16} />
        </button>
      </div>

      {/* 2. Main Navigation Menu */}
      <nav className="sidebar-navigation-menu">
        {isAdmin ? (
          /* ========================================================= */
          /* ADMIN (SYED) NAVIGATION MENU                              */
          /* ========================================================= */
          <>
            <button
              className={`nav-menu-button ${activeTab === 'admin-dashboard' || activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-dashboard')}
              title="Admin Dashboard"
            >
              <LayoutDashboard size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'admin-activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-activity')}
              title="Testing Activity (Who Tested What)"
            >
              <Activity size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Testing Activity</span>}
              {!isSidebarCollapsed && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '9px',
                  fontWeight: '800',
                  letterSpacing: '0.06em',
                  padding: '2px 7px',
                  borderRadius: '12px',
                  background: (activeTab === 'admin-activity')
                    ? 'rgba(255, 255, 255, 0.22)'
                    : 'rgba(239, 68, 68, 0.15)',
                  color: (activeTab === 'admin-activity')
                    ? '#ffffff'
                    : '#ef4444',
                  border: (activeTab === 'admin-activity')
                    ? '1px solid rgba(255, 255, 255, 0.35)'
                    : '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: (activeTab === 'admin-activity') ? '#ffffff' : '#ef4444',
                    boxShadow: (activeTab === 'admin-activity') ? '0 0 6px #ffffff' : '0 0 6px #ef4444'
                  }}></span>
                  LIVE
                </span>
              )}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'admin-users' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-users')}
              title="User Management"
            >
              <Users size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Users</span>}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'admin-agents' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-agents')}
              title="Monitored Agent Fleet"
            >
              <Layers size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Agents</span>}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'admin-reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-reports')}
              title="Organization Reports Vault"
            >
              <FileText size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Reports</span>}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'admin-analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-analytics')}
              title="Statistical Analytics & Trends"
            >
              <TrendingUp size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Analytics</span>}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'admin-settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('admin-settings')}
              title="Engine & Security Settings"
            >
              <Settings size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Settings</span>}
            </button>
          </>
        ) : (
          /* ========================================================= */
          /* USER (ISMEET) NAVIGATION MENU                             */
          /* ========================================================= */
          <>
            <button
              className={`nav-menu-button ${activeTab === 'user-dashboard' || activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('user-dashboard')}
              title="User Dashboard"
            >
              <LayoutDashboard size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'user-test-agent' || activeTab === 'runner' ? 'active' : ''}`}
              onClick={() => setActiveTab('user-test-agent')}
              title="Run Audit / Test Agent"
            >
              <Play size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Test Agent</span>}
              {!isSidebarCollapsed && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '9px',
                  fontWeight: '800',
                  letterSpacing: '0.06em',
                  padding: '2px 7px',
                  borderRadius: '12px',
                  background: (activeTab === 'user-test-agent' || activeTab === 'runner')
                    ? 'rgba(255, 255, 255, 0.22)'
                    : 'rgba(16, 185, 129, 0.15)',
                  color: (activeTab === 'user-test-agent' || activeTab === 'runner')
                    ? '#ffffff'
                    : '#10b981',
                  border: (activeTab === 'user-test-agent' || activeTab === 'runner')
                    ? '1px solid rgba(255, 255, 255, 0.35)'
                    : '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: (activeTab === 'user-test-agent' || activeTab === 'runner') ? '#ffffff' : '#10b981',
                    boxShadow: (activeTab === 'user-test-agent' || activeTab === 'runner') ? '0 0 6px #ffffff' : '0 0 6px #10b981'
                  }}></span>
                  RUN
                </span>
              )}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'user-tests' || activeTab === 'tests' ? 'active' : ''}`}
              onClick={() => setActiveTab('user-tests')}
              title="My Test History"
            >
              <Clock size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>My Tests</span>}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'user-reports' || activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('user-reports')}
              title="Reports & Certificates"
            >
              <FileText size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Reports</span>}
            </button>

            <button
              className={`nav-menu-button ${activeTab === 'user-profile' || activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('user-profile')}
              title="My Profile"
            >
              <User size={17} className="nav-icon" />
              {!isSidebarCollapsed && <span>Profile</span>}
            </button>
          </>
        )}
      </nav>

      {/* 3. Footer: User Profile & Switcher */}
      <div className="sidebar-bottom-footer">
        <div className="sidebar-profile-card" onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}>
          <div className="profile-avatar-circle" style={{
            background: isAdmin ? 'linear-gradient(135deg, #00f0ff, #7000ff)' : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            boxShadow: isAdmin ? '0 0 12px rgba(0, 240, 255, 0.45)' : '0 0 12px rgba(139, 92, 246, 0.45)'
          }}>
            {displayInitials}
          </div>
          {!isSidebarCollapsed && (
            <div className="profile-text-meta">
              <span className="profile-user-name" style={{ color: '#ffffff', fontWeight: '700', fontSize: '13.5px' }}>
                {displayName}
              </span>
              <span className="profile-user-role" style={{
                color: isAdmin ? '#38bdf8' : '#34d399',
                fontWeight: '800',
                fontSize: '10.5px',
                letterSpacing: '0.04em'
              }}>
                {displayRole}
              </span>
            </div>
          )}
          {!isSidebarCollapsed && <ChevronDown size={14} className="profile-dropdown-arrow" style={{ color: '#94a3b8', marginLeft: 'auto' }} />}
        </div>

        {/* Dropdown Menu on Profile Click */}
        {isUserMenuOpen && (
          <div className="sidebar-user-popup-menu" style={{
            background: '#0d1322',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            padding: '10px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minWidth: '220px'
          }}>
            {/* User Account Info Header */}
            <div style={{ padding: '4px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#ffffff' }}>{displayName}</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', wordBreak: 'break-all' }}>{currentUser?.email || (isAdmin ? 'syed@certifyai.in' : 'ismeet@certifyai.in')}</div>
              <div style={{
                marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px',
                fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '6px',
                background: isAdmin ? 'rgba(0, 240, 255, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: isAdmin ? '#38bdf8' : '#34d399',
                border: `1px solid ${isAdmin ? 'rgba(0, 240, 255, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
              }}>
                {displayRole} ROLE
              </div>
            </div>

            {/* Profile / Settings Link */}
            <button
              className="popup-item"
              onClick={() => {
                if (isAdmin) setActiveTab('admin-settings');
                else setActiveTab('user-profile');
                setIsUserMenuOpen(false);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                borderRadius: '8px', background: 'transparent', border: 'none', color: '#e2e8f0',
                fontSize: '12px', fontWeight: '600', cursor: 'pointer', textAlign: 'left'
              }}
            >
              <User size={14} style={{ color: '#94a3b8' }} />
              <span>{isAdmin ? 'Engine Settings' : 'View Account Profile'}</span>
            </button>

            <div style={{ width: '100%', height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />

            {/* Sign Out Button */}
            {currentUser ? (
              onLogout && (
                <button
                  className="popup-item logout"
                  onClick={() => { onLogout(); setIsUserMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                    borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#ff4d6d', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textAlign: 'left'
                  }}
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              )
            ) : (
              <button
                className="popup-item"
                onClick={() => { onOpenLogin && onOpenLogin(); setIsUserMenuOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                  borderRadius: '8px', background: 'transparent', border: 'none', color: '#e2e8f0',
                  fontSize: '12px', fontWeight: '600', cursor: 'pointer', textAlign: 'left'
                }}
              >
                <Lock size={14} />
                <span>Sign In</span>
              </button>
            )}
          </div>
        )}

        {/* Theme mode switcher pills */}
        <div className="theme-toggle-row">
          <button
            className={`theme-toggle-switch ${isDarkMode ? 'active' : ''}`}
            onClick={() => setIsDarkMode(true)}
            title="Dark Mode"
          >
            <Moon size={13} />
            {!isSidebarCollapsed && <span>Dark</span>}
          </button>
          <button
            className={`theme-toggle-switch ${!isDarkMode ? 'active' : ''}`}
            onClick={() => setIsDarkMode(false)}
            title="Light Mode"
          >
            <Sun size={13} />
            {!isSidebarCollapsed && <span>Light</span>}
          </button>
        </div>

        {/* Footer Brand Version */}
        {!isSidebarCollapsed && (
          <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: '600' }}>CertifyAI v10.3.0</span>
            <span style={{ fontSize: '9px', color: '#475569' }}>The Trust Layer for Autonomous AI</span>
          </div>
        )}
      </div>

    </aside>
  );
};
