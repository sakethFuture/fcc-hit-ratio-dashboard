import { useDashboardStore } from '../store/useDashboardStore';
import { COPY } from '../lib/copy';
import { InfoTip } from './InfoTip';

/** Global Finished-trades-only / Every-trade segmented control. One instance,
 * mounted in the app header — every tab reads the same store value, so the
 * numbers on every screen move together. */
export function FilterToggle() {
  const mode = useDashboardStore((s) => s.trancheFilterMode);
  const setMode = useDashboardStore((s) => s.setTrancheFilterMode);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        borderRadius: 9,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
    >
      {(
        [
          { key: 'closedOnly', copy: COPY.finishedTradesOnly },
          { key: 'all', copy: COPY.everyTrade },
        ] as const
      ).map(({ key, copy }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={active ? undefined : 'clickable'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              border: 'none',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.02em',
              cursor: 'pointer',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              background: active ? 'var(--surface-3)' : 'transparent',
              transition: 'background var(--transition-fast), color var(--transition-fast)',
            }}
          >
            {copy.label}
            <InfoTip text={copy.tooltip} />
          </button>
        );
      })}
    </div>
  );
}
