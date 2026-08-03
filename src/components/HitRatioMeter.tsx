interface HitRatioMeterProps {
  pct: number; // 0-100
  hitCount: number;
  totalCount: number;
  label: string;
}

const SIZE = 220;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CIRC = Math.PI * R; // semicircle length

export function HitRatioMeter({ pct, hitCount, totalCount, label }: HitRatioMeterProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const filled = (clamped / 100) * CIRC;

  const height = SIZE / 2 + STROKE;

  return (
    <div style={{ position: 'relative', width: SIZE, height }}>
      <svg width={SIZE} height={height} viewBox={`0 0 ${SIZE} ${height}`}>
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
            stroke="var(--seq-400)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRC}`}
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
        <div className="mono" style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
          {clamped.toFixed(1)}%
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
          {hitCount} / {totalCount} {label}
        </div>
      </div>
    </div>
  );
}
