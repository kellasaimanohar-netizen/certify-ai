import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Bell,
  Save,
  CheckCircle2,
  Key,
  Globe,
  Sliders,
  Lock,
  Cpu,
  RefreshCw,
  Zap,
  Activity,
  CheckCircle
} from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const [apiToken, setApiToken] = useState('AGENT_API_TOKEN_V10_SECURE_98X');
  const [driftThreshold, setDriftThreshold] = useState('high');
  const [maxConcurrency, setMaxConcurrency] = useState('25');
  const [slackWebhook, setSlackWebhook] = useState('https://hooks.slack.com/services/T00/B00/X00');
  const [teamsWebhook, setTeamsWebhook] = useState('https://outlook.office.com/webhook/enterprise-certifyai');
  const [jiraEndpoint, setJiraEndpoint] = useState('https://enterprise.atlassian.net/rest/api/3/issue');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3500);
  };

  return (
    <div className="animate-slideup" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner Header */}
      <div className="glass-card" style={{
        padding: '24px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        background: 'linear-gradient(135deg, rgba(13, 20, 38, 0.9) 0%, rgba(20, 32, 60, 0.7) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.18)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #00f0ff 0%, #7000ff 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(0, 240, 255, 0.4)'
          }}>
            <Settings size={24} style={{ color: '#fff' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>
              Audit Engine & Governance Settings
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              Configure global API security credentials, Wilson confidence bounds, and incident alerting webhooks.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#10b981',
            fontSize: '12.5px',
            fontWeight: '700'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
            Engine Core v10.4 Active
          </div>
        </div>
      </div>

      {isSaved && (
        <div style={{
          padding: '14px 20px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          borderRadius: '10px',
          color: '#10b981',
          fontSize: '13.5px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
        }}>
          <CheckCircle2 size={18} />
          <span>Audit engine parameters, security keys, and notification webhooks successfully saved & synchronized!</span>
        </div>
      )}

      {/* 3-Column Settings Grid */}
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '24px',
          width: '100%'
        }}>

          {/* Card 1: Security & Bearer Authentication */}
          <div className="glass-card" style={{ padding: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0, 240, 255, 0.1)', color: 'var(--accent-cyan)' }}>
                <Key size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  API & Bearer Authentication
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Global access and execution keys</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Master API Bearer Token:
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12.5px', color: 'var(--accent-cyan)' }}
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Cryptographic Authority Protocol:
                </label>
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Lock size={14} style={{ color: '#10b981' }} />
                  <span>Ed25519 Pure Signature Authority (SHA-512)</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Session Re-authentication Timeout:
                </label>
                <select className="form-input" style={{ width: '100%' }} defaultValue="8h">
                  <option value="4h">4 Hours (High Security Environment)</option>
                  <option value="8h">8 Hours (Standard Enterprise Session)</option>
                  <option value="24h">24 Hours (Extended Sandbox Debugging)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Card 2: Sensitivity & Execution Bounds */}
          <div className="glass-card" style={{ padding: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                <Sliders size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Drift & Confidence Bounds
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Statistical rigor & concurrency controls</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Drift Scan Sensitivity Threshold:
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%' }}
                  value={driftThreshold}
                  onChange={e => setDriftThreshold(e.target.value)}
                >
                  <option value="high">High Sensitivity (All 17 modules, strict Wilson 95% bound)</option>
                  <option value="medium">Medium Sensitivity (Top 80% parameter weight)</option>
                  <option value="low">Low Sensitivity (Only critical vulnerabilities flagged)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Max Concurrency Cap per Run:
                </label>
                <select
                  className="form-input"
                  style={{ width: '100%' }}
                  value={maxConcurrency}
                  onChange={e => setMaxConcurrency(e.target.value)}
                >
                  <option value="10">10 Simultaneous Test Threads (Conservative)</option>
                  <option value="25">25 Simultaneous Test Threads (Standard High Performance)</option>
                  <option value="50">50 Simultaneous Test Threads (Extreme Stress Testing)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Auto-Certify Score Threshold:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="range"
                    min="70"
                    max="95"
                    defaultValue="85"
                    style={{ flex: 1, accentColor: 'var(--accent-cyan)' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent-cyan)', width: '45px' }}>85.0%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Alerting Webhooks */}
          <div className="glass-card" style={{ padding: '26px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                <Bell size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Incident Alerting Integrations
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Automated notifications on critical findings</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Slack Incident Webhook:
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', fontSize: '12.5px' }}
                  value={slackWebhook}
                  onChange={e => setSlackWebhook(e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Microsoft Teams Webhook:
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', fontSize: '12.5px' }}
                  value={teamsWebhook}
                  onChange={e => setTeamsWebhook(e.target.value)}
                  placeholder="https://outlook.office.com/webhook/..."
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Jira Issue Automation API:
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{ width: '100%', fontSize: '12.5px' }}
                  value={jiraEndpoint}
                  onChange={e => setJiraEndpoint(e.target.value)}
                  placeholder="https://company.atlassian.net/rest/api/..."
                />
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar with Save Button */}
        <div className="glass-card" style={{
          padding: '18px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'rgba(10, 15, 29, 0.7)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            <Activity size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Changes will take effect instantly across all active testing threads and evaluation pipelines.</span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              padding: '12px 28px',
              fontSize: '14px',
              fontWeight: '700',
              gap: '10px',
              borderRadius: '10px',
              boxShadow: '0 0 20px rgba(0, 240, 255, 0.3)'
            }}
          >
            <Save size={16} />
            <span>Save Configuration</span>
          </button>
        </div>

      </form>

    </div>
  );
};
