import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardStore } from '../store/useDashboardStore';
import { allTranches, bucketHitRatio, type BucketGranularity } from '../lib/aggregates';

const GRANULARITIES: { key: BucketGranularity; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' },
];

interface TooltipPayloadItem {
  payload: { bucket: string; total: number; hit: number; hitPct: number };
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.bucket}</div>
      <div>Hit ratio: {d.hitPct.toFixed(1)}%</div>
      <div className="muted">
        {d.hit} hit / {d.total} tranche{d.total === 1 ? '' : 's'}
      </div>
    </div>
  );
}

export function TimeBased() {
  const ledger = useDashboardStore((s) => s.ledger);
  const [granularity, setGranularity] = useState<BucketGranularity>('monthly');

  const tranches = useMemo(() => allTranches(ledger), [ledger]);
  const buckets = useMemo(() => bucketHitRatio(tranches, granularity), [tranches, granularity]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {GRANULARITIES.map((g) => (
          <button
            key={g.key}
            onClick={() => setGranularity(g.key)}
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              padding: '6px 12px',
              borderRadius: 5,
              border: `1px solid ${granularity === g.key ? 'var(--seq-400)' : 'var(--border)'}`,
              background: granularity === g.key ? 'var(--seq-700)' : 'transparent',
              color: granularity === g.key ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div
        style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '16px 16px 8px',
          height: 360,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis
              dataKey="bucket"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--baseline)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--baseline)' }}
              tickLine={false}
              width={40}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="hitPct" fill="var(--seq-400)" radius={[4, 4, 0, 0]} maxBarSize={48}>
              <LabelList
                dataKey="total"
                position="top"
                formatter={(v: unknown) => `n=${v ?? ''}`}
                style={{ fill: 'var(--text-muted)', fontSize: 10 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>Tranches</th>
              <th>Hit</th>
              <th>Hit Ratio</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.bucket}>
                <td>{b.bucket}</td>
                <td className="mono">{b.total}</td>
                <td className="mono">{b.hit}</td>
                <td className="mono">{b.hitPct.toFixed(1)}%</td>
              </tr>
            ))}
            {buckets.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                  No tranches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
