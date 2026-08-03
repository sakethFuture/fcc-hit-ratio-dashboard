import { useMemo, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import {
  allTranches,
  computeHitRatio,
  computePnl,
  topHits,
  worstNotHits,
} from '../lib/aggregates';
import { StatTile } from '../components/StatTile';
import { HitRatioMeter } from '../components/HitRatioMeter';
import { StatusBadge } from '../components/StatusBadge';
import { ActiveFolioTable } from '../components/ActiveFolioTable';

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function Overview() {
  const ledger = useDashboardStore((s) => s.ledger);
  const [closedOnly, setClosedOnly] = useState(true);

  const tranches = useMemo(() => allTranches(ledger), [ledger]);
  const stats = useMemo(() => computeHitRatio(tranches, closedOnly), [tranches, closedOnly]);
  const allTimeStats = useMemo(() => computeHitRatio(tranches, false), [tranches]);
  const pnl = useMemo(() => computePnl(tranches), [tranches]);
  const best = useMemo(() => topHits(tranches, 5), [tranches]);
  const worst = useMemo(() => worstNotHits(tranches, 5), [tranches]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <section style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '20px 28px',
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <HitRatioMeter
            pct={stats.hitPct}
            hitCount={stats.hit}
            totalCount={stats.total}
            label="tranches"
          />
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <ToggleButton active={closedOnly} onClick={() => setClosedOnly(true)}>
                Closed only
              </ToggleButton>
              <ToggleButton active={!closedOnly} onClick={() => setClosedOnly(false)}>
                All tranches
              </ToggleButton>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Hit ratio (all tranches): {allTimeStats.hitPct.toFixed(1)}%
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flex: 1 }}>
          <StatTile label="Total Tranches" value={allTimeStats.total} />
          <StatTile label="Hit" value={allTimeStats.hit} tone="good" />
          <StatTile label="Not Hit" value={allTimeStats.notHit} tone="critical" />
          <StatTile label="Active / Pending" value={allTimeStats.active} tone="warning" />
          <StatTile
            label="Realized P&L"
            value={fmtMoney(pnl.realized)}
            tone={pnl.realized >= 0 ? 'good' : 'critical'}
          />
          <StatTile
            label="Unrealized P&L"
            value={fmtMoney(pnl.unrealized)}
            tone={pnl.unrealized >= 0 ? 'good' : 'critical'}
          />
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <RankedList title="Top 5 Hits" rows={best} kind="hit" />
        <RankedList title="Top 5 Not-Hits (worst drawdown)" rows={worst} kind="not_hit" />
      </section>

      <section>
        <h2 style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', marginBottom: 10 }}>
          Active Folio
        </h2>
        <ActiveFolioTable tranches={tranches} />
      </section>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        padding: '5px 10px',
        borderRadius: 5,
        border: `1px solid ${active ? 'var(--seq-400)' : 'var(--border)'}`,
        background: active ? 'var(--seq-700)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function RankedList({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: ReturnType<typeof topHits>;
  kind: 'hit' | 'not_hit';
}) {
  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div className="muted" style={{ fontSize: 12 }}>
          No tranches yet.
        </div>
      ) : (
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
                <td>{t.scripSymbol}</td>
                <td>{t.label}</td>
                <td>{t.entryDate}</td>
                <td className="mono">
                  {kind === 'hit' ? t.daysToHit ?? '—' : fmtPct(t.troughMovePct)}
                </td>
                <td className="mono">{fmtPct(t.peakMovePct)}</td>
                <td>
                  <StatusBadge status={t.hitStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
