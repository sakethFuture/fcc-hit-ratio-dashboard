import type { ReactNode } from 'react';

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'good' | 'critical' | 'warning';
  size?: 'default' | 'lg' | 'sm';
  onClick?: () => void;
}

const toneColor: Record<NonNullable<MetricCardProps['tone']>, string> = {
  default: 'var(--text-primary)',
  good: 'var(--status-good)',
  critical: 'var(--status-critical)',
  warning: 'var(--status-warning)',
};

const toneRing: Record<NonNullable<MetricCardProps['tone']>, string> = {
  default: 'none',
  good: 'var(--ring-good)',
  critical: 'var(--ring-critical)',
  warning: 'none',
};

const valueFontSize: Record<NonNullable<MetricCardProps['size']>, number> = {
  sm: 22,
  default: 32,
  lg: 40,
};

/**
 * The one reusable "big bold number + label + count" pattern — hit ratio,
 * EV, tranche-position scores, and every other headline stat in the app
 * should render through this rather than a bespoke div per section.
 */
export function MetricCard({ label, value, sub, tone = 'default', size = 'default', onClick }: MetricCardProps) {
  return (
    <div
      className={onClick ? 'card clickable' : 'card'}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        padding: size === 'sm' ? '12px 14px' : '14px 18px',
        minWidth: size === 'sm' ? 108 : 150,
        flex: `1 1 ${size === 'sm' ? 108 : 150}px`,
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
          fontSize: valueFontSize[size],
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
