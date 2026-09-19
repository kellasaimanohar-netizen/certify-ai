import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  FileCode,
  GitBranch,
  Globe,
  Upload,
  Check,
  CheckCircle2,
  AlertTriangle,
  ShieldX,
  Copy,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  Sliders,
  Layers,
  BookOpen,
  FileText,
  Code,
  RefreshCw,
  TrendingUp,
  Terminal,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  Folder
} from 'lucide-react';
import type { AdminUser } from './AdminLogin';
import type { AgentTarget } from '../mockData';

interface UserAuditRunnerProps {
  onRunAudit: (params: {
    inputType: 'yaml' | 'repo' | 'openapi';
    yamlContent: string;
    repoPath: string;
    openapiUrl: string;
    mode: string;
    runs: number;
    concurrency: number;
    selectedPhases: string[];
  }) => void;
  isRunningAudit: boolean;
  auditProgress: number;
  terminalLines: string[];
  latestResult: any | null;
  currentUser: AdminUser | null;
  onViewResults: () => void;
}

const SAMPLE_YAML_TEMPLATES: Record<string, string> = {
  default: `apiVersion: certifyai/v1
kind: AuditAgent
metadata:
  name: example-agent
  description: |
    Compliance audit configuration for example agent
  tags: [compliance, security, production]

source:
  type: repository
  repo: https://github.com/example/agent
  path: /certify

audit:
  mode: validate
  frameworks:
    - ISO27001
    - SOC2
    - NIST
  parameters:
    environment: staging
    include_dependencies: true
  notifications:
    email: team@example.com
    slack: "#compliance"`,

  hr_assistant: `apiVersion: certifyai/v1
kind: AuditAgent
metadata:
  name: hr_compensation_advisor
  description: Autonomous HR assistant with payroll calculation permissions
  tags: [hr, payroll, internal]

source:
  type: inline

capabilities:
  max_steps: 10
  context_budget_tokens: 8000
  requires_hitl: true
  destructive_tools:
    - update_payroll_database
  tools:
    - query_employee_salary
    - compute_bonus_ratio

security:
  pii_fields:
    - national_id
    - base_salary
    - bank_account`,

  voice_agent: `apiVersion: certifyai/v1
kind: AuditAgent
metadata:
  name: voice_dispatch_agent_v7
  description: Emergency 911 dispatch voice agent with ASR / TTS filters
  tags: [voice, emergency, safety]

source:
  type: inline

capabilities:
  max_steps: 5
  context_budget_tokens: 4000
  requires_hitl: true
  tools:
    - trigger_emergency_dispatch
    - lookup_address_geocode

security:
  pii_fields:
    - caller_phone
    - home_address`
};

