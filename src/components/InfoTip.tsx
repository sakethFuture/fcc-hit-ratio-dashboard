import { useState } from 'react';

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle', marginLeft: 5 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Not a <button> — this is deliberately nested inside real buttons/table
          headers elsewhere, and a <button>-in-<button> is invalid HTML that
          breaks hydration. role="button" keeps it keyboard-accessible instead. */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }
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
        }}
      >
        i
      </span>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: '140%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 11,
            fontWeight: 400,
            textTransform: 'none',
            letterSpacing: 'normal',
            color: 'var(--text-secondary)',
            width: 220,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 20,
            pointerEvents: 'none',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
