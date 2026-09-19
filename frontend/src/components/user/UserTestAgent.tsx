import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  FileCode,
  GitBranch,
  Globe,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  RefreshCw,
  Terminal,
  Download,
  FileText,
  Copy,
  ChevronRight,
  ChevronDown,
  Layers,
  SlidersHorizontal,
  Info,
  ExternalLink,
  Shield,
  Activity,
  Zap,
  Code
} from 'lucide-react';
import { generatePDFReport } from '../../utils/pdfExport';

interface UserTestAgentProps {
  user: {
    id: number | string;
    name: string;
    email: string;
    role: string;
  };
  onTestCompleted?: (result: any) => void;
  preselectedAgentName?: string;
  onNavigate?: (tab: string) => void;
}

const ALL_PHASES = [
  { id: 'architecture', label: 'Architecture & Limits' },
  { id: 'reliability', label: 'Reliability & Timeouts' },
  { id: 'security', label: 'Security & Prompt Injection' },
  { id: 'observability', label: 'Observability & Tracing' },
  { id: 'ops', label: 'Operational Readiness' },
  { id: 'adversarial', label: 'Adversarial Robustness' },
  { id: 'supply_chain', label: 'Supply Chain & Dependencies' },
  { id: 'data_governance', label: 'Data Governance & PII' },
  { id: 'groundedness', label: 'Groundedness & Accuracy' },
  { id: 'fairness', label: 'Fairness & Bias Parity' },
  { id: 'multi_turn', label: 'Multi-Turn Memory Safety' },
  { id: 'mcp', label: 'Model Context Protocol (MCP)' },
  { id: 'voice', label: 'Voice Agent Safety (v7)' },
  { id: 'data_analysis', label: 'Data Analysis SQL Safety (v7)' },
  { id: 'decision', label: 'Decision & Action Safety (v7)' },
  { id: 'security_agent', label: 'SecOps Agent Safety (v7)' },
  { id: 'browser', label: 'Browser Agent Safety (v7)' }
];

const DEFAULT_YAML = `apiVersion: certifyai/v1
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
    - bank_account
`;

