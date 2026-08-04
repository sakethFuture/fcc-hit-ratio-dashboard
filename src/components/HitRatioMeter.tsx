interface HitRatioMeterProps {
  pct: number; // 0-100
  hitCount: number;
  totalCount: number;
  label: string;
  onClick?: () => void;
}

const SIZE = 220;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const CIRC = Math.PI * R; // semicircle length

function bandColor(pct: number): string {
  if (pct >= 50) return 'var(--status-good)';
  if (pct >= 30) return 'var(--status-warning)';
  return 'var(--status-critical)';
}

export function HitRatioMeter({ pct, hitCount, totalCount, label, onClick }: HitRatioMeterProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = (clamped / 100) * CIRC;
  const color = bandColor(clamped);
  const height = SIZE / 2 + STROKE;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) onClick();
      }}
      style={{
        position: 'relative',
        width: SIZE,
        height,
        cursor: onClick ? 'pointer' : 'default',
      }}
      title={onClick ? 'View hit ratio over time →' : undefined}
    >
      <svg width={SIZE} height={height} viewBox={`0 0 ${SIZE} ${height}`}>
        <defs>
          <filter id="meter-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={color} floodOpacity="0.55" />
          </filter>
        </defs>
        <g transform={`translate(${STROKE / 2}, ${STROKE / 2})`}>
          <path
            d={`M 0 ${R} A ${R} ${R} 0 0 1 ${R * 2} ${R}`}
            fill="none"
            stroke="var(--gridline)"
            strokeWidth={STROKE}
            strokeLinecap="round"
          />
          <path
            d={`M 0 ${R} A ${R} ${R} 0 0 1 ${R * 2} ${R}`}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRC}`}
            filter="url(#meter-glow)"
            style={{ transition: 'stroke-dasharray 300ms ease, stroke 300ms ease' }}
          />
        </g>
      </svg>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        <div className="mono" style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>
          {clamped.toFixed(1)}%
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5, fontWeight: 600 }}>
          {hitCount} / {totalCount} {label}
        </div>
      </div>
    </div>
  );
}
