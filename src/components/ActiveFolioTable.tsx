import { useMemo, useState } from 'react';
import type { Tranche } from '../types';
import { StatusBadge } from './StatusBadge';

type SortKey = 'scripSymbol' | 'entryDate' | 'currentMovePct' | 'pctStillNeeded' | 'daysHeld';

function fmtPct(n: number | null): string {
  if (n == null) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function ActiveFolioTable({ tranches }: { tranches: Tranche[] }) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('pctStillNeeded');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const openPositions = useMemo(() => tranches.filter((t) => t.remainingQty > 0), [tranches]);

  const filtered = useMemo(
    () => openPositions.filter((t) => t.scripSymbol.toLowerCase().includes(filter.toLowerCase())),
    [openPositions, filter],
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * sortDir;
      }
      return ((av as number) - (bv as number)) * sortDir;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const setSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    else {
      setSortKey(key);
      setSortDir(1);
    }
  };

  const th = (key: SortKey, label: string) => (
    <th
      style={{ cursor: 'pointer', color: sortKey === key ? 'var(--text-secondary)' : undefined }}
      onClick={() => setSort(key)}
    >
      {label}
      {sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div className="card">
      <div
        style={{
          padding: 'var(--space-2) var(--space-4)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <input
          placeholder="Filter by scrip…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: 'var(--space-2) var(--space-3)',
            fontSize: 12,
            width: 220,
          }}
        />
        <span style={{ marginLeft: 'var(--space-3)', fontSize: 11.5, color: 'var(--text-muted)' }}>
          {sorted.length} open position{sorted.length === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ maxHeight: 480, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              {th('scripSymbol', 'Scrip')}
              <th>Tranche</th>
              {th('entryDate', 'Entry Date')}
              <th>Entry Price</th>
              <th>LTP</th>
              {th('currentMovePct', 'Move')}
              {th('pctStillNeeded', '% Needed')}
              {th('daysHeld', 'Days Held')}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 600 }}>{t.scripSymbol}</td>
                <td className="muted">{t.label}</td>
                <td>{t.entryDate}</td>
                <td className="mono">{t.entryPrice.toFixed(2)}</td>
                <td className="mono">{t.currentLtp?.toFixed(2) ?? '—'}</td>
                <td
                  className="mono"
                  style={{
                    color:
                      (t.currentMovePct ?? 0) >= 0 ? 'var(--status-good)' : 'var(--status-critical)',
                  }}
                >
                  {fmtPct(t.currentMovePct)}
                </td>
                <td className="mono">{fmtPct(t.pctStillNeeded)}</td>
                <td className="mono">{t.daysHeld ?? '—'}</td>
                <td>
                  <StatusBadge tranche={t} />
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="muted" style={{ textAlign: 'center', padding: 20 }}>
                  No open tranches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
