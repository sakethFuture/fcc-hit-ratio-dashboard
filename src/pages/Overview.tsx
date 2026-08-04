import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { InfoTip } from '../components/InfoTip';

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
  const navigate = useNavigate();
  const ledger = useDashboardStore((s) => s.ledger);
  const [closedOnly, setClosedOnly] = useState(true);

  const tranches = useMemo(() => allTranches(ledger), [ledger]);
  const stats = useMemo(() => computeHitRatio(tranches, closedOnly), [tranches, closedOnly]);
  const allTimeStats = useMemo(() => computeHitRatio(tranches, false), [tranches]);
  const pnl = useMemo(() => computePnl(tranches), [tranches]);
  const best = useMemo(() => topHits(tranches, 5), [tranches]);
  const worst = useMemo(() => worstNotHits(tranches, 5), [tranches]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section style={{ display: 'flex', gap: 18, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div
          className="card"
          style={{
            padding: '16px 22px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <HitRatioMeter
            pct={stats.hitPct}
            hitCount={stats.hit}
            totalCount={stats.total}
            label="tranches"
            onClick={() => navigate('/time')}
          />
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <ToggleButton active={closedOnly} onClick={() => setClosedOnly(true)}>
                Finished trades only
                <InfoTip text="Only counts tranches you've fully exited. Still-open positions aren't included yet since we don't know how they'll turn out." />
              </ToggleButton>
              <ToggleButton active={!closedOnly} onClick={() => setClosedOnly(false)}>
                Every trade
                <InfoTip text="Counts every tranche ever entered, including ones still open right now." />
              </ToggleButton>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              Every trade: <span className="mono" style={{ color: 'var(--text-secondary)' }}>{allTimeStats.hitPct.toFixed(1)}%</span>
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 8 }}>
              Click the gauge for hit ratio over time →
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: 1 }}>
          <StatTile
            label={
              <>
                Total Tranches
                <InfoTip text="A tranche is one buy — every time you add to a position, even without selling first, it's tracked as its own separate trade with its own entry date." />
              </>
            }
            value={allTimeStats.total}
          />
          <StatTile
            label={
              <>
                Hit
                <InfoTip text="Hit means the stock's closing price reached at least 15% above what we paid, at any point since we entered — whether or not we actually sold at that point." />
              </>
            }
            value={allTimeStats.hit}
            tone="good"
          />
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

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <RankedList title="Top 5 Hits" rows={best} kind="hit" />
        <RankedList title="Top 5 Not-Hits (worst drawdown)" rows={worst} kind="not_hit" />
      </section>

      <section>
        <h2
          style={{
            fontSize: 13,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-secondary)',
            marginBottom: 8,
            fontWeight: 700,
          }}
        >
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
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        padding: '6px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? 'var(--seq-400)' : 'var(--border)'}`,
        background: active ? 'var(--seq-700)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), border-color var(--transition-fast)',
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
    <div className="card" style={{ padding: 14 }}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--text-secondary)',
          marginBottom: 8,
        }}
      >
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
                <td style={{ fontWeight: 600 }}>{t.scripSymbol}</td>
                <td className="muted">{t.label}</td>
                <td>{t.entryDate}</td>
                <td className="mono">
                  {kind === 'hit' ? t.daysToHit ?? '—' : fmtPct(t.troughMovePct)}
                </td>
                <td
                  className="mono"
                  style={{ color: (t.peakMovePct ?? 0) >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
                >
                  {fmtPct(t.peakMovePct)}
                </td>
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
