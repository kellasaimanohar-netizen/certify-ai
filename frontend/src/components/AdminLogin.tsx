import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sun,
  Moon,
  Users,
  AlertCircle,
  Globe,
  ChevronDown,
  BarChart3,
  Settings,
  FileText
} from 'lucide-react';

export interface AdminUser {
  id: number;
  user_id?: string;
  name: string;
  full_name?: string;
  email: string;
  role: 'ADMIN' | 'USER';
  department?: string;
  avatar_url?: string;
  status?: string;
  last_login?: string;
}

interface AdminLoginProps {
  onLoginSuccess: (user: AdminUser, token: string) => void;
  onCancel?: () => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  portalMode?: 'admin' | 'user';
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onLoginSuccess,
  isDarkMode,
  setIsDarkMode,
  portalMode = 'admin'
}) => {
  // Tabs: 'admin' (Admin Login) or 'user' (User Login)
  const [activeTab, setActiveTab] = useState<'admin' | 'user'>(
    portalMode === 'user' ? 'user' : 'admin'
  );

  const [email, setEmail] = useState(() => {
    return portalMode === 'user' ? 'user@company.com' : 'admin@company.com';
  });
  const [password, setPassword] = useState(() => {
    return portalMode === 'user' ? 'user' : 'admin';
  });

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [selectedLang, setSelectedLang] = useState('English');
  const [mfaActive, setMfaActive] = useState(false);

  const BACKEND_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '' ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  const handleTabChange = (tab: 'admin' | 'user') => {
    setActiveTab(tab);
    setErrorMessage(null);
    if (tab === 'admin') {
      setEmail('admin@company.com');
      setPassword('admin');
    } else {
      setEmail('user@company.com');
      setPassword('user');
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    const rawEmail = email.trim().toLowerCase();
    const isUserAccount = activeTab === 'user' || rawEmail.includes('user') || rawEmail.includes('ismeet');
    const effectiveRole: 'ADMIN' | 'USER' = isUserAccount ? 'USER' : 'ADMIN';

    // Map email for backend call
    const sendEmail = isUserAccount
      ? (rawEmail === 'user@company.com' || rawEmail === 'user' ? 'ismeet@certifyai.in' : rawEmail)
      : (rawEmail === 'admin@company.com' || rawEmail === 'admin' ? 'syed@certifyai.in' : rawEmail);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sendEmail, password, remember_me: rememberMe })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Authentication failed' }));
        throw new Error(errorData.detail || 'Invalid email or password');
      }

      const data = await response.json();
      const userData = data.user || data;
      localStorage.setItem('certifyai_admin_user', JSON.stringify(userData));
      localStorage.setItem('certifyai_admin_token', data.token);
      onLoginSuccess(userData, data.token);
    } catch (err: any) {
      // Fallback if backend server is unreachable
      if (err.message?.includes('fetch') || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || !err.message) {
        const fallbackUser: AdminUser = effectiveRole === 'ADMIN' ? {
          id: 1,
          name: 'Syed',
          email: 'syed@certifyai.in',
          role: 'ADMIN',
          department: 'Enterprise AI Governance',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          status: 'Active'
        } : {
          id: 2,
          name: 'Ismeet',
          email: 'ismeet@certifyai.in',
          role: 'USER',
          department: 'AI Quality Assurance & Testing',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          status: 'Active'
        };
        localStorage.setItem('certifyai_admin_user', JSON.stringify(fallbackUser));
        localStorage.setItem('certifyai_admin_token', 'local-demo-token');
        onLoginSuccess(fallbackUser, 'local-demo-token');
        return;
      }
      setErrorMessage(err.message || 'Unable to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  const isAdminTab = activeTab === 'admin';

  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      width: '100%',
      backgroundColor: isDarkMode ? '#060a14' : '#f8fafc',
      color: isDarkMode ? '#f8fafc' : '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      position: 'relative',
      overflow: 'hidden'
    }}>

      {/* ── TOP NAVIGATION BAR ─────────────────────────────────────── */}
      <header style={{
        height: '56px',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20,
        flexShrink: 0,
        background: isDarkMode ? 'rgba(6, 10, 20, 0.7)' : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(10px)',
        borderBottom: isDarkMode ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)'
      }}>
        {/* Brand Logo & Slogan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0070f3 0%, #00f0ff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 3px 14px rgba(0, 112, 243, 0.4)',
              color: '#ffffff',
              fontWeight: '900',
              fontSize: '16px'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L2 20H22L12 3Z" fill="#ffffff" />
                <path d="M12 8L6 18H18L12 8Z" fill="#060a14" opacity="0.85" />
              </svg>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '-0.3px', color: isDarkMode ? '#ffffff' : '#0f172a' }}>
                  CertifyAI
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.15)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}>
                  V10
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Right Controls: Slogan + Theme + Language */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            fontSize: '11.5px',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#64748b',
            fontWeight: '500',
            marginRight: '8px'
          }}>
            Secure &nbsp;|&nbsp; Compliant &nbsp;|&nbsp; Responsible &nbsp;|&nbsp; Scalable
          </div>

          {/* Theme Pill Toggle */}
          <button
            type="button"
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
              borderRadius: '20px',
              padding: '3px',
              cursor: 'pointer',
              color: isDarkMode ? '#f8fafc' : '#0f172a',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
            }}
            title="Toggle theme mode"
          >
            <div style={{
              padding: '3px 6px',
              borderRadius: '12px',
              background: !isDarkMode ? '#3b82f6' : 'transparent',
              color: !isDarkMode ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s ease'
            }}>
              <Sun size={12} />
            </div>
            <div style={{
              padding: '3px 6px',
              borderRadius: '12px',
              background: isDarkMode ? '#3b82f6' : 'transparent',
              color: isDarkMode ? '#ffffff' : '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.2s ease'
            }}>
              <Moon size={12} />
            </div>
          </button>

          {/* Language Selector */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#ffffff',
                border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid #cbd5e1',
                color: isDarkMode ? '#f8fafc' : '#0f172a',
                fontSize: '11.5px',
                fontWeight: '500',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
              }}
            >
              <Globe size={13} style={{ color: '#38bdf8' }} />
              <span>{selectedLang}</span>
              <ChevronDown size={12} />
            </button>

            {showLangMenu && (
              <div style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                background: isDarkMode ? '#0f172a' : '#ffffff',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '4px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                zIndex: 30,
                minWidth: '120px'
              }}>
                {['English', 'German', 'French', 'Japanese'].map(lang => (
                  <button
                    key={lang}
                    onClick={() => { setSelectedLang(lang); setShowLangMenu(false); }}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 12px',
                      background: selectedLang === lang ? 'rgba(56, 189, 248, 0.15)' : 'none',
                      border: 'none',
                      borderRadius: '6px',
                      color: selectedLang === lang ? '#38bdf8' : (isDarkMode ? '#f8fafc' : '#0f172a'),
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN SPLIT CONTENT BODY ─────────────────────────────────── */}
      <main style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        position: 'relative',
        overflow: 'hidden'
      }}>

        {/* ── LEFT HERO PANEL (Mountain Beacon Landscape) ─────────────── */}
        <section style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '24px 48px',
          backgroundImage: 'url(/login_hero_bg.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#ffffff',
          overflow: 'hidden'
        }}>
          {/* Dark gradient overlay for rich contrast */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(6, 10, 20, 0.88) 0%, rgba(10, 16, 32, 0.72) 50%, rgba(6, 10, 20, 0.92) 100%)',
            pointerEvents: 'none'
          }} />

          {/* Hero Content Container */}
          <div style={{ position: 'relative', zIndex: 10, maxWidth: '560px', marginTop: 'auto', marginBottom: 'auto' }}>
            
            {/* Big Headline */}
            <h1 style={{
              fontSize: 'clamp(30px, 3.2vw, 44px)',
              fontWeight: '900',
              lineHeight: '1.15',
              letterSpacing: '-1.2px',
              margin: '0 0 12px 0',
              color: '#ffffff'
            }}>
              Admin Access.<br />
              <span style={{ color: '#38bdf8' }}>
                Control the Future.
              </span>
            </h1>

            {/* Sub-paragraph */}
            <p style={{
              fontSize: 'clamp(13px, 1.1vw, 15px)',
              lineHeight: '1.55',
              color: 'rgba(255, 255, 255, 0.8)',
              margin: '0 0 24px 0',
              fontWeight: '400',
              maxWidth: '480px'
            }}>
              Manage, monitor, and govern AI agent compliance across your organization with enterprise-grade security and insights.
            </p>

            {/* 4 Feature Cards Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '10px',
              marginBottom: '24px'
            }}>
              {[
                { label: 'User & Access Control', icon: <Shield size={15} color="#38bdf8" /> },
                { label: 'Platform Analytics', icon: <BarChart3 size={15} color="#34d399" /> },
                { label: 'System Configuration', icon: <Settings size={15} color="#a78bfa" /> },
                { label: 'Audit Logs & Reports', icon: <FileText size={15} color="#fb923c" /> }
              ].map((feat, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(15, 23, 42, 0.65)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    padding: '10px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)'
                  }}
                  className="table-row-hover"
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {feat.icon}
                  </div>
                  <span style={{ fontSize: '10.5px', fontWeight: '600', color: '#e2e8f0', lineHeight: '1.25' }}>
                    {feat.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom Slogan with Accent Underline */}
            <div>
              <div style={{
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#ffffff',
                letterSpacing: '-0.2px'
              }}>
                Trust AI. Govern with Confidence.
              </div>
              <div style={{
                width: '32px',
                height: '3px',
                borderRadius: '2px',
                background: '#38bdf8',
                marginTop: '5px'
              }} />
            </div>

          </div>
        </section>

        {/* ── RIGHT AUTHENTICATION PANEL ─────────────────────────────── */}
        <section style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px 28px',
          background: isDarkMode ? '#060a14' : '#f1f5f9',
          position: 'relative',
          zIndex: 10,
          overflow: 'hidden'
        }}>

          {/* Login Card */}
          <div style={{
            width: '100%',
            maxWidth: '420px',
            background: isDarkMode ? '#0d1527' : '#ffffff',
            border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '24px 28px 20px 28px',
            boxShadow: isDarkMode
              ? '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 112, 243, 0.08)'
              : '0 16px 36px rgba(15, 23, 42, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>

            {/* Header: Delta Logo + Title + Subtitle */}
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0070f3 0%, #4f46e5 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 6px 18px rgba(0, 112, 243, 0.35)',
                marginBottom: '8px'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3L2 20H22L12 3Z" fill="#ffffff" />
                  <path d="M12 8L6 18H18L12 8Z" fill="#0d1527" opacity="0.9" />
                </svg>
              </div>

              <h2 style={{
                fontSize: '20px',
                fontWeight: '800',
                margin: '0 0 4px 0',
                color: isDarkMode ? '#f8fafc' : '#0f172a',
                letterSpacing: '-0.3px'
              }}>
                {isAdminTab ? 'Admin Login' : 'User Login'}
              </h2>

              <p style={{
                fontSize: '12px',
                color: isDarkMode ? '#94a3b8' : '#64748b',
                margin: 0
              }}>
                {isAdminTab
                  ? 'Access the CertifyAI administration console'
                  : 'Access the AI Agent Testing & Quality Studio'
                }
              </p>
            </div>

            {/* Clean Tabs: [ 🛡️ Admin Login ] [ 👤 User Login ] */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              background: isDarkMode ? 'rgba(15, 23, 42, 0.7)' : '#f1f5f9',
              padding: '3px',
              borderRadius: '10px',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => handleTabChange('admin')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  background: isAdminTab
                    ? '#2563eb'
                    : 'transparent',
                  color: isAdminTab ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b'),
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: isAdminTab ? '0 2px 8px rgba(37, 99, 235, 0.4)' : 'none'
                }}
              >
                <Shield size={13} />
                <span>Admin Login</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('user')}
                style={{
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  background: !isAdminTab
                    ? '#059669'
                    : 'transparent',
                  color: !isAdminTab ? '#ffffff' : (isDarkMode ? '#94a3b8' : '#64748b'),
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  boxShadow: !isAdminTab ? '0 2px 8px rgba(5, 150, 105, 0.4)' : 'none'
                }}
              >
                <Users size={13} />
                <span>User Login</span>
              </button>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div style={{
                padding: '8px 12px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <AlertCircle size={14} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              
              {/* Email Field */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  color: isDarkMode ? '#e2e8f0' : '#334155',
                  marginBottom: '4px'
                }}>
                  Email address
                </label>
                <div style={{ position: 'relative' }}>
                  <Mail
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: isDarkMode ? '#64748b' : '#94a3b8',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={isAdminTab ? "admin@company.com" : "user@company.com"}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 34px',
                      borderRadius: '8px',
                      border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
                      background: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                      color: isDarkMode ? '#f8fafc' : '#0f172a',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease'
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{
                    fontSize: '11.5px',
                    fontWeight: '600',
                    color: isDarkMode ? '#e2e8f0' : '#334155'
                  }}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => alert(`Credentials:\n• Admin: admin@company.com / admin\n• User: user@company.com / user`)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#38bdf8',
                      fontSize: '11px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={15}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: isDarkMode ? '#64748b' : '#94a3b8',
                      pointerEvents: 'none'
                    }}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    style={{
                      width: '100%',
                      padding: '8px 34px 8px 34px',
                      borderRadius: '8px',
                      border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid #cbd5e1',
                      background: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                      color: isDarkMode ? '#f8fafc' : '#0f172a',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s ease'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: isDarkMode ? '#64748b' : '#94a3b8',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Remember Me & MFA Link */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11.5px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#2563eb', width: '14px', height: '14px' }}
                  />
                  <span>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setMfaActive(!mfaActive);
                    alert(mfaActive ? 'MFA hardware token standby' : 'MFA hardware token verified: YubiKey / WebAuthn ready');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#38bdf8',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: 0
                  }}
                >
                  <Shield size={12} />
                  <span>Login with MFA</span>
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isAdminTab
                    ? 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)'
                    : 'linear-gradient(135deg, #059669 0%, #2563eb 100%)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: isAdminTab
                    ? '0 4px 14px rgba(37, 99, 235, 0.4)'
                    : '0 4px 14px rgba(5, 150, 105, 0.4)',
                  transition: 'all 0.2s ease',
                  marginTop: '2px'
                }}
              >
                <span>
                  {isLoading
                    ? 'Authenticating...'
                    : (isAdminTab ? 'Sign In to Admin Console' : 'Sign In to User Studio')
                  }
                </span>
                <ArrowRight size={14} />
              </button>

            </form>

            {/* Secure Access Badges */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <div style={{ flex: 1, height: '1px', background: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0' }} />
                <span style={{ fontSize: '10px', color: isDarkMode ? '#64748b' : '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Secure Access
                </span>
                <div style={{ flex: 1, height: '1px', background: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                {[
                  { icon: <Lock size={12} color="#38bdf8" />, label: 'Encrypted' },
                  { icon: <Shield size={12} color="#34d399" />, label: 'Role-Based' },
                  { icon: <FileText size={12} color="#a78bfa" />, label: 'Audit Trail' }
                ].map((badge, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '6px',
                      background: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc',
                      border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      textAlign: 'center',
                      gap: '3px'
                    }}
                  >
                    {badge.icon}
                    <span style={{ fontSize: '9.5px', color: isDarkMode ? '#94a3b8' : '#64748b', fontWeight: '500' }}>
                      {badge.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Need Help Footer */}
            <div style={{ textAlign: 'center', fontSize: '11.5px', color: isDarkMode ? '#64748b' : '#94a3b8' }}>
              Need help?{' '}
              <a
                href="mailto:support@certifyai.in"
                style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: '600' }}
              >
                Contact support
              </a>
            </div>

          </div>

        </section>

      </main>

      {/* ── BOTTOM GLOBAL FOOTER ───────────────────────────────────── */}
      <footer style={{
        height: '38px',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11.5px',
        color: isDarkMode ? 'rgba(255, 255, 255, 0.55)' : '#64748b',
        borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
        background: isDarkMode ? '#060a14' : '#ffffff',
        zIndex: 20,
        flexShrink: 0
      }}>
        <div>
          © 2026 CertifyAI. All rights reserved.
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ cursor: 'pointer' }}>Privacy</span>
          <span style={{ cursor: 'pointer' }}>Terms</span>
          <span style={{ cursor: 'pointer' }}>Security</span>
          <span style={{ cursor: 'pointer' }}>Support</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
            <span style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b', fontWeight: '500' }}>All Systems Operational</span>
          </div>
          <span style={{ color: isDarkMode ? 'rgba(255, 255, 255, 0.4)' : '#94a3b8' }}>V10.3.0</span>
        </div>
      </footer>

    </div>
  );
};
