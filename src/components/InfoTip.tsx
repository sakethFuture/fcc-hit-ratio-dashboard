import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * An (i) icon with a hover/tap tooltip. The popover is rendered into a portal
 * on document.body and positioned via getBoundingClientRect — NOT absolutely
 * positioned relative to its trigger — because triggers live inside cards and
 * table headers that set `overflow: hidden` (for rounded corners / sticky
 * headers), which was silently clipping an absolutely-positioned popover.
 * Portaling to body sidesteps every ancestor's overflow/stacking context.
 */
export function InfoTip({ text }: { text: string }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  };

  const show = () => {
    updatePosition();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      {/* Not a <button> — this is deliberately nested inside real buttons/table
          headers elsewhere, and a <button>-in-<button> is invalid HTML that
          breaks hydration. role="button" keeps it keyboard-accessible instead. */}
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (open) setOpen(false);
          else show();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (open) setOpen(false);
            else show();
          }
          if (e.key === 'Escape') setOpen(false);
        }}
        aria-label="More info"
        style={{
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '1px solid var(--text-muted)',
          color: 'var(--text-muted)',
          background: 'none',
          fontSize: 9,
          lineHeight: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'help',
          padding: 0,
          marginLeft: 5,
          verticalAlign: 'middle',
          flexShrink: 0,
        }}
      >
        i
      </span>
      {open &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: 'translate(-50%, -100%)',
              background: 'var(--surface-3)',
              border: '1px solid var(--border-strong)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 11.5,
              lineHeight: 1.4,
              fontWeight: 400,
              textTransform: 'none',
              letterSpacing: 'normal',
              color: 'var(--text-secondary)',
              width: 230,
              boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
              zIndex: 9999,
              pointerEvents: 'none',
            }}
          >
            {text}
          </span>,
          document.body,
        )}
    </>
  );
}
