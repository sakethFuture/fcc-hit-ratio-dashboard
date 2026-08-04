import { useMemo, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { computeHitRatio } from '../lib/aggregates';
import { StatusBadge } from '../components/StatusBadge';
import { HitPatternSparkline } from '../components/HitPatternSparkline';
import { InfoTip } from '../components/InfoTip';

type SortMode = 'hitPct' | 'trancheCount' | 'recent';

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
  const [filter, setFilter] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const scripCards = useMemo(() => {
    if (!ledger) return [];
    const cards = ledger.scrips.map((s) => {
      const stats = computeHitRatio(s.tranches);
      const mostRecent = s.tranches.reduce((max, t) => (t.entryDate > max ? t.entryDate : max), '');
      return { scrip: s, stats, mostRecent };
    });

    const filtered = cards.filter((c) =>
      c.scrip.scripSymbol.toLowerCase().includes(filter.toLowerCase()),
    );

    filtered.sort((a, b) => {
      if (sortMode === 'hitPct') return b.stats.hitPct - a.stats.hitPct;
      if (sortMode === 'trancheCount') return b.scrip.tranches.length - a.scrip.tranches.length;
      return b.mostRecent.localeCompare(a.mostRecent);
    });

    return filtered;
  }, [ledger, filter, sortMode]);

  const toggle = (sym: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  };

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
        {scripCards.map(({ scrip, stats }, idx) => {
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
                    {idx === 0 && (
                      <InfoTip text="A tranche is one buy — every time you add to a position, even without selling first, it's tracked as its own separate trade with its own entry date." />
                    )}
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
                    }}
                  >
                    {stats.hitPct.toFixed(0)}% HIT
                  </span>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Tranche</th>
                        <th>Entry Date</th>
                        <th>Entry Price</th>
                        <th>Entry Qty</th>
                        <th>Exit</th>
                        <th>Peak Move</th>
                        <th>Days to Hit</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scrip.tranches.map((t) => (
                        <tr key={t.id}>
                          <td className="muted">{t.label}</td>
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
