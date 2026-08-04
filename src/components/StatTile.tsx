import type { ReactNode } from 'react';

interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'good' | 'critical' | 'warning';
}

const toneColor: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'var(--text-primary)',
  good: 'var(--status-good)',
  critical: 'var(--status-critical)',
  warning: 'var(--status-warning)',
};

const toneRing: Record<NonNullable<StatTileProps['tone']>, string> = {
  default: 'none',
  good: 'var(--ring-good)',
  critical: 'var(--ring-critical)',
  warning: 'none',
};

export function StatTile({ label, value, sub, tone = 'default' }: StatTileProps) {
  return (
    <div
      className="card"
      style={{
        padding: '14px 18px',
        minWidth: 150,
        flex: '1 1 150px',
        boxShadow: `var(--shadow-card), ${toneRing[tone]}`,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: 'var(--text-muted)',
          marginBottom: 8,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: toneColor[tone],
          lineHeight: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </div>
      {sub != null && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}
