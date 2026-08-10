import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDashboardStore } from '../store/useDashboardStore';
import { computeEV, computeHitRatio, filterTranches } from '../lib/aggregates';
import type { Tranche } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { HitPatternSparkline } from '../components/HitPatternSparkline';
import { InfoTip } from '../components/InfoTip';
import { COPY } from '../lib/copy';

type SortMode = 'hitPct' | 'trancheCount' | 'recent';
type TrancheSortKey = 'trancheNumber' | 'entryDate' | 'peakMovePct' | 'daysToHit';

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function hitPctBand(pct: number): { color: string; bg: string } {
  if (pct >= 50) return { color: 'var(--status-good)', bg: 'var(--status-good-bg)' };
  if (pct >= 30) return { color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' };
  return { color: 'var(--status-critical)', bg: 'var(--status-critical-bg)' };
}

export function StockWise() {
  const ledger = useDashboardStore((s) => s.ledger);
  const filterMode = useDashboardStore((s) => s.trancheFilterMode);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [trancheSortKey, setTrancheSortKey] = useState<TrancheSortKey>('trancheNumber');
  const [trancheSortDir, setTrancheSortDir] = useState<1 | -1>(1);

  // Deep-link support: a best/worst-tranche card elsewhere can link here with
  // `?scrip=SYMBOL` to pre-filter and auto-expand the right row.
  useEffect(() => {
    const scrip = searchParams.get('scrip');
    if (!scrip) return;
    setFilter(scrip);
    setExpanded((prev) => new Set(prev).add(scrip));
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('scrip');
      return next;
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scripCards = useMemo(() => {
    if (!ledger) return [];
    const cards = ledger.scrips.map((s) => {
      const tranches = filterTranches(s.tranches, filterMode);
      const stats = computeHitRatio(tranches);
      const ev = computeEV(tranches);
      const mostRecent = tranches.reduce((max, t) => (t.entryDate > max ? t.entryDate : max), '');
      return { scrip: { ...s, tranches }, stats, ev, mostRecent };
    });

    const filtered = cards.filter(
      (c) =>
        c.scrip.tranches.length > 0 &&
        c.scrip.scripSymbol.toLowerCase().includes(filter.toLowerCase()),
    );

    filtered.sort((a, b) => {
      if (sortMode === 'hitPct') return b.stats.hitPct - a.stats.hitPct;
      if (sortMode === 'trancheCount') return b.scrip.tranches.length - a.scrip.tranches.length;
      return b.mostRecent.localeCompare(a.mostRecent);
    });

    return filtered;
  }, [ledger, filter, sortMode, filterMode]);

  const toggle = (sym: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  };

  const setTrancheSort = (key: TrancheSortKey) => {
    if (key === trancheSortKey) setTrancheSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setTrancheSortKey(key);
      setTrancheSortDir(1);
    }
  };

  const sortTranches = (tranches: Tranche[]): Tranche[] => {
    const copy = [...tranches];
    copy.sort((a, b) => {
      const av = a[trancheSortKey];
      const bv = b[trancheSortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') return av.localeCompare(bv) * trancheSortDir;
      return ((av as number) - (bv as number)) * trancheSortDir;
    });
    return copy;
  };

  const trancheTh = (key: TrancheSortKey, label: string) => (
    <th
      style={{ cursor: 'pointer', color: trancheSortKey === key ? 'var(--text-secondary)' : undefined }}
      onClick={() => setTrancheSort(key)}
    >
      {label}
      {trancheSortKey === key ? (trancheSortDir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
        <input
          placeholder="Filter by scrip…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 12,
            width: 220,
          }}
        />
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 12,
          }}
        >
          <option value="recent">Sort: Most recent activity</option>
          <option value="hitPct">Sort: Hit ratio</option>
          <option value="trancheCount">Sort: Most tranches</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{scripCards.length} scrips</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {scripCards.map(({ scrip, stats, ev }, idx) => {
          const isOpen = expanded.has(scrip.scripSymbol);
          return (
            <div key={scrip.scripSymbol} className="card clickable" style={{ overflow: 'hidden' }}>
              <div
                onClick={() => toggle(scrip.scripSymbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)',
                  gap: 'var(--space-4)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minWidth: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 10 }}>
                    {isOpen ? '▾' : '▸'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.01em' }}>
                    {scrip.scripSymbol}
                  </span>
                  <span className="muted" style={{ fontSize: 10.5 }}>
                    {scrip.exchange}
                  </span>
                  <HitPatternSparkline tranches={scrip.tranches} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexShrink: 0 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                    {scrip.tranches.length} tranche{scrip.tranches.length === 1 ? '' : 's'}
                    {idx === 0 && <InfoTip text={COPY.tranche.tooltip} />}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: (ev.evPct ?? 0) >= 0 ? 'var(--status-good)' : 'var(--status-critical)',
                    }}
                    title="Expected value for this scrip"
                  >
                    EV {fmtPct(ev.evPct)}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: hitPctBand(stats.hitPct).color,
                      background: hitPctBand(stats.hitPct).bg,
                      border: `1px solid ${hitPctBand(stats.hitPct).color}`,
                      borderRadius: 999,
                      padding: 'var(--space-1) var(--space-3)',
                      minWidth: 76,
                      textAlign: 'center',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {stats.hitPct.toFixed(0)}% HIT
                    {idx === 0 && <InfoTip text={COPY.hit.tooltip} />}
                  </span>
                </div>
              </div>

              {isOpen && (
                <div className="table-scroll" style={{ borderTop: '1px solid var(--border)' }}>
                  <table>
                    <thead>
                      <tr>
                        {trancheTh('trancheNumber', 'Tranche #')}
                        {trancheTh('entryDate', 'Entry Date')}
                        <th>Entry Price</th>
                        <th>Entry Qty</th>
                        <th>Exit</th>
                        {trancheTh('peakMovePct', 'Peak Move')}
                        {trancheTh('daysToHit', 'Days to Hit')}
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortTranches(scrip.tranches).map((t) => (
                        <tr key={t.id}>
                          <td className="muted">{t.trancheNumber}</td>
                          <td>{t.entryDate}</td>
                          <td className="mono">
                            {t.entryPrice.toFixed(2)}
                            {t.splitAdjustFactor != null && t.splitAdjustFactor !== 1 && (
                              <span
                                title={`Split-adjusted ${t.splitAdjustFactor}x for hit comparison`}
                                style={{ color: 'var(--status-warning)', marginLeft: 4, fontSize: 10 }}
                              >
                                ⓢ
                              </span>
                            )}
                          </td>
                          <td className="mono">{t.entryQty}</td>
                          <td className="mono">
                            {t.exitEvents.length === 0
                              ? '—'
                              : t.exitEvents.map((e) => `${e.date} @ ${e.price.toFixed(2)}`).join(', ')}
                          </td>
                          <td
                            className="mono"
                            style={{ color: (t.peakMovePct ?? 0) >= 0 ? 'var(--status-good)' : 'var(--status-critical)' }}
                          >
                            {fmtPct(t.peakMovePct)}
                          </td>
                          <td className="mono">{t.daysToHit ?? '—'}</td>
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
        })}
      </div>
    </div>
  );
}
