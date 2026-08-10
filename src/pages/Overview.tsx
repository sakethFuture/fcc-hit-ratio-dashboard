import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../store/useDashboardStore';
import { allTranches, computeEV, computeHitRatio, filterTranches } from '../lib/aggregates';
import { HitRatioMeter } from '../components/HitRatioMeter';
import { MetricCard } from '../components/MetricCard';
import { ActiveFolioTable } from '../components/ActiveFolioTable';
import { InfoTip } from '../components/InfoTip';
import { COPY } from '../lib/copy';

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

/** Home — kept deliberately tight: overall hit ratio (clickable → Time-based),
 * the EV headline, and current holdings. Everything else (breakdowns, deep
 * stats, top-5 lists) lives in Portfolio Stats so this stays fast to scan. */
export function Overview() {
  const navigate = useNavigate();
  const ledger = useDashboardStore((s) => s.ledger);
  const filterMode = useDashboardStore((s) => s.trancheFilterMode);

  const rawTranches = useMemo(() => allTranches(ledger), [ledger]);
  // Active Folio always reflects real current holdings — it isn't subject to
  // the Finished-trades-only toggle, which only narrows rollups/stats.
  const tranches = useMemo(
    () => filterTranches(rawTranches, filterMode),
    [rawTranches, filterMode],
  );
  const stats = useMemo(() => computeHitRatio(tranches), [tranches]);
  const ev = useMemo(() => computeEV(tranches), [tranches]);

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
              <InfoTip text={COPY.hit.tooltip} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
              {stats.hit} hit · {stats.notHit} not hit
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 'var(--space-4)' }}>
              Click the gauge for hit ratio over time →
            </div>
          </div>
        </div>

        <MetricCard
          size="lg"
          label={
            <>
              Expected Value
              <InfoTip text="Probability-weighted average outcome: hit-rate × average peak gain on hits, plus miss-rate × average result on misses (booked loss for closed tranches, current unrealized move for still-open ones)." />
            </>
          }
          value={fmtPct(ev.evPct)}
          sub={`n=${ev.n} · avg hit gain ${fmtPct(ev.avgHitGain)} · avg miss result ${fmtPct(ev.avgMissResult)}`}
          tone={ev.evPct >= 0 ? 'good' : 'critical'}
        />
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
        <ActiveFolioTable tranches={rawTranches} />
      </section>
    </div>
  );
}
