import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/useDashboardStore';
import {
  allTranches,
  avgDaysToHit,
  avgTrancheSize,
  bestTranche,
  capitalDeployedSplit,
  computeEV,
  computeHitRatio,
  computePnl,
  currentStreak,
  filterTranches,
  perTrancheNumberHitRatio,
  topHits,
  worstDrawdownTranche,
  worstNotHits,
} from '../lib/aggregates';
import type { Tranche } from '../types';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { TranchePositionSection } from '../components/TranchePositionSection';
import { InfoTip } from '../components/InfoTip';
import { COPY } from '../lib/copy';

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function sectionTitle(text: string) {
  return (
    <h2
      style={{
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        marginBottom: 'var(--space-2)',
        fontWeight: 700,
      }}
    >
      {text}
    </h2>
  );
}

export function PortfolioStats() {
  const navigate = useNavigate();
  const ledger = useDashboardStore((s) => s.ledger);
  const filterMode = useDashboardStore((s) => s.trancheFilterMode);

  const tranches = useMemo(
    () => filterTranches(allTranches(ledger), filterMode),
    [ledger, filterMode],
  );

  const stats = useMemo(() => computeHitRatio(tranches), [tranches]);
  const ev = useMemo(() => computeEV(tranches), [tranches]);
  const pnl = useMemo(() => computePnl(tranches), [tranches]);
  const best5 = useMemo(() => topHits(tranches, 5), [tranches]);
  const worst5 = useMemo(() => worstNotHits(tranches, 5), [tranches]);
  const trancheBuckets = useMemo(() => perTrancheNumberHitRatio(tranches), [tranches]);

  const avgHit = useMemo(() => avgDaysToHit(tranches), [tranches]);
  const streak = useMemo(() => currentStreak(tranches), [tranches]);
  const capital = useMemo(() => capitalDeployedSplit(tranches), [tranches]);
  const avgSize = useMemo(() => avgTrancheSize(tranches), [tranches]);
  const best1 = useMemo(() => bestTranche(tranches), [tranches]);
  const worst1 = useMemo(() => worstDrawdownTranche(tranches), [tranches]);

  const goToScrip = (t: Tranche) => navigate(`/stocks?scrip=${encodeURIComponent(t.scripSymbol)}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <section>
        {sectionTitle('Portfolio Summary')}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <MetricCard
            label={
              <>
                Total Tranches
                <InfoTip text={COPY.tranche.tooltip} />
              </>
            }
            value={stats.total}
          />
          <MetricCard
            label={
              <>
                Hit
                <InfoTip text={COPY.hit.tooltip} />
              </>
            }
            value={stats.hit}
            tone="good"
          />
          <MetricCard label="Not Hit" value={stats.notHit} tone="critical" />
          <MetricCard
            label="Expected Value"
            value={fmtPct(ev.evPct)}
            sub={`n=${ev.n}`}
            tone={ev.evPct >= 0 ? 'good' : 'critical'}
          />
          <MetricCard
            label="Realized P&L"
            value={fmtMoney(pnl.realized)}
            tone={pnl.realized >= 0 ? 'good' : 'critical'}
          />
          <MetricCard
            label="Unrealized P&L"
            value={fmtMoney(pnl.unrealized)}
            tone={pnl.unrealized >= 0 ? 'good' : 'critical'}
          />
        </div>
      </section>

      <section>
        {sectionTitle('Additional Metrics')}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <MetricCard
            label="Avg Days to Hit"
            value={avgHit != null ? avgHit.toFixed(0) : '—'}
            sub={avgHit != null ? 'hit tranches only' : undefined}
          />
          <MetricCard
            label="Current Streak"
            value={streak.type ? `${streak.count}` : '—'}
            sub={streak.type ? (streak.type === 'hit' ? 'hit streak' : 'miss streak') : undefined}
            tone={streak.type === 'hit' ? 'good' : streak.type === 'miss' ? 'critical' : 'default'}
          />
          <MetricCard label="Avg Tranche Size" value={avgSize != null ? fmtMoney(avgSize) : '—'} />
          <MetricCard
            label="Capital Deployed — Hit, Running"
            value={fmtMoney(capital.hitStillRunning)}
            tone="good"
          />
          <MetricCard
            label="Capital Deployed — Not Hit, Open"
            value={fmtMoney(capital.notHitStillOpen)}
            tone="critical"
          />
          <MetricCard
            label="Best Tranche"
            value={best1 ? fmtPct(best1.peakMovePct) : '—'}
            sub={best1 ? `${best1.scripSymbol} · ${best1.label}` : undefined}
            tone="good"
            onClick={best1 ? () => goToScrip(best1) : undefined}
          />
          <MetricCard
            label="Worst Drawdown"
            value={worst1 ? fmtPct(worst1.troughMovePct) : '—'}
            sub={worst1 ? `${worst1.scripSymbol} · ${worst1.label}` : undefined}
            tone="critical"
            onClick={worst1 ? () => goToScrip(worst1) : undefined}
          />
        </div>
      </section>

      <section>
        {sectionTitle('Tranche-Position Hit Ratio')}
        <TranchePositionSection buckets={trancheBuckets} />
      </section>

      <section className="two-col-grid" style={{ display: 'grid', gap: 'var(--space-4)' }}>
        <RankedList title="Top 5 Hits" rows={best5} kind="hit" />
        <RankedList title="Top 5 Not-Hits (worst drawdown)" rows={worst5} kind="not_hit" />
      </section>
    </div>
  );
}

function RankedList({ title, rows, kind }: { title: string; rows: Tranche[]; kind: 'hit' | 'not_hit' }) {
  return (
    <div className="card" style={{ padding: 'var(--space-4)' }}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-secondary)',
          marginBottom: 'var(--space-2)',
        }}
      >
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="muted" style={{ fontSize: 12 }}>
          No tranches yet.
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Scrip</th>
                <th>Tranche</th>
                <th>Entry</th>
                <th>{kind === 'hit' ? 'Days to Hit' : 'Trough Move'}</th>
                <th>Peak Move</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.scripSymbol}</td>
                  <td className="muted">{t.label}</td>
                  <td>{t.entryDate}</td>
                  <td className="mono">{kind === 'hit' ? (t.daysToHit ?? '—') : fmtPct(t.troughMovePct)}</td>
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
      )}
    </div>
  );
}
