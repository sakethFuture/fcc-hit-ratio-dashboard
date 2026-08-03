import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useDashboardStore } from './store/useDashboardStore';
import { UploadPanel } from './components/UploadPanel';
import { Overview } from './pages/Overview';
import { StockWise } from './pages/StockWise';
import { TimeBased } from './pages/TimeBased';

const navLinkStyle = ({ isActive }: { isActive: boolean }) => ({
  padding: '10px 16px',
  fontSize: 13,
  fontWeight: 600,
  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
  borderBottom: isActive ? '2px solid var(--seq-400)' : '2px solid transparent',
  textDecoration: 'none',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.03em',
});

function App() {
  const bootstrap = useDashboardStore((s) => s.bootstrap);
  const ledger = useDashboardStore((s) => s.ledger);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!ledger) setUploadOpen(true);
  }, [ledger]);

  return (
    <HashRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ fontWeight: 800, fontSize: 15, padding: '14px 0' }}>
              FCC <span style={{ color: 'var(--seq-400)' }}>HIT RATIO</span>
            </div>
            <nav style={{ display: 'flex' }}>
              <NavLink to="/" end style={navLinkStyle}>
                Overview
              </NavLink>
              <NavLink to="/stocks" style={navLinkStyle}>
                Stock-wise
              </NavLink>
              <NavLink to="/time" style={navLinkStyle}>
                Time-based
              </NavLink>
            </nav>
          </div>
          <button
            onClick={() => setUploadOpen((v) => !v)}
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {uploadOpen ? 'Close' : 'Upload Tradelisting'}
          </button>
        </header>

        {uploadOpen && (
          <div
            style={{
              padding: 20,
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-0)',
            }}
          >
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <UploadPanel />
            </div>
          </div>
        )}

        <main style={{ flex: 1, padding: 20 }}>
          {ledger ? (
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/stocks" element={<StockWise />} />
              <Route path="/time" element={<TimeBased />} />
            </Routes>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 80 }}>
              Upload an Equity Tradelisting export to build the ledger.
            </div>
          )}
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
