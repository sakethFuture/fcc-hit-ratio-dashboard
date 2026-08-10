import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { StockSplit, Tranche } from '../types';

export const HIT_THRESHOLD = 1.15;

export interface CloseBar {
  date: string; // ISO YYYY-MM-DD
  close: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  return differenceInCalendarDays(parseISO(toIso), parseISO(fromIso));
}

/**
 * Yahoo's daily close series is retroactively adjusted for every stock split,
 * including ones that happen after a tranche's entry date. To compare
 * entryPrice against that series we have to deflate it by the same cumulative
 * ratio — otherwise a scrip that split after entry (e.g. 1:5) looks like it
 * crashed 80% when nothing actually changed.
 */
export function splitAdjustmentFactor(entryDate: string, splits: StockSplit[]): number {
  return splits
    .filter((s) => s.date > entryDate)
    .reduce((factor, s) => factor * s.ratio, 1);
}

/**
 * Classifies a single tranche as HIT / NOT_HIT and fills in the derived
 * fields. Mutates and returns the same tranche object. Whether shares are
 * still held (`remainingQty > 0`) is a separate, orthogonal fact from this
 * status — it's never folded into the status value itself.
 *
 * `closes` should be the scrip's full daily close series (any order); this
 * function slices out the relevant window itself. `livePrice`, if supplied,
 * overrides the last close as the "current" price for still-open tranches
 * (used for intraday LTP from prices.json rather than yesterday's close).
 * `splits` are the scrip's known stock splits, used to put entryPrice on the
 * same adjusted basis as the close series before any comparison.
 */
export function classifyTranche(
  tranche: Tranche,
  closes: CloseBar[],
  today: string,
  livePrice?: number,
  splits: StockSplit[] = [],
): Tranche {
  // Hit detection is a pure price check: did any tracked close since entry
  // reach +15%, full stop — independent of whether/when the position was
  // sold. Scanning only through closedDate (the position's exit date) would
  // silently hide a real hit that happened after we'd already sold, which is
  // a data bug, not a feature: the stock still did what it did.
  const windowCloses = closes
    .filter((c) => c.date >= tranche.entryDate && c.date <= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // Actual holding period, unrelated to the price-scan window above.
  const windowEnd = tranche.closedDate ?? today;

  const factor = splitAdjustmentFactor(tranche.entryDate, splits);
  tranche.splitAdjustFactor = factor;
  const adjustedEntryPrice = tranche.entryPrice / factor;

  const threshold = adjustedEntryPrice * HIT_THRESHOLD;
  const hit = windowCloses.find((c) => c.close >= threshold);
  const isOpenNow = tranche.remainingQty > 0;

  if (hit) {
    tranche.hitDate = hit.date;
    tranche.daysToHit = daysBetween(tranche.entryDate, hit.date);
    tranche.hitStatus = 'HIT';
  } else {
    tranche.hitDate = null;
    tranche.daysToHit = null;
    tranche.hitStatus = 'NOT_HIT';
  }

  tranche.daysHeld = daysBetween(tranche.entryDate, windowEnd);

  if (windowCloses.length > 0) {
    const closesOnly = windowCloses.map((c) => c.close);
    tranche.peakMovePct = (Math.max(...closesOnly) / adjustedEntryPrice - 1) * 100;
    tranche.troughMovePct = (Math.min(...closesOnly) / adjustedEntryPrice - 1) * 100;
  } else {
    tranche.peakMovePct = null;
    tranche.troughMovePct = null;
  }

  if (isOpenNow) {
    const lastClose = windowCloses.at(-1)?.close ?? null;
    const ltp = livePrice ?? lastClose;
    tranche.currentLtp = ltp;
    if (ltp != null) {
      tranche.currentMovePct = (ltp / adjustedEntryPrice - 1) * 100;
      tranche.pctStillNeeded = (threshold / ltp - 1) * 100;
      // remainingQty is in pre-split share terms; each original share is now
      // `factor` current shares worth `ltp`, against the original cost basis.
      tranche.unrealizedPnl = tranche.remainingQty * factor * (ltp - adjustedEntryPrice);
    }
  } else {
    tranche.currentLtp = null;
    tranche.currentMovePct = null;
    tranche.pctStillNeeded = null;
    tranche.unrealizedPnl = 0;
  }

  return tranche;
}

export function classifyAllTranches(
  tranches: Tranche[],
  closesByScrip: Record<string, CloseBar[]>,
  today: string,
  liveByScrip?: Record<string, number>,
  splitsByScrip?: Record<string, StockSplit[]>,
): Tranche[] {
  for (const tr of tranches) {
    classifyTranche(
      tr,
      closesByScrip[tr.scripSymbol] ?? [],
      today,
      liveByScrip?.[tr.scripSymbol],
      splitsByScrip?.[tr.scripSymbol] ?? [],
    );
  }
  return tranches;
}
