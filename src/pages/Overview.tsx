import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/useDashboardStore';
import { allTranches, computeHitRatio, computePnl, topHits, worstNotHits } from '../lib/aggregates';
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

  const tranches = useMemo(() => allTranches(ledger), [ledger]);
  const stats = useMemo(() => computeHitRatio(tranches), [tranches]);
  const pnl = useMemo(() => computePnl(tranches), [tranches]);
  const best = useMemo(() => topHits(tranches, 5), [tranches]);
  const worst = useMemo(() => worstNotHits(tranches, 5), [tranches]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <section style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'stretch', flexWrap: 'wrap' }}>
        <div
          className="card"
          style={{
            padding: 'var(--space-5) var(--space-6)',
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
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
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              Hit Ratio
              <InfoTip text="Hit means the stock's closing price reached at least 15% above what we paid, at any point since we entered — whether or not we actually sold at that point. A tranche is either Hit or Not Hit; there's no in-between bucket." />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
              {stats.hit} hit · {stats.notHit} not hit
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>
              Click the gauge for hit ratio over time →
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', flex: 1 }}>
          <StatTile
            label={
              <>
                Total Tranches
                <InfoTip text="A tranche is one buy — every time you add to a position, even without selling first, it's tracked as its own separate trade with its own entry date." />
              </>
            }
            value={stats.total}
          />
          <StatTile label="Hit" value={stats.hit} tone="good" />
          <StatTile label="Not Hit" value={stats.notHit} tone="critical" />
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

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <RankedList title="Top 5 Hits" rows={best} kind="hit" />
        <RankedList title="Top 5 Not-Hits (worst drawdown)" rows={worst} kind="not_hit" />
      </section>

      <section>
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
          Active Folio
        </h2>
        <ActiveFolioTable tranches={tranches} />
      </section>
    </div>
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
                  <StatusBadge tranche={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
