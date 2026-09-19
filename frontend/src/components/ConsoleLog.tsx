import React from 'react';
import { Terminal, Trash2, Copy, Check } from 'lucide-react';

interface ConsoleLogProps {
  terminalLines: string[];
  isRunningAudit: boolean;
  auditProgress: number;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
  onClear: () => void;
}

export const ConsoleLog: React.FC<ConsoleLogProps> = ({
  terminalLines,
  isRunningAudit,
  auditProgress,
  terminalEndRef,
  onClear,
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLogs = () => {
    const text = terminalLines.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="terminal-dots">
            <span className="terminal-dot red"></span>
            <span className="terminal-dot yellow"></span>
            <span className="terminal-dot green"></span>
          </div>
          <span className="terminal-title">Compliance Engine Sandbox Console</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {terminalLines.length > 0 && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleCopyLogs}
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: '11px', height: '28px', gap: '4px' }}
                title="Copy logs to clipboard"
              >
                {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={onClear}
                className="btn btn-ghost"
                style={{ padding: '4px 10px', fontSize: '11px', height: '28px', color: 'var(--color-critical)', gap: '4px' }}
                title="Clear console output"
              >
                <Trash2 size={12} /> Clear
              </button>
            </div>
          )}

          {isRunningAudit && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{auditProgress}%</span>
              <div style={{ width: '80px', backgroundColor: 'rgba(255,255,255,0.05)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: 'var(--accent-primary)', width: `${auditProgress}%`, height: '100%', transition: 'width 0.3s' }}></div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="terminal-body">
        {terminalLines.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 0' }}>
            <span style={{ color: 'var(--text-muted)' }}>$ ready to analyze target compliance...</span>
            <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>Select an ingestion source, declare your parameters, and trigger the Certification Audit to monitor real-time security test outcomes...</span>
          </div>
        ) : (
          terminalLines.map((line, idx) => {
            let color = '#c7d2fe';
            let prefix = '';
            
            if (line.includes('[critical]') || line.toLowerCase().includes('error')) {
              color = 'var(--color-critical)';
            } else if (line.includes('[success]') || line.toLowerCase().includes('success')) {
              color = 'var(--color-pass)';
            } else if (line.includes('[info]')) {
              color = 'var(--text-secondary)';
            } else if (line.startsWith('$ ')) {
              color = 'var(--accent-cyan)';
            }
            
            return (
              <div key={idx} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                {line}
              </div>
            );
          })
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
