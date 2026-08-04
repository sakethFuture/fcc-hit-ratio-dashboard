import type { Tranche } from '../types';
import { isHit } from '../lib/aggregates';

/** Chronological row of dots, one per tranche, colored by binary outcome — a glance-level hit pattern. */
export function HitPatternSparkline({ tranches }: { tranches: Tranche[] }) {
  const ordered = [...tranches].sort((a, b) => (a.entryDate < b.entryDate ? -1 : 1));

  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
      {ordered.map((t) => {
        const hit = isHit(t);
        return (
          <span
            key={t.id}
            title={`${t.label}: ${hit ? 'Hit' : 'Not Hit'}`}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: t.hitStatus ? (hit ? 'var(--status-good)' : 'var(--status-critical)') : 'var(--baseline)',
              boxShadow: t.hitStatus ? (hit ? 'var(--glow-good)' : 'var(--glow-critical)') : 'none',
              flexShrink: 0,
            }}
          />
        );
      })}
    </span>
  );
}
