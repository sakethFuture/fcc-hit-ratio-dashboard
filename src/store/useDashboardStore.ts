import { create } from 'zustand';
import { parseAccountMetadata, parseTradelistingWorkbook } from '../lib/parseTradelisting';
import { buildLedgerFromTrades } from '../lib/trancheEngine';
import { classifyAllTranches, type CloseBar } from '../lib/hitClassification';
import { commitFile, getGithubToken } from '../lib/githubCommit';
import type { Ledger, LivePrice, StockSplit, TickerMapEntry } from '../types';

const withBase = (path: string) => `${import.meta.env.BASE_URL}${path}`;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

interface DashboardState {
  ledger: Ledger | null;
  historicalCloses: Record<string, CloseBar[]>; // keyed by scripSymbol
  prices: Record<string, LivePrice>; // keyed by scripSymbol
  splits: Record<string, StockSplit[]>; // keyed by scripSymbol
  tickerMap: TickerMapEntry[];
  parseWarnings: string[];
  loading: boolean;
  error: string | null;
  commitStatus: 'idle' | 'committing' | 'success' | 'error' | 'no-token';
  commitError: string | null;

  bootstrap: () => Promise<void>;
  loadTradelistingFile: (file: File) => Promise<void>;
  reclassify: () => void;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(withBase(path));
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function tickerToScrip(tickerMap: TickerMapEntry[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of tickerMap) out[e.yahooTicker] = e.scripSymbol;
  return out;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  ledger: null,
  historicalCloses: {},
  prices: {},
  splits: {},
  tickerMap: [],
  parseWarnings: [],
  loading: false,
  error: null,
  commitStatus: 'idle',
  commitError: null,

  bootstrap: async () => {
    set({ loading: true, error: null });
    try {
      const [ledger, closesRaw, pricesFile, tickerMap, splitsRaw] = await Promise.all([
        fetchJson<Ledger>('data/ledger.json'),
        fetchJson<Record<string, { date: string; close: number }[]>>('data/historical_closes.json'),
        fetchJson<{ generatedAt: string; prices: Record<string, LivePrice> }>('data/prices.json'),
        fetchJson<TickerMapEntry[]>('data/ticker_map.json'),
        fetchJson<Record<string, StockSplit[]>>('data/corporate_actions.json'),
      ]);

      const map = tickerMap ?? [];
      const t2s = tickerToScrip(map);
      const historicalCloses: Record<string, CloseBar[]> = {};
      if (closesRaw) {
        for (const [ticker, series] of Object.entries(closesRaw)) {
          const scrip = t2s[ticker] ?? ticker;
          historicalCloses[scrip] = series;
        }
      }

      const prices: Record<string, LivePrice> = {};
      if (pricesFile?.prices) {
        for (const [ticker, p] of Object.entries(pricesFile.prices)) {
          const scrip = t2s[ticker] ?? ticker;
          prices[scrip] = p;
        }
      }

      const splits: Record<string, StockSplit[]> = {};
      if (splitsRaw) {
        for (const [ticker, list] of Object.entries(splitsRaw)) {
          const scrip = t2s[ticker] ?? ticker;
          splits[scrip] = list;
        }
      }

      set({ ledger, historicalCloses, prices, splits, tickerMap: map, loading: false });
      if (ledger) get().reclassify();
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  loadTradelistingFile: async (file: File) => {
    set({ loading: true, error: null });
    try {
      const buf = await file.arrayBuffer();
      const meta = parseAccountMetadata(buf);
      const { rows, warnings: parseWarnings } = parseTradelistingWorkbook(buf);
      const { scrips, warnings: trancheWarnings } = buildLedgerFromTrades(rows);

      const ledger: Ledger = {
        generatedAt: new Date().toISOString(),
        statementPeriod: meta.statementPeriod ?? '',
        clientCode: meta.clientCode ?? '',
        scrips,
      };

      set({ ledger, parseWarnings: [...parseWarnings, ...trancheWarnings], loading: false });
      get().reclassify();

      if (!getGithubToken()) {
        set({ commitStatus: 'no-token' });
        return;
      }
      set({ commitStatus: 'committing', commitError: null });
      try {
        await commitFile(
          'public/data/ledger.json',
          JSON.stringify(get().ledger, null, 2),
          `chore: rebuild ledger from upload (${ledger.scrips.length} scrips, ${ledger.scrips.reduce((s, sc) => s + sc.tranches.length, 0)} tranches)`,
        );
        set({ commitStatus: 'success' });
      } catch (commitErr) {
        set({ commitStatus: 'error', commitError: String(commitErr) });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  reclassify: () => {
    const { ledger, historicalCloses, prices, splits } = get();
    if (!ledger) return;
    const today = todayIso();
    const liveByScrip: Record<string, number> = {};
    for (const [scrip, p] of Object.entries(prices)) liveByScrip[scrip] = p.ltp;

    for (const scripLedger of ledger.scrips) {
      classifyAllTranches(
        scripLedger.tranches,
        { [scripLedger.scripSymbol]: historicalCloses[scripLedger.scripSymbol] ?? [] },
        today,
        liveByScrip,
        { [scripLedger.scripSymbol]: splits[scripLedger.scripSymbol] ?? [] },
      );
    }
    set({ ledger: { ...ledger, scrips: [...ledger.scrips] } });
  },
}));

if (import.meta.env.DEV) {
  // Dev-only escape hatch for generating a seed ledger.json from the browser
  // console / scripts — never included in the production build.
  (window as unknown as { __DASHBOARD_STORE__: typeof useDashboardStore }).__DASHBOARD_STORE__ =
    useDashboardStore;
}
