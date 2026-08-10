import { useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { useDashboardStore } from './store/useDashboardStore';
import { UploadPanel } from './components/UploadPanel';
import { FilterToggle } from './components/FilterToggle';
import { Overview } from './pages/Overview';
import { StockWise } from './pages/StockWise';
import { TimeBased } from './pages/TimeBased';
import { PortfolioStats } from './pages/PortfolioStats';

const navClass = ({ isActive }: { isActive: boolean }) => `nav-link${isActive ? ' active-tab' : ''}`;

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
        <header className="app-header">
          <div className="app-header-left">
            <div style={{ fontWeight: 800, fontSize: 15, padding: 'var(--space-4) 0', letterSpacing: '-0.01em' }}>
              FCC <span style={{ color: 'var(--seq-400)' }}>HIT RATIO</span>
            </div>
            <nav style={{ display: 'flex', flexWrap: 'wrap' }}>
              <NavLink to="/" end className={navClass}>
                Overview
              </NavLink>
              <NavLink to="/stocks" className={navClass}>
                Stock-wise
              </NavLink>
              <NavLink to="/time" className={navClass}>
                Time-based
              </NavLink>
              <NavLink to="/portfolio-stats" className={navClass}>
                Portfolio Stats
              </NavLink>
            </nav>
          </div>
          <div className="app-header-right">
            {ledger && <FilterToggle />}
            <button className="btn" onClick={() => setUploadOpen((v) => !v)}>
              {uploadOpen ? 'Close' : 'Upload Tradelisting'}
            </button>
          </div>
        </header>

        {uploadOpen && (
          <div
            style={{
              padding: 'var(--space-5)',
              borderBottom: '1px solid var(--border)',
              background: 'var(--surface-0)',
            }}
          >
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <UploadPanel />
            </div>
          </div>
        )}

        <main style={{ flex: 1, padding: 'var(--space-5)' }}>
          {ledger ? (
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/stocks" element={<StockWise />} />
              <Route path="/time" element={<TimeBased />} />
              <Route path="/portfolio-stats" element={<PortfolioStats />} />
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
