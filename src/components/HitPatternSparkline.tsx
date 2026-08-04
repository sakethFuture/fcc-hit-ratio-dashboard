import type { HitStatus, Tranche } from '../types';

const COLOR: Record<HitStatus, string> = {
  HIT: 'var(--status-good)',
  HIT_RUNNING: 'var(--status-good)',
  NOT_HIT: 'var(--status-critical)',
  ACTIVE: 'var(--status-warning)',
};

/** Chronological row of dots, one per tranche, colored by outcome — a glance-level hit pattern. */
export function HitPatternSparkline({ tranches }: { tranches: Tranche[] }) {
  const ordered = [...tranches].sort((a, b) => (a.entryDate < b.entryDate ? -1 : 1));

  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {ordered.map((t) => (
        <span
          key={t.id}
          title={`${t.label}: ${t.hitStatus ?? 'unknown'}`}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: t.hitStatus ? COLOR[t.hitStatus] : 'var(--baseline)',
            flexShrink: 0,
          }}
        />
      ))}
    </span>
  );
}
