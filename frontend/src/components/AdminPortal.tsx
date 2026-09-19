import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Users,
  BarChart2,
  FileText,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Calendar,
  Clock,
  ArrowUpRight,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Lock,
  UserPlus,
  Layers,
  Activity,
  LogOut,
  ChevronRight
} from 'lucide-react';
import type { AdminUser } from './AdminLogin';

interface AdminPortalProps {
  currentUser: AdminUser;
  onLogout: () => void;
  activeSubTab?: 'tests' | 'auditors' | 'agents' | 'logs';
  onSubTabChange?: (tab: 'tests' | 'auditors' | 'agents' | 'logs') => void;
}

interface TestRunRecord {
  id: number;
  audit_id: string;
  agent_name: string;
  tested_by_email: string;
  tested_by_name: string;
  user_role: string;
  mode: string;
  runs_count: number;
  concurrency: number;
  phases_selected: string[] | string;
  trust_score: number;
  tier: string;
  enterprise_ready: number;
  critical_count: number;
  warning_count: number;
  pass_count: number;
  duration_ms: number;
  created_at: string;
  notes?: string;
}

interface AuditorStat {
  tested_by_email: string;
  tested_by_name: string;
  user_role: string;
  test_count: number;
  avg_score: number;
  certified_count: number;
  last_tested_at: string;
}

