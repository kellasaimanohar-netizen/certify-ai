import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface TelemetryHistoryChartProps {
  data: Array<{
    run: number;
    cost: number;
    drift: number;
    violations: number;
  }>;
}

export const TelemetryHistoryChart: React.FC<TelemetryHistoryChartProps> = ({ data }) => {
  return (
    <div style={{ width: '100%', height: 180, marginTop: '12px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.05)" vertical={false} />
          <XAxis dataKey="run" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
          <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              fontSize: '11px',
              color: '#fff'
            }}
          />
          <Line type="monotone" dataKey="cost" name="Cost ($)" stroke="var(--accent-cyan)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          <Line type="monotone" dataKey="drift" name="Drifts" stroke="var(--color-warning)" strokeWidth={1.5} dot={false} />
          <Line type="monotone" dataKey="violations" name="Blocked" stroke="var(--color-critical)" strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
