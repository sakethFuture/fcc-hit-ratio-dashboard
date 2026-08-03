import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
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

export function StatTile({ label, value, sub, tone = 'default' }: StatTileProps) {
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '16px 18px',
        minWidth: 150,
        flex: '1 1 150px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="mono"
        style={{ fontSize: 30, fontWeight: 700, color: toneColor[tone], lineHeight: 1 }}
      >
        {value}
      </div>
      {sub != null && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}