interface AgentStat {
  agent_name: string;
  audit_count: number;
  avg_trust_score: number;
  total_criticals: number;
  latest_audit_date: string;
  latest_tier: string;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  onLogout,
  activeSubTab: controlledSubTab,
  onSubTabChange
}) => {
  const [internalSubTab, setInternalSubTab] = useState<'tests' | 'auditors' | 'agents' | 'logs'>('tests');
  const activeSubTab = controlledSubTab || internalSubTab;
  const setActiveSubTab = (tab: 'tests' | 'auditors' | 'agents' | 'logs') => {
    setInternalSubTab(tab);
    if (onSubTabChange) onSubTabChange(tab);
  };
  const [isLoading, setIsLoading] = useState(true);
  const [testRuns, setTestRuns] = useState<TestRunRecord[]>([]);
  const [auditors, setAuditors] = useState<AuditorStat[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStat[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAuditor, setFilterAuditor] = useState('all');
  const [filterTier, setFilterTier] = useState('all');
  const [selectedRunDetail, setSelectedRunDetail] = useState<TestRunRecord | null>(null);
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AgentStat | null>(null);

  // Add User Modal State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Auditor');
  const [newDept, setNewDept] = useState('AI Safety & Governance');
  const [newPassword, setNewPassword] = useState('password123');

  const BACKEND_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '' ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch Stats
      const statsRes = await fetch(`${BACKEND_URL}/api/admin/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAuditors(statsData.auditors || []);
        setAgentStats(statsData.agents || []);
      }

      // Fetch Detailed Tests
      const testsRes = await fetch(`${BACKEND_URL}/api/admin/tests?limit=100`);
      if (testsRes.ok) {
        const testsData = await testsRes.json();
        setTestRuns(testsData.tests || []);
      }

      // Fetch Users
      const usersRes = await fetch(`${BACKEND_URL}/api/admin/users`);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setAllUsers(usersData.users || []);
      }

      // Fetch Activity
      const actRes = await fetch(`${BACKEND_URL}/api/admin/activity`);
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivityLogs(actData.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateAuditor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          full_name: newName,
          role: newRole,
          department: newDept,
          password: newPassword
        })
      });
      if (res.ok) {
        setIsAddUserModalOpen(false);
        setNewEmail('');
        setNewName('');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.detail || 'Failed to create user');
      }
    } catch (e) {
      alert('Error creating auditor account');
    }
  };

  const handleExportCSV = () => {
    const headers = ['Audit ID', 'Agent Name', 'Tested By', 'Auditor Email', 'Role', 'Mode', 'Trust Score', 'Tier', 'Criticals', 'Warnings', 'Passes', 'Duration (ms)', 'Timestamp'];
    const rows = filteredRuns.map(r => [
      r.audit_id,
      `"${r.agent_name}"`,
      `"${r.tested_by_name}"`,
      r.tested_by_email,
      r.user_role,
      r.mode,
      r.trust_score,
      r.tier,
      r.critical_count,
      r.warning_count,
      r.pass_count,
      r.duration_ms,
      r.created_at
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CertifyAI_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered Test Runs
  const filteredRuns = testRuns.filter(r => {
    const matchesSearch =
      r.agent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tested_by_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tested_by_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.audit_id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAuditor = filterAuditor === 'all' || r.tested_by_email === filterAuditor;
    const matchesTier = filterTier === 'all' || r.tier === filterTier;

    return matchesSearch && matchesAuditor && matchesTier;
  });

  const totalTests = testRuns.length;
  const certifiedTests = testRuns.filter(r => r.tier === 'CERTIFIED').length;
  const totalCriticals = testRuns.reduce((acc, curr) => acc + (curr.critical_count || 0), 0);
  const avgTrustScore = totalTests > 0 ? (testRuns.reduce((acc, curr) => acc + curr.trust_score, 0) / totalTests).toFixed(1) : '0';

  return (
    <div className="admin-portal-container">
      {/* Top Header */}
      <div className="admin-portal-header">
        <div className="portal-header-left">
          <div className="portal-badge">
            <Shield size={16} />
            <span>Admin Governance Console</span>
          </div>
          <h1 className="portal-title">Organization Audit Trail & Compliance Matrix</h1>
          <p className="portal-subtitle">
            Centralized monitoring of test executions, auditor accountability, and security evaluations across all autonomous agents.
          </p>
        </div>

        <div className="portal-header-right">
          <div className="current-user-badge">
            <img
              src={currentUser.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
              alt={currentUser.full_name}
              className="user-avatar"
            />
            <div className="user-meta">
              <span className="user-name">{currentUser.full_name}</span>
              <span className="user-role">{currentUser.role}</span>
            </div>
            <button className="logout-btn" onClick={onLogout} title="Log Out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metrics Banner */}
      <div className="admin-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box blue">
            <FileText size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Tests Conducted</span>
            <div className="kpi-value-row">
              <span className="kpi-val">{totalTests}</span>
              <span className="kpi-subtag">Runs Executed</span>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box green">
            <ShieldCheck size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Certification Pass Rate</span>
            <div className="kpi-value-row">
              <span className="kpi-val">{totalTests > 0 ? `${Math.round((certifiedTests / totalTests) * 100)}%` : '0%'}</span>
              <span className="kpi-subtag">{certifiedTests} Certified</span>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box red">
            <ShieldAlert size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Critical Vulns Blocked</span>
            <div className="kpi-value-row">
              <span className="kpi-val">{totalCriticals}</span>
              <span className="kpi-subtag">Zero-Day / Injections</span>
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box purple">
            <Users size={22} />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Certified Auditors</span>
            <div className="kpi-value-row">
              <span className="kpi-val">{allUsers.length || 4}</span>
              <span className="kpi-subtag">Governance Team</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="admin-tab-nav">
        <div className="tab-buttons">
          <button
            className={`admin-nav-tab ${activeSubTab === 'tests' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('tests')}
          >
            <Activity size={16} />
            <span>Who Tested What (Audit Trail)</span>
            <span className="tab-count-badge">{filteredRuns.length}</span>
          </button>

          <button
            className={`admin-nav-tab ${activeSubTab === 'auditors' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('auditors')}
          >
            <Users size={16} />
            <span>Auditor Management & Leaderboard</span>
            <span className="tab-count-badge">{auditors.length}</span>
          </button>

          <button
            className={`admin-nav-tab ${activeSubTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('agents')}
          >
            <Layers size={16} />
            <span>Agent Target Statistics</span>
            <span className="tab-count-badge">{agentStats.length}</span>
          </button>

          <button
            className={`admin-nav-tab ${activeSubTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('logs')}
          >
            <Clock size={16} />
            <span>System Activity Logs</span>
          </button>
        </div>

        <div className="tab-actions">
          <button className="refresh-btn" onClick={fetchData} title="Refresh Live Data">
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button className="export-btn" onClick={handleExportCSV}>
            <Download size={15} />
            <span>Export CSV</span>
          </button>

          <button className="create-user-btn" onClick={() => setIsAddUserModalOpen(true)}>
            <UserPlus size={15} />
            <span>Add Auditor</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Who Tested What Table */}
      {activeSubTab === 'tests' && (
        <div className="admin-content-section">
          {/* Filters Bar */}
          <div className="admin-filter-bar">
            <div className="search-input-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by agent name, auditor name, email, or audit ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="filter-dropdowns">
              <div className="filter-item">
                <span className="filter-label">Auditor:</span>
                <select value={filterAuditor} onChange={(e) => setFilterAuditor(e.target.value)}>
                  <option value="all">All Auditors ({auditors.length})</option>
                  {auditors.map(a => (
                    <option key={a.tested_by_email} value={a.tested_by_email}>
                      {a.tested_by_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-item">
                <span className="filter-label">Certification Tier:</span>
                <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)}>
                  <option value="all">All Tiers</option>
                  <option value="CERTIFIED">CERTIFIED</option>
                  <option value="CONDITIONAL">CONDITIONAL</option>
                  <option value="NOT_CERTIFIED">NOT_CERTIFIED</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Auditor (Who Tested)</th>
                  <th>Agent Target</th>
                  <th>Execution Mode</th>
                  <th>Trust Score</th>
                  <th>Tier Status</th>
                  <th>Findings Summary</th>
                  <th>Duration</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="no-data-cell">
                      <div className="empty-state-box">
                        <ShieldAlert size={36} />
                        <p>No matching test records found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRuns.map((run) => (
                    <tr key={run.id} className="table-row-hover">
                      {/* Auditor Column */}
                      <td>
                        <div className="auditor-cell">
                          <div className="auditor-initials">
                            {run.tested_by_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="auditor-text">
                            <span className="auditor-name">{run.tested_by_name}</span>
                            <span className="auditor-email">{run.tested_by_email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Agent Target Column */}
                      <td>
                        <div className="agent-target-cell">
                          <span className="agent-target-name">{run.agent_name}</span>
                          <span className="agent-id-tag">ID: {run.audit_id}</span>
                        </div>
                      </td>

                      {/* Mode */}
                      <td>
                        <span className={`mode-badge ${run.mode}`}>
                          {run.mode === 'certify' ? 'Full Certify' : 'Validate'}
                        </span>
                      </td>

                      {/* Score */}
                      <td>
                        <div className="score-cell">
                          <span className={`score-badge ${run.trust_score >= 80 ? 'high' : (run.trust_score >= 50 ? 'medium' : 'low')}`}>
                            {run.trust_score.toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      {/* Tier */}
                      <td>
                        <span className={`tier-badge ${run.tier}`}>
                          {run.tier === 'CERTIFIED' && <ShieldCheck size={13} />}
                          {run.tier === 'CONDITIONAL' && <AlertTriangle size={13} />}
                          {run.tier === 'NOT_CERTIFIED' && <ShieldX size={13} />}
                          <span>{run.tier}</span>
                        </span>
                      </td>

                      {/* Findings Summary */}
                      <td>
                        <div className="findings-pills-row">
                          {run.critical_count > 0 ? (
                            <span className="finding-pill critical" title="Critical Failures">
                              {run.critical_count} crit
                            </span>
                          ) : (
                            <span className="finding-pill zero">0 crit</span>
                          )}
                          <span className="finding-pill warning" title="Warnings">
                            {run.warning_count} warn
                          </span>
                          <span className="finding-pill pass" title="Passed Checks">
                            {run.pass_count} pass
                          </span>
                        </div>
                      </td>

                      {/* Duration */}
                      <td>
                        <span className="duration-tag">
                          {(run.duration_ms / 1000).toFixed(2)}s
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td>
                        <div className="time-cell">
                          <span className="time-primary">
                            {new Date(run.created_at).toLocaleDateString()}
                          </span>
                          <span className="time-secondary">
                            {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td>
                        <button
                          className="view-run-btn"
                          onClick={() => setSelectedRunDetail(run)}
                          title="View Run Details"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Auditor Management & Leaderboard */}
      {activeSubTab === 'auditors' && (
        <div className="admin-content-section">
          <div className="auditor-cards-grid">
            {allUsers.map((user) => {
              const userStat = auditors.find(a => a.tested_by_email.toLowerCase() === user.email.toLowerCase());
              const testCount = userStat ? userStat.test_count : (user.total_audits_conducted || 0);
              const avgScore = userStat ? userStat.avg_score.toFixed(1) : (user.avg_score_given ? user.avg_score_given.toFixed(1) : 'N/A');

              return (
                <div key={user.id} className="auditor-profile-card">
                  <div className="card-top-row">
                    <img
                      src={user.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                      alt={user.full_name}
                      className="auditor-card-avatar"
                    />
                    <div className="auditor-card-info">
                      <h3 className="auditor-card-name">{user.full_name}</h3>
                      <span className="auditor-card-role">{user.role}</span>
                      <span className="auditor-card-dept">{user.department}</span>
                    </div>
                  </div>

                  <div className="auditor-stats-row">
                    <div className="stat-box">
                      <span className="stat-label">Tests Run</span>
                      <span className="stat-num">{testCount}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Avg Trust Score</span>
                      <span className="stat-num">{avgScore === 'N/A' ? '—' : `${avgScore}%`}</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Status</span>
                      <span className="active-status-badge">Active</span>
                    </div>
                  </div>

                  <div className="card-footer-email">
                    <span className="email-text">{user.email}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Agent Target Statistics */}
      {activeSubTab === 'agents' && (
        <div className="admin-content-section">
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Agent Target Name</th>
                  <th>Times Audited</th>
                  <th>Average Trust Score</th>
                  <th>Total Criticals Caught</th>
                  <th>Latest Status Tier</th>
                  <th>Last Evaluation Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agentStats.map((ag) => (
                  <tr key={ag.agent_name} className="table-row-hover">
                    <td>
                      <span className="agent-target-name bold">{ag.agent_name}</span>
                    </td>
                    <td>
                      <span className="badge-pill count">{ag.audit_count} runs</span>
                    </td>
                    <td>
                      <span className={`score-badge ${ag.avg_trust_score >= 80 ? 'high' : 'medium'}`}>
                        {ag.avg_trust_score.toFixed(1)}%
                      </span>
                    </td>
                    <td>
                      <span className={`finding-pill ${ag.total_criticals > 0 ? 'critical' : 'zero'}`}>
                        {ag.total_criticals} criticals
                      </span>
                    </td>
                    <td>
                      <span className={`tier-badge ${ag.latest_tier}`}>
                        {ag.latest_tier}
                      </span>
                    </td>
                    <td>
                      <span className="time-primary">
                        {new Date(ag.latest_audit_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td>
                      <button
                        className="view-run-btn"
                        onClick={() => setSelectedAgentDetail(ag)}
                        title="Inspect Historical Fleet Records"
                      >
                        Inspect Fleet
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: System Activity Logs */}
      {activeSubTab === 'logs' && (
        <div className="admin-content-section">
          <div className="activity-timeline">
            {activityLogs.map((log) => (
              <div key={log.id} className="timeline-item">
                <div className={`timeline-dot ${log.status.toLowerCase()}`} />
                <div className="timeline-body">
                  <div className="timeline-header-row">
                    <span className="timeline-event-type">{log.event_type}</span>
                    <span className="timeline-timestamp">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="timeline-details">{log.details}</p>
                  <div className="timeline-user-meta">
                    <span>By: <strong>{log.user_name}</strong> ({log.user_email})</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add New Auditor */}
      {isAddUserModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Add New Enterprise Auditor</h2>
              <button className="modal-close-btn" onClick={() => setIsAddUserModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAuditor} className="modal-form">
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Dr. Jordan Hayes"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Corporate Email</label>
                <input
                  type="email"
                  required
                  placeholder="jordan.hayes@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="Lead Auditor">Lead Auditor</option>
                  <option value="Senior Security Auditor">Senior Security Auditor</option>
                  <option value="Compliance Officer">Compliance Officer</option>
                  <option value="AI Safety Researcher">AI Safety Researcher</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>

              <div className="form-group">
                <label>Department</label>
                <input
                  type="text"
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Temporary Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsAddUserModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary">Register Auditor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Run Detail */}
      {selectedRunDetail && (
        <div className="modal-overlay">
          <div className="modal-card wide">
            <div className="modal-header">
              <div className="modal-title-box">
                <h2>Audit Run: {selectedRunDetail.audit_id}</h2>
                <span className={`tier-badge ${selectedRunDetail.tier}`}>{selectedRunDetail.tier}</span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedRunDetail(null)}>×</button>
            </div>

            <div className="run-detail-grid">
              <div className="detail-item">
                <span className="detail-label">Agent Target:</span>
                <span className="detail-val bold">{selectedRunDetail.agent_name}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Tested By:</span>
                <span className="detail-val">{selectedRunDetail.tested_by_name} ({selectedRunDetail.tested_by_email})</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Auditor Role:</span>
                <span className="detail-val">{selectedRunDetail.user_role}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Execution Mode:</span>
                <span className="detail-val">{selectedRunDetail.mode} ({selectedRunDetail.runs_count} runs, concurrency {selectedRunDetail.concurrency})</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Trust Score:</span>
                <span className="detail-val bold score">{selectedRunDetail.trust_score.toFixed(1)}%</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Duration:</span>
                <span className="detail-val">{(selectedRunDetail.duration_ms / 1000).toFixed(2)}s</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Date & Time:</span>
                <span className="detail-val">{new Date(selectedRunDetail.created_at).toLocaleString()}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Notes:</span>
                <span className="detail-val">{selectedRunDetail.notes || 'Automated compliance test'}</span>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={() => setSelectedRunDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View Agent Fleet Detail */}
      {selectedAgentDetail && (
        <div className="modal-overlay">
          <div className="modal-card wide">
            <div className="modal-header">
              <div className="modal-title-box">
                <h2>Monitored Agent: {selectedAgentDetail.agent_name}</h2>
                <span className={`tier-badge ${selectedAgentDetail.latest_tier}`}>{selectedAgentDetail.latest_tier}</span>
              </div>
              <button className="modal-close-btn" onClick={() => setSelectedAgentDetail(null)}>×</button>
            </div>

            <div className="run-detail-grid">
              <div className="detail-item">
                <span className="detail-label">Agent Target:</span>
                <span className="detail-val bold">{selectedAgentDetail.agent_name}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Total Audits Conducted:</span>
                <span className="detail-val bold">{selectedAgentDetail.audit_count} runs across all auditors</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Fleet Average Trust Score:</span>
                <span className="detail-val bold score">{selectedAgentDetail.avg_trust_score.toFixed(1)}%</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Critical Vulnerabilities Caught:</span>
                <span className="detail-val bold" style={{ color: selectedAgentDetail.total_criticals > 0 ? 'var(--color-critical)' : 'var(--color-pass)' }}>
                  {selectedAgentDetail.total_criticals} zero-day / injection flags
                </span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Latest Evaluation Date:</span>
                <span className="detail-val">{new Date(selectedAgentDetail.latest_audit_date).toLocaleString()}</span>
              </div>

              <div className="detail-item">
                <span className="detail-label">Governance Status:</span>
                <span className="detail-val">
                  {selectedAgentDetail.latest_tier === 'CERTIFIED' ? '✅ Enterprise Certified for Production' : '⚠️ Requires Remediation Before Deployment'}
                </span>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={() => setSelectedAgentDetail(null)}>Close Inspection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
