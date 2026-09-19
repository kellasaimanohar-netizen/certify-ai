import React from 'react';
import { Database, GitBranch, Globe, Folder, Plus, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';

export const DataSourcesView: React.FC<{ onConnectRunner?: () => void }> = ({ onConnectRunner }) => {
  const sources = [
    { name: 'Production Agent Git Repo', type: 'GitHub / GitLab', path: 'https://github.com/certifyai/agent-core', status: 'Connected', lastSynced: '10 mins ago', agentsFound: 8 },
    { name: 'Enterprise API Gateway', type: 'OpenAPI 3.1.0', path: 'http://127.0.0.1:8000/openapi.json', status: 'Connected', lastSynced: 'Just now', agentsFound: 14 },
    { name: 'Local Target Manifests Store', type: 'YAML / JSON Filesystem', path: 'c:/Personal/V10/backend/targets', status: 'Active', lastSynced: '1 hour ago', agentsFound: 6 },
    { name: 'AWS Bedrock Agent Runtime', type: 'Cloud Model Evaluator', path: 'arn:aws:bedrock:us-east-1:agent/*', status: 'Ready', lastSynced: 'Yesterday', agentsFound: 3 }
  ];

  return (
    <div className="user-runner-container">
      <div className="runner-header-banner">
        <div className="runner-header-left">
          <div className="runner-icon-cube">
            <Database size={24} />
          </div>
          <div className="runner-title-group">
            <h1 className="runner-title">Connected Ingestion Data Sources</h1>
            <p className="runner-desc">
              Manage live repositories, OpenAPI schemas, and target filesystems connected to the evaluation pipeline.
            </p>
          </div>
        </div>

        <div className="runner-header-right">
          <button className="run-audit-primary-btn" onClick={onConnectRunner}>
            <Plus size={16} />
            <span>Connect Ingestion Source</span>
          </button>
        </div>
      </div>

      <div className="auditor-cards-grid" style={{ marginTop: '20px' }}>
        {sources.map((s, idx) => (
          <div key={idx} className="auditor-profile-card">
            <div className="card-top-row">
              <div className="kpi-icon-box blue" style={{ width: '40px', height: '40px' }}>
                <Database size={20} />
              </div>
              <div className="auditor-card-info">
                <h3 className="auditor-card-name" style={{ fontSize: '15px' }}>{s.name}</h3>
                <span className="auditor-card-role">{s.type}</span>
              </div>
            </div>

            <div className="card-footer-email" style={{ wordBreak: 'break-all' }}>
              <code>{s.path}</code>
            </div>

            <div className="auditor-stats-row">
              <div className="stat-box">
                <span className="stat-label">Agents</span>
                <span className="stat-num">{s.agentsFound}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Last Sync</span>
                <span className="stat-num" style={{ fontSize: '11px' }}>{s.lastSynced}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Status</span>
                <span className="active-status-badge">{s.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