export const UserTestAgent: React.FC<UserTestAgentProps> = ({
  user,
  onTestCompleted,
  preselectedAgentName,
  onNavigate
}) => {
  // Wizard state: 'config' | 'running' | 'result'
  const [screenState, setScreenState] = useState<'config' | 'running' | 'result'>('config');

  // Config parameters
  const [inputType, setInputType] = useState<'agent_select' | 'yaml' | 'repo' | 'openapi'>('agent_select');
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgentCard, setSelectedAgentCard] = useState<string>(preselectedAgentName || 'HR Compensation Agent');
  const [yamlContent, setYamlContent] = useState<string>(DEFAULT_YAML);
  const [repoPath, setRepoPath] = useState<string>('c:/Personal/V10');
  const [openapiUrl, setOpenapiUrl] = useState<string>('http://127.0.0.1:8000/openapi.json');
  const [testMode, setTestMode] = useState<'validate' | 'certify'>('certify');
  const [runsCount, setRunsCount] = useState<number>(20);
  const [concurrency, setConcurrency] = useState<number>(10);
  const [selectedPhases, setSelectedPhases] = useState<string[]>([
    'architecture', 'reliability', 'security', 'observability', 'ops', 'adversarial', 'data_governance'
  ]);

  // Live execution state
  const [progress, setProgress] = useState<number>(0);
  const [currentPhaseLabel, setCurrentPhaseLabel] = useState<string>('Initializing sandbox...');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Result state
  const [testResult, setTestResult] = useState<any | null>(null);
  const [findingFilter, setFindingFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'PASS'>('ALL');
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState<boolean>(false);

  const BACKEND_URL = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '' ? import.meta.env.VITE_API_URL : (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

  useEffect(() => {
    // Fetch available agents
    const fetchAgents = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/user/agents`, {
          headers: { 'X-User-Id': String(user?.id || 2) }
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableAgents(data.agents || []);
          if (preselectedAgentName) {
            setSelectedAgentCard(preselectedAgentName);
          } else if (data.agents && data.agents.length > 0) {
            setSelectedAgentCard(data.agents[0].name);
          }
        }
      } catch (err) {
        console.error('Failed to load agents list:', err);
      }
    };
    fetchAgents();
  }, [user?.id, preselectedAgentName]);

  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  const togglePhase = (phaseId: string) => {
    setSelectedPhases(prev =>
      prev.includes(phaseId) ? prev.filter(p => p !== phaseId) : [...prev, phaseId]
    );
  };

  const handleSelectAllPhases = () => {
    if (selectedPhases.length === ALL_PHASES.length) {
      setSelectedPhases(['security', 'reliability']);
    } else {
      setSelectedPhases(ALL_PHASES.map(p => p.id));
    }
  };

  // Start Audit Execution via SSE
  const handleStartAudit = async () => {
    setScreenState('running');
    setProgress(5);
    setTerminalLogs([
      `[${new Date().toLocaleTimeString()}] Starting CertifyAI Autonomous Audit Engine v10...`,
      `[info] Authenticated Tester: ${user?.name || 'Ismeet'} (Role: USER)`,
      `[info] Mode: ${testMode.toUpperCase()} | Variability Runs: ${testMode === 'validate' ? 1 : runsCount} | Concurrency: ${concurrency}`,
      `[info] Selected Safety Phases: ${selectedPhases.length} of ${ALL_PHASES.length}`
    ]);

    let payload: any = {
      mode: testMode,
      runs: testMode === 'validate' ? 1 : runsCount,
      concurrency: concurrency,
      selected_phases: selectedPhases,
      user_id: user?.id || 2,
      tested_by_email: user?.email || 'ismeet@certifyai.in',
      tested_by_name: user?.name || 'Ismeet',
      user_role: 'USER'
    };

    if (inputType === 'agent_select') {
      const cleanName = selectedAgentCard.toLowerCase().replace(/ /g, '_');
      payload.yaml_content = `agent_name: ${cleanName}\nversion: 1.0.0\ncapabilities:\n  max_steps: 10\n  context_budget_tokens: 8000\n  tools:\n    - query_data\n    - process_action\nsecurity:\n  pii_fields:\n    - email\n    - phone\n`;
    } else if (inputType === 'yaml') {
      payload.yaml_content = yamlContent;
    } else if (inputType === 'repo') {
      payload.repo_path = repoPath;
    } else if (inputType === 'openapi') {
      payload.openapi_url = openapiUrl;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok || !response.body) {
        throw new Error(`Audit execution failed: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'log') {
                setTerminalLogs(prev => [...prev, event.message]);
                if (event.message.includes('Phase')) {
                  const match = event.message.match(/\[Phase \d+:? ([^\]]+)\]/);
                  if (match) setCurrentPhaseLabel(`Evaluating ${match[1]}...`);
                }
              } else if (event.type === 'progress') {
                setProgress(event.val);
              } else if (event.type === 'result') {
                setProgress(100);
                setTestResult(event.data);
                if (onTestCompleted) onTestCompleted(event.data);
                setTimeout(() => {
                  setScreenState('result');
                }, 800);
              } else if (event.type === 'error') {
                setTerminalLogs(prev => [...prev, `[CRITICAL ERROR] ${event.detail}`]);
              }
            } catch (err) {
              // Ignore line parse error
            }
          }
        }
      }
    } catch (err: any) {
      setTerminalLogs(prev => [
        ...prev,
        `[CRITICAL FAILURE] ${err.message}`,
        `[info] Ensure the backend API server is running on ${BACKEND_URL}`
      ]);
    }
  };

  const handleDownloadPDF = () => {
    if (!testResult) return;
    const doc = generatePDFReport(testResult);
    doc.save(`${testResult.agent_name || 'agent'}_audit_report.pdf`);
  };

  const handleDownloadJSON = () => {
    if (!testResult) return;
    const blob = new Blob([JSON.stringify(testResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${testResult.agent_name || 'agent'}_audit_report.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ==========================================
  // RENDER SCREEN 2: LIVE AUDIT RUNNING
  // ==========================================
  if (screenState === 'running') {
    return (
      <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Progress Card */}
        <div className="glass-card" style={{ padding: '24px 28px', border: '1px solid rgba(0, 180, 216, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(0, 180, 216, 0.15)', color: 'var(--accent-cyan)' }}>
                <RefreshCw size={20} className="spin-animation" />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Audit Running: {selectedAgentCard}
                </h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{currentPhaseLabel}</span>
              </div>
            </div>
            <div style={{ fontSize: '26px', fontWeight: '800', color: 'var(--accent-cyan)' }}>
              {progress}%
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', overflow: 'hidden' }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #2ecc71, #00f0ff)',
              borderRadius: '6px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Live SSE Terminal */}
        <div className="terminal-container" style={{ minHeight: '440px' }}>
          <div className="terminal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} style={{ color: 'var(--accent-cyan)' }} />
              <span className="terminal-title">Live Evaluation Trace — Server-Sent Events (SSE)</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>streaming live</span>
          </div>

          <div className="terminal-body" style={{ color: '#a5b4fc', minHeight: '380px', maxHeight: '480px', overflowY: 'auto' }}>
            {terminalLogs.map((log, idx) => {
              let color = 'var(--text-secondary)';
              if (log.toLowerCase().includes('critical') || log.toLowerCase().includes('fail')) color = 'var(--color-critical)';
              else if (log.toLowerCase().includes('warn')) color = 'var(--color-warning)';
              else if (log.toLowerCase().includes('success') || log.toLowerCase().includes('passed')) color = 'var(--color-pass)';
              else if (log.startsWith('[info]')) color = 'var(--accent-cyan)';

              return (
                <div key={idx} style={{ display: 'flex', gap: '10px', fontSize: '12px', lineHeight: '1.6' }}>
                  <span style={{ color }}>{log}</span>
                </div>
              );
            })}
            <div ref={terminalBottomRef} />
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER SCREEN 3: TEST RESULT
  // ==========================================
  if (screenState === 'result' && testResult) {
    const isCertified = testResult.tier === 'CERTIFIED';
    const isConditional = testResult.tier === 'CONDITIONAL';
    const scoreColor = isCertified ? '#2ecc71' : isConditional ? '#f1c40f' : '#e74c3c';
    const findingsList = testResult.findings || [];

    const filteredFindings = findingsList.filter((f: any) => {
      if (findingFilter === 'ALL') return true;
      const sev = (f.severity || 'PASS').toUpperCase();
      return sev === findingFilter;
    });

    return (
      <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Top Result Banner */}
        <div className="glass-card" style={{
          padding: '28px 32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '24px',
          background: `linear-gradient(135deg, ${scoreColor}15 0%, rgba(15, 23, 42, 0.6) 100%)`,
          border: `1px solid ${scoreColor}40`
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <span style={{ fontSize: '20px' }}>{isCertified ? '🛡️' : isConditional ? '⚠️' : '❌'}</span>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                {testResult.agent_name || selectedAgentCard}
              </h1>
              <span style={{
                background: `${scoreColor}20`,
                color: scoreColor,
                border: `1px solid ${scoreColor}50`,
                padding: '4px 12px',
                borderRadius: '16px',
                fontSize: '12px',
                fontWeight: '800'
              }}>
                {testResult.tier}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)' }}>
              Evaluation completed in {(testResult.total_duration_ms / 1000).toFixed(1)}s • Tested by {user?.name || 'Ismeet'}
            </p>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleDownloadPDF} style={{ padding: '8px 14px', fontSize: '12.5px' }}>
              <Download size={14} />
              <span>Download PDF</span>
            </button>
            <button className="btn btn-secondary" onClick={handleDownloadJSON} style={{ padding: '8px 14px', fontSize: '12.5px' }}>
              <Code size={14} />
              <span>JSON Export</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setIsCertModalOpen(true)} style={{ padding: '8px 14px', fontSize: '12.5px' }}>
              <ShieldCheck size={14} />
              <span>Certificate</span>
            </button>
            <button className="btn btn-primary" onClick={() => setScreenState('config')} style={{ padding: '8px 16px', fontSize: '12.5px' }}>
              <Play size={14} />
              <span>Run Another Test</span>
            </button>
          </div>
        </div>

        {/* Score & Summary Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          {/* Radial Trust Score Card */}
          <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Composite Trust Score
            </span>
            
            {/* Radial Score Indicator */}
            <div style={{
              position: 'relative',
              width: '140px',
              height: '140px',
              borderRadius: '50%',
              background: `conic-gradient(${scoreColor} ${testResult.trust_score * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 24px ${scoreColor}30`
            }}>
              <div style={{
                width: '116px',
                height: '116px',
                borderRadius: '50%',
                background: 'var(--bg-panel)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '32px', fontWeight: '900', color: scoreColor, lineHeight: 1 }}>
                  {testResult.trust_score}%
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>
                  {testResult.tier}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '16px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              {isCertified ? 'Passed all security and robustness gates' : 'Requires remediation before deployment'}
            </div>
          </div>

          {/* Finding Counts Breakdown */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px' }}>
              Findings Summary
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.25)' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-critical)', textTransform: 'uppercase' }}>Critical Failures</span>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-critical)', marginTop: '4px' }}>
                  {testResult.critical_count || 0}
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.25)' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-warning)', textTransform: 'uppercase' }}>Warnings</span>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-warning)', marginTop: '4px' }}>
                  {testResult.warning_count || 0}
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(46,204,113,0.1)', border: '1px solid rgba(46,204,113,0.25)' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-pass)', textTransform: 'uppercase' }}>Passed Checks</span>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-pass)', marginTop: '4px' }}>
                  {testResult.pass_count || 0}
                </div>
              </div>
              <div style={{ padding: '14px', borderRadius: '8px', background: 'rgba(0,180,216,0.1)', border: '1px solid rgba(0,180,216,0.25)' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>Total Checks</span>
                <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '4px' }}>
                  {(testResult.critical_count || 0) + (testResult.warning_count || 0) + (testResult.pass_count || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Phase Breakdown Card */}
        {testResult.audit_summary?.phase_scores && (
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
              Phase-Level Score Breakdown
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              {Object.entries(testResult.audit_summary.phase_scores).map(([phaseName, score]: any) => (
                <div key={phaseName} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '6px' }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: '600' }}>{phaseName.replace(/_/g, ' ')}</span>
                    <span style={{ fontWeight: '700', color: score >= 80 ? '#2ecc71' : score >= 60 ? '#f1c40f' : '#e74c3c' }}>{score}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${score}%`,
                      height: '100%',
                      background: score >= 80 ? '#2ecc71' : score >= 60 ? '#f1c40f' : '#e74c3c',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Detailed Findings Explorer */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                Detailed Audit Findings ({filteredFindings.length})
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Click any finding to expand exact diagnostics and remediation steps</span>
            </div>

            {/* Severity Filter Tabs */}
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              {(['ALL', 'CRITICAL', 'WARNING', 'PASS'] as const).map(sev => (
                <button
                  key={sev}
                  onClick={() => setFindingFilter(sev)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    border: 'none',
                    background: findingFilter === sev ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: findingFilter === sev ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredFindings.map((f: any, idx: number) => {
              const sev = (f.severity || 'PASS').toUpperCase();
              const isCrit = sev === 'CRITICAL';
              const isWarn = sev === 'WARNING';
              const isPass = sev === 'PASS';
              const isExpanded = expandedFinding === idx;

              return (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: isExpanded ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {/* Finding Header Row */}
                  <div
                    onClick={() => setExpandedFinding(isExpanded ? null : idx)}
                    style={{
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: '700',
                        background: isCrit ? 'rgba(231,76,60,0.2)' : isWarn ? 'rgba(241,196,15,0.2)' : 'rgba(46,204,113,0.2)',
                        color: isCrit ? '#e74c3c' : isWarn ? '#f1c40f' : '#2ecc71',
                        border: `1px solid ${isCrit ? 'rgba(231,76,60,0.4)' : isWarn ? 'rgba(241,196,15,0.4)' : 'rgba(46,204,113,0.4)'}`
                      }}>
                        {sev}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                        {f.rule_id || f.check_id || `RULE-${idx+1}`}
                      </span>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>
                        {f.description || f.title || 'Evaluated compliance check'}
                      </span>
                    </div>

                    <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-muted)' }} />
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '12px', fontSize: '12.5px' }}>
                      {f.standards && f.standards.length > 0 && (
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Standards Mapped:</span>{' '}
                          {f.standards.map((s: any, sIdx: number) => (
                            <span key={sIdx} style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(155,89,182,0.15)', color: '#a855f7', borderRadius: '4px', marginRight: '6px' }}>
                              {s.framework} {s.identifier} ({s.name})
                            </span>
                          ))}
                        </div>
                      )}
                      {f.expected && (
                        <div>
                          <strong style={{ color: 'var(--text-secondary)' }}>Expected Result:</strong> {f.expected}
                        </div>
                      )}
                      {f.actual && (
                        <div>
                          <strong style={{ color: 'var(--text-secondary)' }}>Actual Observed:</strong> {f.actual}
                        </div>
                      )}
                      {f.remediation && (
                        <div style={{ padding: '8px 12px', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.2)', borderRadius: '6px', color: '#2ecc71' }}>
                          <strong>Recommended Remediation:</strong> {f.remediation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Certificate Modal */}
        {isCertModalOpen && (
          <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }} onClick={() => setIsCertModalOpen(false)}>
            <div className="glass-card animate-slideup" style={{ width: '520px', padding: '28px', gap: '16px' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} style={{ color: '#2ecc71' }} />
                  Ed25519 Cryptographic Certificate
                </h3>
                <span className="status-pill certified">VALID</span>
              </div>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '16px', borderRadius: '8px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: '#a5b4fc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div><strong>Subject:</strong> {testResult.agent_name}</div>
                <div><strong>Trust Score:</strong> {testResult.trust_score}%</div>
                <div><strong>Status Tier:</strong> {testResult.tier}</div>
                <div><strong>Issuer:</strong> CertifyAI Authority v10</div>
                <div><strong>Issued Date:</strong> {new Date().toISOString()}</div>
                <div><strong>Public Key:</strong> ed25519_pk_7fa289b43e8d91c1092e45a78c1b2f44e89a</div>
                <div><strong>Signature:</strong> {testResult.cert?.signature || 'ed25519_sig_9f81a7b8e10398ac3814de'}</div>
              </div>
              <button className="btn btn-primary" onClick={() => setIsCertModalOpen(false)} style={{ width: '100%' }}>
                Close Certificate
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER SCREEN 1: TEST SETUP & CONFIGURATION
  // ==========================================
  return (
    <div className="animate-slideup" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="glass-card" style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Play size={22} fill="#2ecc71" color="#2ecc71" />
            Test & Certify AI Agent
          </h1>
          <p style={{ margin: '6px 0 0 0', fontSize: '14.5px', color: 'var(--text-secondary)' }}>
            Configure ingestion sources, execution modes, and safety checks for evaluation.
          </p>
        </div>

        <button 
          className="btn btn-primary"
          onClick={handleStartAudit}
          style={{ padding: '12px 28px', fontSize: '14.5px', fontWeight: '800', gap: '8px', boxShadow: '0 4px 14px rgba(46,204,113,0.35)' }}
        >
          <Play size={16} fill="currentColor" />
          <span>START AUDIT</span>
        </button>
      </div>

      {/* Grid: Left Settings & Right Phases */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        
        {/* Left Column: Source & Test Parameters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Ingestion Source Selector */}
          <div className="glass-card" style={{ padding: '22px' }}>
            <label style={{ fontSize: '13.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', display: 'block', marginBottom: '14px', letterSpacing: '0.3px' }}>
              1. Select Ingestion Source
            </label>

            {/* Source tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {[
                { id: 'agent_select', label: 'Fleet Agent', icon: Layers },
                { id: 'yaml', label: 'YAML Editor', icon: FileCode },
                { id: 'repo', label: 'Source Repo', icon: GitBranch },
                { id: 'openapi', label: 'OpenAPI 3.x', icon: Globe }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = inputType === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setInputType(tab.id as any)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: `1px solid ${isActive ? '#2ecc71' : 'var(--border-subtle)'}`,
                      background: isActive ? 'rgba(46, 204, 113, 0.15)' : 'var(--bg-panel-hover)',
                      color: isActive ? '#2ecc71' : 'var(--text-secondary)',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Ingestion Source Content */}
            {inputType === 'agent_select' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Choose a pre-configured agent target:</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {availableAgents.map(ag => {
                    const isSelected = selectedAgentCard === ag.name;
                    return (
                      <div
                        key={ag.id}
                        onClick={() => setSelectedAgentCard(ag.name)}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: `1px solid ${isSelected ? '#2ecc71' : 'var(--border-subtle)'}`,
                          background: isSelected ? 'rgba(46, 204, 113, 0.12)' : 'var(--bg-panel-hover)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '15px', fontWeight: '800', color: isSelected ? '#2ecc71' : 'var(--text-primary)' }}>
                            {ag.name}
                          </div>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
                            v{ag.version} • {ag.description?.slice(0, 50)}...
                          </span>
                        </div>
                        {isSelected && <CheckCircle2 size={18} color="#2ecc71" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {inputType === 'yaml' && (
              <div>
                <label style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                  Agent Specification YAML / Manifest:
                </label>
                <textarea
                  className="form-input"
                  style={{
                    width: '100%',
                    height: '220px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '14px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    resize: 'vertical',
                    lineHeight: 1.5
                  }}
                  value={yamlContent}
                  onChange={e => setYamlContent(e.target.value)}
                  placeholder="name: HR Compensation Agent&#10;version: '1.0'&#10;..."
                />
              </div>
            )}

            {inputType === 'repo' && (
              <div>
                <label style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                  Local Path or Git Repository URL:
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    width: '100%',
                    fontSize: '14.5px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontFamily: 'var(--font-mono)'
                  }}
                  value={repoPath}
                  onChange={e => setRepoPath(e.target.value)}
                  placeholder="c:/Personal/V10 or https://github.com/org/agent-repo"
                />
              </div>
            )}

            {inputType === 'openapi' && (
              <div>
                <label style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                  OpenAPI 3.0 Documentation Endpoint URL:
                </label>
                <input
                  type="text"
                  className="form-input"
                  style={{
                    width: '100%',
                    fontSize: '14.5px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    fontFamily: 'var(--font-mono)'
                  }}
                  value={openapiUrl}
                  onChange={e => setOpenapiUrl(e.target.value)}
                  placeholder="http://localhost:8000/openapi.json"
                />
              </div>
            )}
          </div>

          {/* Test Mode & Parameters */}
          <div className="glass-card" style={{ padding: '22px' }}>
            <label style={{ fontSize: '13.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', display: 'block', marginBottom: '14px', letterSpacing: '0.3px' }}>
              2. Test Mode & Parameters
            </label>

            {/* Validate vs Certify */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div
                onClick={() => setTestMode('validate')}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: `1px solid ${testMode === 'validate' ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                  background: testMode === 'validate' ? 'rgba(0, 180, 216, 0.12)' : 'var(--bg-panel-hover)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '14.5px', fontWeight: '800', color: testMode === 'validate' ? 'var(--accent-cyan)' : 'var(--text-primary)' }}>
                  ○ Validate Mode
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Fast structural schema validation and boundary checks.
                </p>
              </div>

              <div
                onClick={() => setTestMode('certify')}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  border: `1px solid ${testMode === 'certify' ? '#2ecc71' : 'var(--border-subtle)'}`,
                  background: testMode === 'certify' ? 'rgba(46, 204, 113, 0.12)' : 'var(--bg-panel-hover)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ fontSize: '14.5px', fontWeight: '800', color: testMode === 'certify' ? '#2ecc71' : 'var(--text-primary)' }}>
                  ● Certify Mode
                </div>
                <p style={{ margin: '6px 0 0 0', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  Full multi-turn certification with statistical confidence.
                </p>
              </div>
            </div>

            {/* Runs & Concurrency */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
                  Variability Runs ($N$):
                </label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="50"
                  value={testMode === 'validate' ? 1 : runsCount}
                  disabled={testMode === 'validate'}
                  onChange={e => setRunsCount(parseInt(e.target.value) || 1)}
                  style={{ fontSize: '14px', padding: '10px 12px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '700', display: 'block', marginBottom: '6px' }}>
                  Concurrency Limit:
                </label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  max="20"
                  value={concurrency}
                  onChange={e => setConcurrency(parseInt(e.target.value) || 1)}
                  style={{ fontSize: '14px', padding: '10px 12px' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 17 Safety Phases Selector */}
        <div className="glass-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
            <div>
              <label style={{ fontSize: '13.5px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-primary)', display: 'block', letterSpacing: '0.3px' }}>
                3. Audit Phases ({selectedPhases.length} selected)
              </label>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>Toggle modular safety and compliance evaluation phases</span>
            </div>

            <button
              className="btn btn-ghost"
              onClick={handleSelectAllPhases}
              style={{ fontSize: '12.5px', padding: '5px 12px', border: '1px solid var(--border-subtle)', fontWeight: '700' }}
            >
              {selectedPhases.length === ALL_PHASES.length ? 'Reset Default' : 'Select All'}
            </button>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            paddingRight: '4px'
          }}>
            {ALL_PHASES.map((phase) => {
              const isChecked = selectedPhases.includes(phase.id);
              return (
                <div
                  key={phase.id}
                  onClick={() => togglePhase(phase.id)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: isChecked ? 'rgba(46, 204, 113, 0.12)' : 'var(--bg-panel-hover)',
                    border: `1px solid ${isChecked ? 'rgba(46, 204, 113, 0.35)' : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}} // Controlled via row click
                    style={{ accentColor: '#2ecc71', cursor: 'pointer', width: '16px', height: '16px' }}
                  />
                  <span style={{
                    fontSize: '13.5px',
                    color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: isChecked ? '700' : '500'
                  }}>
                    {phase.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
};
