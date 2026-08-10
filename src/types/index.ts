// Domain types for the FCC Hit Ratio dashboard.
// Dates are stored as ISO strings ("YYYY-MM-DD") throughout so they are
// trivially serializable to/from JSON and sortable as plain strings.

export type BuySell = 'B' | 'S';

/** One row from the Equity Tradelisting export, normalized. */
export interface TradeRow {
  exchange: string;
  tradeDate: string; // ISO YYYY-MM-DD
  scripSymbol: string;
  tdInd: string;
  buySell: BuySell;
  quantity: number;
  rate: number;
  brokeragePerShare: number;
  netRate: number;
  netAmount: number;
  finalAmount: number;
  /** Original row order in the source file — used as a chronological tiebreak. */
  fileOrder: number;
}

export type TrancheStatus = 'OPEN' | 'PARTIALLY_CLOSED' | 'CLOSED';

export interface ExitEvent {
  date: string; // ISO YYYY-MM-DD
  qty: number;
  price: number;
}

/** Binary outcome only — whether shares are still held is tracked separately via
 * `remainingQty`, not folded into this enum. */
export type HitStatus = 'HIT' | 'NOT_HIT';

export interface Tranche {
  id: string; // `${scrip}__T${n}`
  scripSymbol: string;
  exchange: string;
  label: string; // "Tranche 1", "Tranche 2", ...
  trancheNumber: number; // 1, 2, 3, ... — same sequence as `label`, as a real number
  entryDate: string;
  entryPrice: number;
  entryQty: number;
  remainingQty: number;
  exitEvents: ExitEvent[];
  status: TrancheStatus;
  closedDate: string | null;

  // Hit classification (computed once price history is available)
  hitStatus: HitStatus | null;
  hitDate: string | null;
  daysToHit: number | null;
  currentLtp: number | null;
  currentMovePct: number | null;
  pctStillNeeded: number | null;
  daysHeld: number | null;
  realizedPnl: number | null;
  unrealizedPnl: number | null;
  /** Max/min daily close reached within [entryDate, closedDate ?? today], as % move from entryPrice. */
  peakMovePct: number | null;
  troughMovePct: number | null;
  /** Cumulative stock-split ratio applied between entryDate and now (1 = no split). Yahoo's
   * close series is retroactively split-adjusted, so entryPrice is deflated by this factor
   * before being compared against closes/LTP. */
  splitAdjustFactor: number | null;
}

export interface StockSplit {
  date: string; // ISO YYYY-MM-DD, ex-split date
  ratio: number; // new shares per old share, e.g. 5 for a 1:5 split
}

export interface ScripLedger {
  scripSymbol: string;
  exchange: string;
  tranches: Tranche[];
}

export interface Ledger {
  generatedAt: string; // ISO datetime
  statementPeriod: string;
  clientCode: string;
  scrips: ScripLedger[];
}

/** ticker -> array of {date, close} */
export interface HistoricalCloseSeries {
  [tickerSymbol: string]: { date: string; close: number }[];
}

export interface LivePrice {
  ticker: string;
  ltp: number;
  asOf: string; // ISO datetime
  source: 'yfinance' | 'nse';
  nseCheckLtp?: number;
  nseCheckDiffPct?: number;
  flagged?: boolean;
}

export interface PricesFile {
  generatedAt: string;
  prices: Record<string, LivePrice>;
}

export interface TickerMapEntry {
  scripSymbol: string;
  exchange: string;
  yahooTicker: string;
  manualOverride: boolean;
}
