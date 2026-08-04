import { useCallback, useRef, useState } from 'react';
import { useDashboardStore } from '../store/useDashboardStore';
import { clearGithubToken, getGithubToken, setGithubToken } from '../lib/githubCommit';

function CommitStatus() {
  const status = useDashboardStore((s) => s.commitStatus);
  const err = useDashboardStore((s) => s.commitError);

  if (status === 'idle') return null;
  if (status === 'no-token') {
    return (
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
        Not committed — set a GitHub token below to auto-publish ledger.json on upload.
      </div>
    );
  }
  if (status === 'committing') {
    return (
      <div style={{ fontSize: 12, color: 'var(--status-warning)', marginTop: 6 }}>
        Committing ledger.json to GitHub…
      </div>
    );
  }
  if (status === 'success') {
    return (
      <div style={{ fontSize: 12, color: 'var(--status-good)', marginTop: 6 }}>
        ✓ Committed ledger.json to sakethFuture/fcc-hit-ratio-dashboard
      </div>
    );
  }
  return (
    <div style={{ fontSize: 12, color: 'var(--status-critical)', marginTop: 6 }}>
      Commit failed: {err}
    </div>
  );
}

function GithubTokenSettings() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(!!getGithubToken());

  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 11,
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        {saved ? 'GitHub token configured' : 'Set GitHub token for auto-publish'} {open ? '▾' : '▸'}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="password"
            placeholder="ghp_… (repo scope, stored only in this browser)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 5,
              padding: '6px 10px',
              fontSize: 12,
              width: 320,
            }}
          />
          <button
            onClick={() => {
              if (value) {
                setGithubToken(value);
                setSaved(true);
                setValue('');
              }
            }}
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '6px 10px',
              borderRadius: 5,
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          {saved && (
            <button
              onClick={() => {
                clearGithubToken();
                setSaved(false);
              }}
              style={{
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 5,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function UploadPanel() {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadTradelistingFile = useDashboardStore((s) => s.loadTradelistingFile);
  const loading = useDashboardStore((s) => s.loading);
  const error = useDashboardStore((s) => s.error);
  const warnings = useDashboardStore((s) => s.parseWarnings);
  const ledger = useDashboardStore((s) => s.ledger);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      void loadTradelistingFile(file);
    },
    [loadTradelistingFile],
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragOver ? 'var(--seq-400)' : 'var(--border)'}`,
          borderRadius: 10,
          padding: 'var(--space-7) var(--space-5)',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragOver ? 'var(--surface-2)' : 'var(--surface-1)',
          transition: 'background var(--transition-med), border-color var(--transition-med)',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {loading ? 'Parsing…' : 'Drop Equity Tradelisting.xlsx here, or click to browse'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
          Full cumulative statement — every upload rebuilds the ledger from scratch and
          auto-publishes it to GitHub.
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 10, color: 'var(--status-critical)', fontSize: 13 }}>{error}</div>
      )}

      {ledger && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
          Loaded {ledger.scrips.length} scrips ·{' '}
          {ledger.scrips.reduce((s, sc) => s + sc.tranches.length, 0)} tranches ·{' '}
          generated {new Date(ledger.generatedAt).toLocaleString()}
        </div>
      )}

      <CommitStatus />

      {warnings.length > 0 && (
        <details style={{ marginTop: 10, fontSize: 12, color: 'var(--status-warning)' }}>
          <summary>{warnings.length} row(s) skipped during parse</summary>
          <ul>
            {warnings.slice(0, 30).map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}

      <GithubTokenSettings />
    </div>
  );
}
