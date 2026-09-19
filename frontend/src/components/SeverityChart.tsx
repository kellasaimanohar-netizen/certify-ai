import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

interface SeverityChartProps {
  distribution: {
    critical: number;
    warning: number;
    pass: number;
    info: number;
  };
}

export const SeverityChart: React.FC<SeverityChartProps> = ({ distribution }) => {
  const data = [
    { name: 'Critical', value: distribution.critical, color: '#ef4444' },
    { name: 'Warning', value: distribution.warning, color: '#f59e0b' },
    { name: 'Pass', value: distribution.pass, color: '#10b981' },
    { name: 'Info', value: distribution.info, color: '#06b6d4' },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid var(--border-subtle)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>{payload[0].name}</p>
          <p style={{ margin: 0, color: payload[0].payload.color }}>
            Checks: <span style={{ fontWeight: 'bold' }}>{payload[0].value}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: 130, marginTop: '8px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" stroke="var(--text-secondary)" fontSize={10} width={60} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.02)' }} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={10}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
