import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  TrendingUp,
  Clock,
  Shield,
  Activity,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Search,
  RefreshCw,
  X,
  Edit2
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected user detail state
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [userDetail, setUserDetail] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Add user modal state
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('user123');
  const [newRole, setNewRole] = useState<'USER' | 'ADMIN'>('USER');
  const [newDept, setNewDept] = useState('AI Quality Assurance & Testing');
  const [addError, setAddError] = useState('');

  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSelectUser = async (userId: number) => {
    setSelectedUserId(userId);
    setIsDetailLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setUserDetail(data);
      }
    } catch (err) {
      console.error('Failed to load user details:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          email: newEmail,
          password: newPassword,
          role: newRole,
          department: newDept
        })
      });
      if (res.ok) {
        setIsAddUserOpen(false);
        setNewName('');
        setNewEmail('');
        fetchUsers();
      } else {
        const err = await res.json();
        setAddError(err.detail || 'Failed to create user');
      }
    } catch (err: any) {
      setAddError(err.message || 'Network error');
    }
  };

  const handleToggleStatus = async (userObj: any) => {
    const newStatus = userObj.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await fetch(`${BACKEND_URL}/api/admin/users/${userObj.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchUsers();
      if (selectedUserId === userObj.id) {
        handleSelectUser(userObj.id);
      }
    } catch (err) {
      console.error('Failed to update user status:', err);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ==========================================
  // VIEW: USER DETAILS (Ismeet drilldown)
  // ==========================================
  if (selectedUserId && userDetail) {
    const u = userDetail.user;
    const stats = userDetail.stats;
    const history = userDetail.test_history || [];
    const trend = userDetail.score_trend || [];

    return (
      <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Top Navigation Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSelectedUserId(null);
              setUserDetail(null);
            }}
            style={{ padding: '6px 12px', fontSize: '12.5px', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Back to Users</span>
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>/ User Governance & Performance</span>
        </div>

        {/* User Profile Header Card */}
        <div className="glass-card" style={{ padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: u.role === 'ADMIN' ? 'linear-gradient(135deg, #00f0ff, #7000ff)' : 'linear-gradient(135deg, #2ecc71, #00b4d8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              fontWeight: '800',
              color: '#fff'
            }}>
              {u.name ? u.name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                  {u.name}
                </h1>
                <span className={`role-tag-badge ${u.role?.toLowerCase()}`} style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '700',
                  background: u.role === 'ADMIN' ? 'rgba(0, 240, 255, 0.15)' : 'rgba(46, 204, 113, 0.15)',
                  color: u.role === 'ADMIN' ? 'var(--accent-cyan)' : '#2ecc71',
                  border: `1px solid ${u.role === 'ADMIN' ? 'rgba(0, 240, 255, 0.3)' : 'rgba(46, 204, 113, 0.3)'}`
                }}>
                  {u.role}
                </span>
                <span className={`status-pill ${u.status === 'Active' ? 'certified' : 'not_certified'}`} style={{ fontSize: '10px' }}>
                  {u.status}
                </span>
              </div>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                {u.email} • {u.department}
              </span>
            </div>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => handleToggleStatus(u)}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            {u.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
          </button>
        </div>

        {/* User Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Total Tests</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>{stats.total_tests}</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Agents Tested</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#a855f7', marginTop: '4px' }}>{stats.agents_tested}</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Average Score</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#f1c40f', marginTop: '4px' }}>{stats.average_score}%</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Certified</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#2ecc71', marginTop: '4px' }}>{stats.certified_count}</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Conditional</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#f1c40f', marginTop: '4px' }}>{stats.conditional_count}</div>
          </div>
          <div className="glass-card stat-card" style={{ padding: '16px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Not Certified</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#e74c3c', marginTop: '4px' }}>{stats.not_certified_count}</div>
          </div>
        </div>

        {/* Score Trend Chart */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={16} style={{ color: '#2ecc71' }} />
            {u.name}&apos;s Score Trend (Last 14 Days)
          </h3>
          <div style={{ width: '100%', height: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="adminUserGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2ecc71" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2ecc71" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="var(--text-muted)" fontSize={11} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: any) => [`${v}%`, 'Average Score']}
                />
                <Area type="monotone" dataKey="score" stroke="#2ecc71" strokeWidth={2} fill="url(#adminUserGrad)" connectNulls={true} dot={{ r: 3, fill: '#2ecc71' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Test History Table */}
        <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Testing History by {u.name}
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Agent</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Date</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Mode</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Score</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '10px 14px', fontWeight: '600' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h: any) => (
                  <tr key={h.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: '700', color: 'var(--text-primary)' }}>{h.agent_name}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{new Date(h.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                    <td style={{ padding: '12px 14px', textTransform: 'uppercase', fontSize: '11px', fontWeight: '700' }}>{h.mode}</td>
                    <td style={{ padding: '12px 14px', fontWeight: '800', color: h.tier === 'CERTIFIED' ? '#2ecc71' : h.tier === 'CONDITIONAL' ? '#f1c40f' : '#e74c3c' }}>{h.trust_score}%</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`status-pill ${h.tier.toLowerCase()}`} style={{ fontSize: '10.5px' }}>{h.tier}</span>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{(h.duration_ms / 1000).toFixed(1)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  }

  // ==========================================
  // VIEW: MAIN USERS TABLE
  // ==========================================
  return (
    <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} style={{ color: 'var(--accent-cyan)' }} />
            User Management
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
            Supervise system users, assign roles (ADMIN / USER), and inspect individual testing history.
          </p>
        </div>

        <button className="btn btn-primary" onClick={() => setIsAddUserOpen(true)} style={{ padding: '9px 18px', fontSize: '13px', gap: '6px' }}>
          <UserPlus size={14} />
          <span>+ Add User</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="glass-card" style={{ padding: '14px 20px' }}>
        <div style={{ position: 'relative', maxWidth: '380px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '13px' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', textAlign: 'left' }}>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Name</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Role</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Department</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Total Tests</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Avg Score</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={18} className="spin-animation" style={{ margin: '0 auto 8px auto', display: 'block' }} />
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.map((u) => {
                const isAdmin = u.role === 'ADMIN';

                return (
                  <tr
                    key={u.id}
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'background 0.15s' }}
                    className="table-row-hover"
                    onClick={() => handleSelectUser(u.id)}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%',
                          background: isAdmin ? 'linear-gradient(135deg, #00f0ff, #7000ff)' : 'linear-gradient(135deg, #2ecc71, #00b4d8)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', fontWeight: '800', color: '#fff'
                        }}>
                          {u.name ? u.name[0].toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div>{u.name}</div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`role-tag-badge ${u.role?.toLowerCase()}`} style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: isAdmin ? 'rgba(0, 240, 255, 0.15)' : 'rgba(46, 204, 113, 0.15)',
                        color: isAdmin ? 'var(--accent-cyan)' : '#2ecc71',
                        border: `1px solid ${isAdmin ? 'rgba(0, 240, 255, 0.3)' : 'rgba(46, 204, 113, 0.3)'}`
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                      {u.department}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {u.total_tests > 0 ? u.total_tests : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '700', color: u.avg_score ? '#2ecc71' : 'var(--text-muted)' }}>
                      {u.avg_score ? `${u.avg_score}%` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`status-pill ${u.status === 'Active' ? 'certified' : 'not_certified'}`} style={{ fontSize: '10.5px' }}>
                        {u.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectUser(u.id);
                        }}
                        style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--accent-cyan)', gap: '4px' }}
                      >
                        <span>View Details</span>
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

      {/* Add User Modal */}
      {isAddUserOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }} onClick={() => setIsAddUserOpen(false)}>
          <div className="glass-card animate-slideup" style={{ width: '480px', padding: '28px', gap: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} style={{ color: 'var(--accent-cyan)' }} />
                Add New User
              </h3>
              <button className="btn btn-ghost" onClick={() => setIsAddUserOpen(false)} style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            {addError && (
              <div style={{ padding: '8px 12px', background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: '6px', color: '#e74c3c', fontSize: '12px' }}>
                {addError}
              </div>
            )}

            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Full Name:</label>
                <input type="text" className="form-input" required value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Ismeet" />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Email Address:</label>
                <input type="email" className="form-input" required value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="e.g. ismeet@certifyai.in" />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Password:</label>
                <input type="password" className="form-input" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="password" />
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Role (Strictly Two Roles):</label>
                <select className="form-input" value={newRole} onChange={e => setNewRole(e.target.value as any)}>
                  <option value="USER">USER (AI Testing & Reports)</option>
                  <option value="ADMIN">ADMIN (Enterprise Governance)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Department:</label>
                <input type="text" className="form-input" value={newDept} onChange={e => setNewDept(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddUserOpen(false)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