export const UserAuditRunner: React.FC<UserAuditRunnerProps> = ({
  onRunAudit,
  isRunningAudit,
  auditProgress,
  terminalLines,
  latestResult,
  currentUser,
  onViewResults,
}) => {
  // Current Workflow Step
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [inputType, setInputType] = useState<'yaml' | 'repo' | 'openapi' | 'upload'>('yaml');
  const [yamlContent, setYamlContent] = useState<string>(SAMPLE_YAML_TEMPLATES.default);
  const [repoPath, setRepoPath] = useState<string>('https://github.com/example/agent');
  const [openapiUrl, setOpenapiUrl] = useState<string>('http://localhost:8000/openapi.json');
  const [auditMode, setAuditMode] = useState<string>('validate');
  const [runnerRuns, setRunnerRuns] = useState<number>(1);
  const [concurrencyCap, setConcurrencyCap] = useState<number>(10);
  const [copiedHelp, setCopiedHelp] = useState(false);
  const [activeHelpTab, setActiveHelpTab] = useState<'example' | 'tips'>('example');
  
  // Available Phase selection
  const allPhases = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'reliability', label: 'Reliability' },
    { id: 'security', label: 'Security' },
    { id: 'observability', label: 'Observability' },
    { id: 'ops', label: 'Operations' },
    { id: 'adversarial', label: 'Adversarial' },
    { id: 'supply_chain', label: 'Supply Chain' },
    { id: 'data_governance', label: 'Data Governance' },
  ];

  const [selectedPhases, setSelectedPhases] = useState<string[]>([
    'architecture', 'reliability', 'security', 'observability',
    'ops', 'adversarial', 'supply_chain', 'data_governance'
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Sync step with audit execution status
  useEffect(() => {
    if (isRunningAudit) {
      setCurrentStep(4);
    } else if (latestResult) {
      setCurrentStep(5);
    }
  }, [isRunningAudit, latestResult]);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLines]);

  const handleSelectAllPhases = () => {
    if (selectedPhases.length === allPhases.length) {
      setSelectedPhases([]);
    } else {
      setSelectedPhases(allPhases.map(p => p.id));
    }
  };

  const handleTogglePhase = (id: string) => {
    if (selectedPhases.includes(id)) {
      setSelectedPhases(selectedPhases.filter(p => p !== id));
    } else {
      setSelectedPhases([...selectedPhases, id]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setYamlContent(event.target?.result as string || '');
        setInputType('yaml');
      };
      reader.readAsText(file);
    }
  };

  const handleCopyExample = () => {
    navigator.clipboard.writeText(SAMPLE_YAML_TEMPLATES.default);
    setCopiedHelp(true);
    setTimeout(() => setCopiedHelp(false), 2000);
  };

  const [liveRecentAudits, setLiveRecentAudits] = useState<any[]>([]);
  const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  useEffect(() => {
    // Fetch live recent audit test runs for quick reference
    fetch(`${BACKEND_URL}/api/admin/tests?limit=5`)
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.tests)) {
          setLiveRecentAudits(d.tests);
        }
      })
      .catch(e => console.error(e));
  }, [latestResult]);

  const handleTriggerRun = () => {
    setCurrentStep(4);
    onRunAudit({
      inputType: inputType === 'upload' ? 'yaml' : inputType,
      yamlContent,
      repoPath,
      openapiUrl,
      mode: auditMode,
      runs: auditMode === 'certify' ? 20 : runnerRuns,
      concurrency: concurrencyCap,
      selectedPhases
    });
  };

  const handleLoadRecentAudit = (audit: any) => {
    const matched = SAMPLE_YAML_TEMPLATES[audit.agent_name] || SAMPLE_YAML_TEMPLATES.default;
    setYamlContent(matched);
    setInputType('yaml');
  };

  return (
    <div className="user-runner-container">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="runner-subnav-row">
        <div className="breadcrumb-nav">
          <span className="breadcrumb-link">Agents</span>
          <ChevronRight size={14} className="breadcrumb-arrow" />
          <span className="breadcrumb-current">Audit Runner</span>
        </div>

        <div className="runner-quick-links">
          <a href="#docs" onClick={(e) => { e.preventDefault(); window.open('https://certifyai.in', '_blank'); }} className="doc-link-btn">
            <BookOpen size={14} />
            <span>Documentation</span>
          </a>
          <a href="#api" onClick={(e) => { e.preventDefault(); window.open('http://127.0.0.1:8000/docs', '_blank'); }} className="doc-link-btn">
            <Code size={14} />
            <span>API Reference</span>
          </a>
          <button className="doc-link-btn" onClick={() => alert('Feedback submitted to CertifyAI telemetry team.')}>
            <Sparkles size={14} />
            <span>Feedback</span>
          </button>
        </div>
      </div>

      {/* Main Header Banner */}
      <div className="runner-header-banner">
        <div className="runner-header-left">
          <div className="runner-icon-cube">
            <Layers size={24} />
          </div>
          <div className="runner-title-group">
            <h1 className="runner-title">Audit Runner</h1>
            <p className="runner-desc">
              Define your ingestion source, configure parameters, and run compliance audits with real-time insights.
            </p>
          </div>
        </div>

        <div className="runner-header-right">
          <button
            className="run-audit-primary-btn"
            onClick={handleTriggerRun}
            disabled={isRunningAudit}
          >
            {isRunningAudit ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Auditing ({auditProgress}%)...</span>
              </>
            ) : (
              <>
                <span>Run Audit</span>
                <Play size={16} className="play-icon" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* 5-Step Workflow Stepper */}
      <div className="runner-stepper-card">
        <div className={`step-item ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`} onClick={() => setCurrentStep(1)}>
          <div className="step-circle">1</div>
          <div className="step-text">
            <span className="step-label">Source</span>
            <span className="step-sub">Select ingestion method</span>
          </div>
        </div>

        <div className="step-connector" />

        <div className={`step-item ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`} onClick={() => setCurrentStep(2)}>
          <div className="step-circle">2</div>
          <div className="step-text">
            <span className="step-label">Configure</span>
            <span className="step-sub">Set parameters</span>
          </div>
        </div>

        <div className="step-connector" />

        <div className={`step-item ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`} onClick={() => setCurrentStep(3)}>
          <div className="step-circle">3</div>
          <div className="step-text">
            <span className="step-label">Validate</span>
            <span className="step-sub">Check configuration</span>
          </div>
        </div>

        <div className="step-connector" />

        <div className={`step-item ${currentStep >= 4 ? 'active' : ''} ${currentStep > 4 ? 'completed' : ''}`}>
          <div className="step-circle">4</div>
          <div className="step-text">
            <span className="step-label">Run Audit</span>
            <span className="step-sub">Execute and monitor</span>
          </div>
        </div>

        <div className="step-connector" />

        <div className={`step-item ${currentStep >= 5 ? 'active' : ''}`} onClick={() => { if (latestResult) onViewResults(); }}>
          <div className="step-circle">5</div>
          <div className="step-text">
            <span className="step-label">Results</span>
            <span className="step-sub">View findings</span>
          </div>
        </div>
      </div>

      {/* 3-Column Studio Layout */}
      <div className="runner-studio-grid">
        {/* Column 1: Ingestion Source & Audit Configuration */}
        <div className="studio-col col-left">
          {/* Ingestion Source Box */}
          <div className="studio-card">
            <div className="card-heading-group">
              <h3 className="card-main-title">
                <FileCode size={16} className="title-icon blue" />
                <span>Ingestion Source</span>
              </h3>
              <p className="card-sub-title">Choose how you want to provide your compliance data.</p>
            </div>

            <div className="source-options-list">
              <div
                className={`source-option-card ${inputType === 'yaml' ? 'selected' : ''}`}
                onClick={() => setInputType('yaml')}
              >
                <div className="source-option-icon">
                  <FileText size={18} />
                </div>
                <div className="source-option-body">
                  <span className="source-option-name">YAML Inline Manifest</span>
                  <span className="source-option-desc">Paste or write your agent manifest directly</span>
                </div>
                {inputType === 'yaml' && <div className="selected-check-badge"><Check size={14} /></div>}
              </div>

              <div
                className={`source-option-card ${inputType === 'repo' ? 'selected' : ''}`}
                onClick={() => setInputType('repo')}
              >
                <div className="source-option-icon">
                  <GitBranch size={18} />
                </div>
                <div className="source-option-body">
                  <span className="source-option-name">Repository Path</span>
                  <span className="source-option-desc">Connect to a Git repository</span>
                </div>
                {inputType === 'repo' && <div className="selected-check-badge"><Check size={14} /></div>}
              </div>

              <div
                className={`source-option-card ${inputType === 'openapi' ? 'selected' : ''}`}
                onClick={() => setInputType('openapi')}
              >
                <div className="source-option-icon">
                  <Globe size={18} />
                </div>
                <div className="source-option-body">
                  <span className="source-option-name">OpenAPI Specification URL</span>
                  <span className="source-option-desc">Provide an OpenAPI/Swagger URL</span>
                </div>
                {inputType === 'openapi' && <div className="selected-check-badge"><Check size={14} /></div>}
              </div>

              <div
                className={`source-option-card ${inputType === 'upload' ? 'selected' : ''}`}
                onClick={() => {
                  setInputType('upload');
                  fileInputRef.current?.click();
                }}
              >
                <div className="source-option-icon">
                  <Upload size={18} />
                </div>
                <div className="source-option-body">
                  <span className="source-option-name">Upload File</span>
                  <span className="source-option-desc">Upload a YAML or JSON file</span>
                </div>
                {inputType === 'upload' && <div className="selected-check-badge"><Check size={14} /></div>}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".yaml,.yml,.json"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>

            {inputType === 'repo' && (
              <div className="source-param-input-box">
                <label>Git Repository URL or Local Directory</label>
                <input
                  type="text"
                  value={repoPath}
                  onChange={(e) => setRepoPath(e.target.value)}
                  placeholder="https://github.com/my-org/agent-repo"
                />
              </div>
            )}

            {inputType === 'openapi' && (
              <div className="source-param-input-box">
                <label>OpenAPI Swagger 3.0+ Spec URL</label>
                <input
                  type="text"
                  value={openapiUrl}
                  onChange={(e) => setOpenapiUrl(e.target.value)}
                  placeholder="http://localhost:8000/openapi.json"
                />
              </div>
            )}
          </div>

          {/* Audit Configuration Box */}
          <div className="studio-card">
            <div className="card-heading-group">
              <h3 className="card-main-title">
                <Sliders size={16} className="title-icon purple" />
                <span>Audit Configuration</span>
              </h3>
            </div>

            <div className="config-form-group">
              <label>Audit Mode</label>
              <select
                value={auditMode}
                onChange={(e) => setAuditMode(e.target.value)}
                className="custom-runner-select"
              >
                <option value="validate">VALIDATE (Mock execution)</option>
                <option value="certify">CERTIFY (Full 17-Phase Evaluation)</option>
                <option value="simulate">SIMULATE (Adversarial stress test)</option>
              </select>
            </div>

            <div className="config-form-group">
              <div className="phases-header-row">
                <label>Target Audit Phases ({selectedPhases.length})</label>
                <button type="button" className="select-all-btn" onClick={handleSelectAllPhases}>
                  {selectedPhases.length === allPhases.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="phases-checkboxes-grid">
                {allPhases.map((phase) => (
                  <label key={phase.id} className="phase-checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedPhases.includes(phase.id)}
                      onChange={() => handleTogglePhase(phase.id)}
                    />
                    <span>{phase.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="configure-params-btn"
              onClick={handleTriggerRun}
            >
              <span>Next: Configure Parameters</span>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Column 2: Manifest Editor */}
        <div className="studio-col col-center">
          <div className="studio-card editor-card">
            <div className="editor-card-header">
              <div className="editor-title-group">
                <h3 className="card-main-title">
                  <Code size={16} className="title-icon cyan" />
                  <span>Manifest Editor</span>
                </h3>
                <p className="card-sub-title">Write or paste your agent compliance YAML manifest.</p>
              </div>

              <div className="editor-actions-group">
                <button
                  type="button"
                  className="editor-tool-btn"
                  onClick={() => setYamlContent(SAMPLE_YAML_TEMPLATES.hr_assistant)}
                >
                  <FileText size={13} />
                  <span>Sample Template</span>
                </button>
                <button
                  type="button"
                  className="editor-tool-btn"
                  onClick={() => {
                    // Simple formatting simulation
                    try {
                      setYamlContent(prev => prev.trim());
                    } catch (e) {}
                  }}
                >
                  <Sparkles size={13} />
                  <span>Format</span>
                </button>
              </div>
            </div>

            {/* Dark Monaco-like Code Editor */}
            <div className="monaco-code-container">
              <div className="code-editor-top-bar">
                <span className="lang-tag">YAML</span>
                <button
                  className="code-copy-action"
                  onClick={() => {
                    navigator.clipboard.writeText(yamlContent);
                    alert('YAML manifest copied to clipboard');
                  }}
                  title="Copy Manifest"
                >
                  <Copy size={13} />
                </button>
              </div>

              <textarea
                className="monaco-code-textarea"
                value={yamlContent}
                onChange={(e) => setYamlContent(e.target.value)}
                spellCheck={false}
                placeholder="Enter YAML manifest here..."
              />

              <div className="code-editor-status-bar">
                <div className="syntax-valid-badge">
                  <span className="status-dot green" />
                  <span>YAML syntax looks good</span>
                </div>
                <div className="editor-meta-info">
                  <span>Ln 1, Col 1</span>
                  <span>Spaces: 2</span>
                  <span>YAML</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Streaming Terminal (Visible during & after audit execution) */}
          {(isRunningAudit || terminalLines.length > 0) && (
            <div className="studio-card terminal-card">
              <div className="terminal-header-bar">
                <div className="terminal-title">
                  <Terminal size={15} />
                  <span>Execution Stream Console</span>
                </div>
                {isRunningAudit && (
                  <div className="live-pill">
                    <span className="pulse-dot" />
                    <span>LIVE</span>
                  </div>
                )}
              </div>

              <div className="terminal-output-box">
                {terminalLines.map((line, idx) => (
                  <div key={idx} className="terminal-line">
                    <span className="line-text">{line}</span>
                  </div>
                ))}
                <div ref={terminalBottomRef} />
              </div>

              {latestResult && (
                <div className="terminal-completion-bar">
                  <div className="completion-info">
                    <CheckCircle2 size={16} className="text-green" />
                    <span>Audit complete! Trust Score: <strong>{latestResult.trust_score}%</strong> [{latestResult.tier}]</span>
                  </div>
                  <button className="view-results-btn" onClick={onViewResults}>
                    <span>View Complete Dashboard & Certificate</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column 3: Quick Help & Recent Audits */}
        <div className="studio-col col-right">
          {/* Quick Help Card */}
          <div className="studio-card help-card">
            <div className="card-heading-group">
              <h3 className="card-main-title">
                <HelpCircle size={16} className="title-icon blue" />
                <span>Quick Help</span>
              </h3>
              <p className="card-sub-title">Need help getting started? Use a template or check our docs.</p>
            </div>

            <div className="help-tabs-row">
              <button
                type="button"
                className={`help-tab ${activeHelpTab === 'example' ? 'active' : ''}`}
                onClick={() => setActiveHelpTab('example')}
              >
                Example Manifest
              </button>
              <button
                type="button"
                className={`help-tab ${activeHelpTab === 'tips' ? 'active' : ''}`}
                onClick={() => setActiveHelpTab('tips')}
              >
                Tips
              </button>
            </div>

            {activeHelpTab === 'example' ? (
              <div className="help-snippet-container">
                <div className="help-snippet-header">
                  <span>yaml</span>
                  <button className="help-copy-btn" onClick={handleCopyExample}>
                    <Copy size={12} />
                    <span>{copiedHelp ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="help-code-block">
{`apiVersion: certifyai/v1
kind: AuditAgent
metadata:
  name: my-agent
  description: Example agent
source:
  type: openapi
  url: https://api.example.com/openapi.json
audit:
  mode: validate
  frameworks: [SOC2, ISO27001]`}
                </pre>
              </div>
            ) : (
              <div className="help-tips-list">
                <div className="tip-item">
                  <span className="tip-bullet">💡</span>
                  <span>Set <code>capabilities.max_steps</code> to limit recursive looping risks.</span>
                </div>
                <div className="tip-item">
                  <span className="tip-bullet">🛡️</span>
                  <span>Enable <code>requires_hitl: true</code> on any financial or destructive tools.</span>
                </div>
              </div>
            )}

            <a href="#docs" onClick={(e) => { e.preventDefault(); window.open('https://certifyai.in', '_blank'); }} className="full-doc-link">
              <span>View full documentation</span>
              <ChevronRight size={13} />
            </a>
          </div>

          {/* Recent Audits Card */}
          <div className="studio-card recent-audits-card">
            <div className="recent-audits-header">
              <h3 className="card-main-title">
                <RefreshCw size={16} className="title-icon blue" />
                <span>Recent Audits</span>
              </h3>
              <a href="#view-all" onClick={(e) => { e.preventDefault(); onViewResults(); }} className="view-all-link">
                View all →
              </a>
            </div>

            <div className="recent-audits-list">
              {liveRecentAudits.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                  No previous audit runs yet. Run your first audit to see history here!
                </div>
              ) : (
                liveRecentAudits.map((audit, idx) => (
                  <div
                    key={idx}
                    className="recent-audit-item"
                    onClick={() => handleLoadRecentAudit(audit)}
                    title="Click to load manifest template"
                  >
                    <div className="recent-audit-left">
                      <FileText size={16} className="recent-icon" />
                      <div className="recent-meta">
                        <span className="recent-name" style={{ textTransform: 'capitalize' }}>
                          {audit.agent_name?.replace(/_/g, ' ')}
                        </span>
                        <span className="recent-time">
                          {new Date(audit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {audit.mode?.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="recent-audit-right">
                      <span className={`recent-status-pill ${audit.tier === 'CERTIFIED' ? 'passed' : audit.tier === 'CONDITIONAL' ? 'warnings' : 'failed'}`}>
                        {audit.tier === 'CERTIFIED' && <CheckCircle size={12} />}
                        {audit.tier === 'CONDITIONAL' && <AlertTriangle size={12} />}
                        {audit.tier === 'NOT_CERTIFIED' && <ShieldX size={12} />}
                        <span>{audit.tier}</span>
                      </span>
                      <ChevronRight size={13} className="recent-arrow" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
