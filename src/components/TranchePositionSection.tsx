import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TrancheNumberStat } from '../lib/aggregates';
import { MetricCard } from './MetricCard';

function bandColor(pct: number, total: number): string {
  if (total === 0) return 'var(--baseline)';
  if (pct >= 50) return 'var(--status-good)';
  if (pct >= 30) return 'var(--status-warning)';
  return 'var(--status-critical)';
}

function bandTone(pct: number, total: number): 'default' | 'good' | 'warning' | 'critical' {
  if (total === 0) return 'default';
  if (pct >= 50) return 'good';
  if (pct >= 30) return 'warning';
  return 'critical';
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrancheNumberStat }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.label}</div>
      <div>Hit ratio: {d.stats.hitPct.toFixed(1)}%</div>
      <div className="muted">
        {d.stats.hit} hit / {d.stats.total} tranche{d.stats.total === 1 ? '' : 's'}
      </div>
      <div className="muted" style={{ marginTop: 4 }}>EV: {fmtPct(d.ev.evPct)}</div>
    </div>
  );
}

function takeawayFor(buckets: TrancheNumberStat[]): string {
  const withData = buckets.filter((b) => b.stats.total > 0);
  if (withData.length < 2) return 'Not enough tranche-position data yet for a comparison.';

  const best = withData.reduce((a, b) => (b.stats.hitPct > a.stats.hitPct ? b : a));
  const worst = withData.reduce((a, b) => (b.stats.hitPct < a.stats.hitPct ? b : a));
  if (best.trancheNumber === worst.trancheNumber) {
    return `${best.label} hits ${best.stats.hitPct.toFixed(0)}% of the time — every position bucket is running about even.`;
  }
  return `${best.label} hits ${best.stats.hitPct.toFixed(0)}% of the time vs ${worst.label} at ${worst.stats.hitPct.toFixed(0)}% — the biggest gap in the portfolio by entry sequence.`;
}

/** Score cards → bar chart → exact table → one-line takeaway, all driven by
 * the same `TrancheNumberStat[]` from `perTrancheNumberHitRatio`. */
export function TranchePositionSection({ buckets }: { buckets: TrancheNumberStat[] }) {
  if (buckets.length === 0) {
    return <div className="muted" style={{ fontSize: 12 }}>No tranches yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        {buckets.map((b) => (
          <MetricCard
            key={b.trancheNumber}
            size="sm"
            label={b.label}
            value={b.stats.total > 0 ? `${b.stats.hitPct.toFixed(0)}%` : '—'}
            sub={`n=${b.stats.total}`}
            tone={bandTone(b.stats.hitPct, b.stats.total)}
          />
        ))}
      </div>

      <div className="card" style={{ padding: 'var(--space-4) var(--space-4) var(--space-2)', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
              axisLine={{ stroke: 'var(--baseline)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              axisLine={{ stroke: 'var(--baseline)' }}
              tickLine={false}
              width={38}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="stats.hitPct" radius={[3, 3, 0, 0]} maxBarSize={56}>
              {buckets.map((b) => (
                <Cell key={b.trancheNumber} fill={bandColor(b.stats.hitPct, b.stats.total)} />
              ))}
              <LabelList
                dataKey="stats.total"
                position="top"
                formatter={(v: unknown) => (v ? `n=${v}` : '')}
                style={{ fill: 'var(--text-muted)', fontSize: 9.5 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Tranche</th>
              <th>Total</th>
              <th>Hit</th>
              <th>Hit Ratio</th>
              <th>EV</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.trancheNumber}>
                <td style={{ fontWeight: 600 }}>{b.label}</td>
                <td className="mono">{b.stats.total}</td>
                <td className="mono">{b.stats.hit}</td>
                <td className="mono" style={{ color: bandColor(b.stats.hitPct, b.stats.total), fontWeight: 700 }}>
                  {b.stats.total > 0 ? `${b.stats.hitPct.toFixed(1)}%` : '—'}
                </td>
                <td
                  className="mono"
                  style={{ color: (b.ev.evPct ?? 0) >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
                >
                  {b.stats.total > 0 ? fmtPct(b.ev.evPct) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="muted" style={{ fontSize: 12 }}>{takeawayFor(buckets)}</div>
    </div>
  );
}
