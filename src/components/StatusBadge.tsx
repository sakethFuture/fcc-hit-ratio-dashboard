import type { HitStatus } from '../types';

const CONFIG: Record<HitStatus, { label: string; color: string; bg: string; icon: string }> = {
  HIT: { label: 'Hit', color: 'var(--status-good)', bg: 'rgba(12, 163, 12, 0.12)', icon: '✓' },
  HIT_RUNNING: {
    label: 'Hit — still running',
    color: 'var(--status-good)',
    bg: 'rgba(12, 163, 12, 0.12)',
    icon: '▲',
  },
  NOT_HIT: {
    label: 'Not Hit',
    color: 'var(--status-critical)',
    bg: 'rgba(208, 59, 59, 0.12)',
    icon: '✕',
  },
  ACTIVE: {
    label: 'Active',
    color: 'var(--status-warning)',
    bg: 'rgba(250, 178, 25, 0.12)',
    icon: '●',
  },
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
        fontSize: 10.5,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        color: cfg.color,
        background: cfg.bg,
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
