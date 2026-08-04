import type { Tranche } from '../types';
import { isHit } from '../lib/aggregates';

const HIT_CFG = { color: 'var(--status-good)', bg: 'var(--status-good-bg)', icon: '✓', label: 'Hit' };
const NOT_HIT_CFG = { color: 'var(--status-critical)', bg: 'var(--status-critical-bg)', icon: '✕', label: 'Not Hit' };

/**
 * The only status a tranche ever shows is binary: Hit or Not Hit — whether the
 * price ever closed at +15% above entry, full stop. Whether shares are still
 * held doesn't change the tag; it only adds secondary context next to it:
 *   Hit + still open      → "Hit" (green) + "still running"
 *   Not Hit + still open  → "Not Hit" (red) + "{days}d held · {pct}% to go"
 *   Not Hit + closed      → "Not Hit" (red) + "closed, never hit"
 */
export function StatusBadge({ tranche }: { tranche: Tranche }) {
  if (!tranche.hitStatus) return <span className="muted">—</span>;

  const hit = isHit(tranche);
  const cfg = hit ? HIT_CFG : NOT_HIT_CFG;
  const stillOpen = tranche.remainingQty > 0;

  let secondary: string | null = null;
  if (hit && stillOpen) {
    secondary = 'still running';
  } else if (!hit && stillOpen) {
    const days = tranche.daysHeld != null ? `${tranche.daysHeld}d held` : null;
    const pct = tranche.pctStillNeeded != null ? `${tranche.pctStillNeeded.toFixed(1)}% to go` : null;
    secondary = [days, pct].filter(Boolean).join(' · ') || null;
  } else if (!hit && !stillOpen) {
    secondary = 'closed, never hit';
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          color: cfg.color,
          background: cfg.bg,
          border: `1px solid ${cfg.color}`,
          borderRadius: 999,
          padding: '3px 10px',
          whiteSpace: 'nowrap',
          boxShadow: hit ? 'var(--glow-good)' : 'var(--glow-critical)',
        }}
      >
        <span aria-hidden>{cfg.icon}</span>
        {cfg.label}
      </span>
      {secondary && (
        <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {secondary}
        </span>
      )}
    </span>
  );
}
