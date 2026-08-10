import type { ExitEvent, ScripLedger, Tranche, TradeRow } from '../types';

function compareTrades(a: TradeRow, b: TradeRow): number {
  if (a.tradeDate !== b.tradeDate) return a.tradeDate < b.tradeDate ? -1 : 1;
  return a.fileOrder - b.fileOrder;
}

/**
 * Builds tranches for a single scrip from its trade rows.
 *
 * Buys: every distinct trade date starts a brand new tranche (quantity-weighted
 * average Net Rate across that day's fills), independent of any other tranche's
 * open/closed state.
 *
 * Sells: applied strictly FIFO across tranches ordered by entry date — a single
 * sell can partially reduce, fully close, or spill across multiple tranches.
 */
export interface ScripLedgerResult {
  ledger: ScripLedger;
  warnings: string[];
}

export function buildScripLedger(scripSymbol: string, trades: TradeRow[]): ScripLedgerResult {
  const sorted = [...trades].sort(compareTrades);
  const exchange = sorted[0]?.exchange ?? '';

  // 1. Group same-day buys into tranches.
  const buysByDate = new Map<string, TradeRow[]>();
  for (const t of sorted) {
    if (t.buySell !== 'B') continue;
    const list = buysByDate.get(t.tradeDate) ?? [];
    list.push(t);
    buysByDate.set(t.tradeDate, list);
  }

  const entryDates = [...buysByDate.keys()].sort();
  const tranches: Tranche[] = entryDates.map((entryDate, i) => {
    const fills = buysByDate.get(entryDate)!;
    const entryQty = fills.reduce((s, f) => s + f.quantity, 0);
    const entryPrice =
      fills.reduce((s, f) => s + f.quantity * f.netRate, 0) / (entryQty || 1);

    return {
      id: `${scripSymbol}__T${i + 1}`,
      scripSymbol,
      exchange,
      label: `Tranche ${i + 1}`,
      trancheNumber: i + 1,
      entryDate,
      entryPrice,
      entryQty,
      remainingQty: entryQty,
      exitEvents: [],
      status: 'OPEN',
      closedDate: null,
      hitStatus: null,
      hitDate: null,
      daysToHit: null,
      currentLtp: null,
      currentMovePct: null,
      pctStillNeeded: null,
      daysHeld: null,
      realizedPnl: null,
      unrealizedPnl: null,
      peakMovePct: null,
      troughMovePct: null,
      splitAdjustFactor: null,
    };
  });

  // 2. Apply sells strictly FIFO, in chronological order, across tranches
  //    whose entry date is at or before the sell.
  const warnings: string[] = [];
  const sells = sorted.filter((t) => t.buySell === 'S');
  for (const sell of sells) {
    let qtyToApply = sell.quantity;
    const eligible = tranches
      .filter((tr) => tr.entryDate <= sell.tradeDate && tr.remainingQty > 0)
      .sort((a, b) => (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : 0));

    for (const tr of eligible) {
      if (qtyToApply <= 0) break;
      const applied = Math.min(tr.remainingQty, qtyToApply);
      if (applied <= 0) continue;

      const exit: ExitEvent = { date: sell.tradeDate, qty: applied, price: sell.netRate };
      tr.exitEvents.push(exit);
      tr.remainingQty -= applied;
      qtyToApply -= applied;

      if (tr.remainingQty <= 1e-6) {
        tr.remainingQty = 0;
        tr.status = 'CLOSED';
        tr.closedDate = sell.tradeDate;
      } else {
        tr.status = 'PARTIALLY_CLOSED';
      }
    }

    if (qtyToApply > 1e-6) {
      warnings.push(
        `${scripSymbol}: sell of ${qtyToApply} on ${sell.tradeDate} has no matching open tranche ` +
          `(likely a position opened before the statement period) — excluded from tranche analysis.`,
      );
    }
  }

  for (const tr of tranches) {
    tr.realizedPnl = tr.exitEvents.reduce((s, e) => s + e.qty * (e.price - tr.entryPrice), 0);
  }

  return { ledger: { scripSymbol, exchange, tranches }, warnings };
}

export function buildLedgerFromTrades(rows: TradeRow[]): { scrips: ScripLedger[]; warnings: string[] } {
  const byScrip = new Map<string, TradeRow[]>();
  for (const row of rows) {
    const list = byScrip.get(row.scripSymbol) ?? [];
    list.push(row);
    byScrip.set(row.scripSymbol, list);
  }

  const results = [...byScrip.entries()].map(([scrip, trades]) => buildScripLedger(scrip, trades));

  const scrips = results
    .map((r) => r.ledger)
    .filter((l) => l.tranches.length > 0)
    .sort((a, b) => a.scripSymbol.localeCompare(b.scripSymbol));

  const warnings = results.flatMap((r) => r.warnings);

  return { scrips, warnings };
}
