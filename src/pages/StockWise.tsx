import { useMemo, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { computeHitRatio } from '../lib/aggregates';
import { StatusBadge } from '../components/StatusBadge';

type SortMode = 'hitPct' | 'trancheCount' | 'recent';

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function StockWise() {
  const ledger = useDashboardStore((s) => s.ledger);
  const [filter, setFilter] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const scripCards = useMemo(() => {
    if (!ledger) return [];
    const cards = ledger.scrips.map((s) => {
      const stats = computeHitRatio(s.tranches, true);
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
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <input
          placeholder="Filter by scrip…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 5,
            padding: '7px 10px',
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
            borderRadius: 5,
            padding: '7px 10px',
            fontSize: 12,
          }}
        >
          <option value="recent">Sort: Most recent activity</option>
          <option value="hitPct">Sort: Hit ratio</option>
          <option value="trancheCount">Sort: Most tranches</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{scripCards.length} scrips</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {scripCards.map(({ scrip, stats }) => {
          const isOpen = expanded.has(scrip.scripSymbol);
          return (
            <div
              key={scrip.scripSymbol}
              style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 8 }}
            >
              <div
                onClick={() => toggle(scrip.scripSymbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{isOpen ? '▾' : '▸'}</span>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{scrip.scripSymbol}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{scrip.exchange}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {scrip.tranches.length} tranche{scrip.tranches.length === 1 ? '' : 's'}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: stats.hitPct >= 50 ? 'var(--status-good)' : 'var(--status-critical)',
                    }}
                  >
                    {stats.hitPct.toFixed(0)}% hit
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
                          <td>{t.label}</td>
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
                          <td className="mono">{fmtPct(t.peakMovePct)}</td>
                          <td className="mono">{t.daysToHit ?? '—'}</td>
                          <td>
                            <StatusBadge status={t.hitStatus} />
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
