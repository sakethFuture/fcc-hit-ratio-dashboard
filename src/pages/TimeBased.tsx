import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDashboardStore } from '../store/useDashboardStore';
import {
  allTranches,
  bucketHitRatio,
  filterTranches,
  splitByTrancheGeneration,
  type BucketGranularity,
  type TimeBucketStat,
} from '../lib/aggregates';
import { StatusBadge } from '../components/StatusBadge';
import { InfoTip } from '../components/InfoTip';
import { MetricCard } from '../components/MetricCard';
import { COPY } from '../lib/copy';

const GRANULARITIES: { key: BucketGranularity; label: string }[] = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' },
];

function bandColor(pct: number, total: number): string {
  if (total === 0) return 'var(--baseline)';
  if (pct >= 50) return 'var(--status-good)';
  if (pct >= 30) return 'var(--status-warning)';
  return 'var(--status-critical)';
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

interface TooltipPayloadItem {
  payload: TimeBucketStat;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadItem[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  if (d.total === 0) {
    return (
      <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
        <div style={{ fontWeight: 700 }}>{d.bucket}</div>
        <div className="muted">No tranches entered</div>
      </div>
    );
  }
  return (
    <div style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.bucket}</div>
      <div>Hit ratio: {d.hitPct.toFixed(1)}%</div>
      <div className="muted">
        {d.hit} hit / {d.total} tranche{d.total === 1 ? '' : 's'}
      </div>
      <div className="muted">EV: {fmtPct(d.ev.evPct)}</div>
      <div className="muted" style={{ marginTop: 4, fontSize: 10.5 }}>Click for detail →</div>
    </div>
  );
}

export function TimeBased() {
  const ledger = useDashboardStore((s) => s.ledger);
  const filterMode = useDashboardStore((s) => s.trancheFilterMode);
  const [granularity, setGranularity] = useState<BucketGranularity>('monthly');
  const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

  const tranches = useMemo(
    () => filterTranches(allTranches(ledger), filterMode),
    [ledger, filterMode],
  );
  const buckets = useMemo(() => bucketHitRatio(tranches, granularity), [tranches, granularity]);
  const selected = buckets.find((b) => b.bucket === selectedBucket) ?? null;

  const selectBucket = (bucket: string) => {
    setSelectedBucket((prev) => (prev === bucket ? null : bucket));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        {GRANULARITIES.map((g) => (
          <button
            key={g.key}
            className={`chip${granularity === g.key ? ' chip-active' : ''}`}
            onClick={() => {
              setGranularity(g.key);
              setSelectedBucket(null);
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 'var(--space-4) var(--space-4) var(--space-2)', height: 340 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--gridline)" />
            <XAxis
              dataKey="bucket"
              tick={{ fill: 'var(--text-muted)', fontSize: 10.5 }}
              axisLine={{ stroke: 'var(--baseline)' }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={buckets.length > 40 ? 20 : 4}
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
            <Bar
              dataKey="hitPct"
              radius={[3, 3, 0, 0]}
              maxBarSize={44}
              onClick={(data: { payload?: TimeBucketStat }) =>
                data.payload && data.payload.total > 0 && selectBucket(data.payload.bucket)
              }
              style={{ cursor: 'pointer' }}
            >
              {buckets.map((b) => (
                <Cell
                  key={b.bucket}
                  fill={bandColor(b.hitPct, b.total)}
                  opacity={selectedBucket && selectedBucket !== b.bucket ? 0.4 : 1}
                  style={{ transition: 'opacity var(--transition-fast)' }}
                />
              ))}
              {buckets.length <= 60 && (
                <LabelList
                  dataKey="total"
                  position="top"
                  formatter={(v: unknown) => (v ? `n=${v}` : '')}
                  style={{ fill: 'var(--text-muted)', fontSize: 9.5 }}
                />
              )}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card table-scroll">
        <table>
          <thead>
            <tr>
              <th>Period</th>
              <th>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Tranches
                  <InfoTip text={COPY.tranche.tooltip} />
                </span>
              </th>
              <th>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  Hit
                  <InfoTip text={COPY.hit.tooltip} />
                </span>
              </th>
              <th>Hit Ratio</th>
              <th>EV</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr
                key={b.bucket}
                onClick={() => b.total > 0 && selectBucket(b.bucket)}
                style={{
                  cursor: b.total > 0 ? 'pointer' : 'default',
                  background: selectedBucket === b.bucket ? 'var(--surface-2)' : undefined,
                }}
              >
                <td style={{ fontWeight: selectedBucket === b.bucket ? 700 : 400 }}>{b.bucket}</td>
                <td className="mono">{b.total}</td>
                <td className="mono">{b.hit}</td>
                <td className="mono" style={{ color: bandColor(b.hitPct, b.total), fontWeight: 700 }}>
                  {b.total > 0 ? `${b.hitPct.toFixed(1)}%` : '—'}
                </td>
                <td
                  className="mono"
                  style={{ color: (b.ev.evPct ?? 0) >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
                >
                  {b.total > 0 ? fmtPct(b.ev.evPct) : '—'}
                </td>
              </tr>
            ))}
            {buckets.length === 0 && (
              <tr>
                <td colSpan={5} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                  No tranches yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="card" style={{ padding: 'var(--space-4)' }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--space-3)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              {selected.bucket} — {selected.total} tranche{selected.total === 1 ? '' : 's'}, {selected.hitPct.toFixed(1)}% hit
            </span>
            <button className="btn" onClick={() => setSelectedBucket(null)}>
              Close
            </button>
          </div>

          {(() => {
            const gen = splitByTrancheGeneration(selected.tranches);
            return (
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                <MetricCard
                  size="sm"
                  label={gen.first.label}
                  value={gen.first.stats.total > 0 ? `${gen.first.stats.hitPct.toFixed(0)}%` : '—'}
                  sub={`n=${gen.first.stats.total} · EV ${fmtPct(gen.first.ev.evPct)}`}
                  tone={gen.first.stats.total > 0 ? (gen.first.stats.hitPct >= 50 ? 'good' : gen.first.stats.hitPct >= 30 ? 'warning' : 'critical') : 'default'}
                />
                <MetricCard
                  size="sm"
                  label={gen.addOns.label}
                  value={gen.addOns.stats.total > 0 ? `${gen.addOns.stats.hitPct.toFixed(0)}%` : '—'}
                  sub={`n=${gen.addOns.stats.total} · EV ${fmtPct(gen.addOns.ev.evPct)}`}
                  tone={gen.addOns.stats.total > 0 ? (gen.addOns.stats.hitPct >= 50 ? 'good' : gen.addOns.stats.hitPct >= 30 ? 'warning' : 'critical') : 'default'}
                />
              </div>
            );
          })()}

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Scrip</th>
                  <th>Tranche</th>
                  <th>Entry Date</th>
                  <th>Entry Price</th>
                  <th>Peak Move</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...selected.tranches]
                  .sort((a, b) => (a.entryDate < b.entryDate ? -1 : 1))
                  .map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.scripSymbol}</td>
                      <td className="muted">{t.label}</td>
                      <td>{t.entryDate}</td>
                      <td className="mono">{t.entryPrice.toFixed(2)}</td>
                      <td
                        className="mono"
                        style={{ color: (t.peakMovePct ?? 0) >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
                      >
                        {fmtPct(t.peakMovePct)}
                      </td>
                      <td>
                        <StatusBadge tranche={t} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
