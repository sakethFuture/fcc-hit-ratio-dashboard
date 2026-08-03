import type { HitStatus } from '../types';

const CONFIG: Record<HitStatus, { label: string; color: string; icon: string }> = {
  HIT: { label: 'Hit', color: 'var(--status-good)', icon: '✓' },
  HIT_RUNNING: { label: 'Hit — still running', color: 'var(--status-good)', icon: '▲' },
  NOT_HIT: { label: 'Not Hit', color: 'var(--status-critical)', icon: '✕' },
  ACTIVE: { label: 'Active', color: 'var(--status-warning)', icon: '●' },
};

export function StatusBadge({ status }: { status: HitStatus | null }) {
  if (!status) return <span className="muted">—</span>;
  const cfg = CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        fontSize: 11,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        color: cfg.color,
        border: `1px solid ${cfg.color}`,
        borderRadius: 999,
        padding: '2px 9px',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
