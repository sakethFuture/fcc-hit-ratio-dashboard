import {
  eachDayOfInterval,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  eachWeekOfInterval,
  eachYearOfInterval,
  format,
  getISOWeek,
  getISOWeekYear,
  parseISO,
} from 'date-fns';
import type { Ledger, Tranche } from '../types';

export function allTranches(ledger: Ledger | null): Tranche[] {
  if (!ledger) return [];
  return ledger.scrips.flatMap((s) => s.tranches);
}

/**
 * Binary hit test — the one place "did this tranche hit?" is decided.
 * `hitStatus` is only ever 'HIT' or 'NOT_HIT' (see hitClassification.ts);
 * whether shares are still held is a separate fact (`remainingQty > 0`),
 * never a third status bucket. A still-open, not-yet-hit tranche is
 * provisionally "not hit" until it either hits or gets exited without
 * hitting.
 */
export function isHit(t: Tranche): boolean {
  return t.hitStatus === 'HIT';
}

export type TrancheFilterMode = 'all' | 'closedOnly';

/**
 * The one place the Finished-trades-only / Every-trade toggle is applied.
 * Every rollup (hit ratio, EV, tranche-position, streaks, etc.) should filter
 * through this before computing anything — never re-implement the filter.
 */
export function filterTranches(tranches: Tranche[], mode: TrancheFilterMode): Tranche[] {
  if (mode === 'all') return tranches;
  return tranches.filter((t) => t.remainingQty === 0);
}

export interface HitRatioStats {
  total: number;
  hit: number;
  notHit: number;
  hitPct: number;
}

/**
 * Single source of truth for hit-ratio rollups — Overview, Stock-wise, and
 * Time-based all call this; never recompute hit/not-hit counts locally.
 * total is always every tranche passed in — no exclusion bucket.
 */
export function computeHitRatio(tranches: Tranche[]): HitRatioStats {
  const total = tranches.length;
  const hit = tranches.filter(isHit).length;
  const notHit = total - hit;

  return { total, hit, notHit, hitPct: total > 0 ? (hit / total) * 100 : 0 };
}

export interface PnlSummary {
  realized: number;
  unrealized: number;
}

export function computePnl(tranches: Tranche[]): PnlSummary {
  return {
    realized: tranches.reduce((s, t) => s + (t.realizedPnl ?? 0), 0),
    unrealized: tranches.reduce((s, t) => s + (t.unrealizedPnl ?? 0), 0),
  };
}

/** Best-available "% move achieved" for ranking: peak move for hit/not-hit/active tranches. */
export function trancheMovePct(t: Tranche): number | null {
  return t.peakMovePct;
}

export function topHits(tranches: Tranche[], n: number): Tranche[] {
  return tranches
    .filter(isHit)
    .sort((a, b) => (b.peakMovePct ?? 0) - (a.peakMovePct ?? 0))
    .slice(0, n);
}

/** Ranked by worst drawdown (trough move from entry) among all not-hit tranches — closed and
 * still-open-but-undecided alike, consistent with the binary hit/not-hit rule. */
export function worstNotHits(tranches: Tranche[], n: number): Tranche[] {
  return tranches
    .filter((t) => !isHit(t))
    .sort((a, b) => (a.troughMovePct ?? 0) - (b.troughMovePct ?? 0))
    .slice(0, n);
}

// --- Expected Value -------------------------------------------------------
//
// EV% = Hit% × avg-peak-gain-on-Hits + Miss% × avg-signed-result-on-Misses.
// Both fractions and both averages are signed real numbers — this is a
// straight probability-weighted average of actual outcomes, so a miss
// bucket that happens to be net flat/positive pulls EV up, exactly as a
// true expected value should (not the "always subtract" behavior you'd get
// from treating the miss average as an unsigned loss magnitude).

/**
 * For a not-hit tranche: the booked %-return if fully exited (realized P&L
 * over cost basis, signed), or the current unrealized %-move if still open.
 * Returns null for hit tranches — this is a miss-side-only figure.
 */
export function missResultPct(t: Tranche): number | null {
  if (isHit(t)) return null;
  if (t.remainingQty === 0) {
    const costBasis = t.entryQty * t.entryPrice;
    return costBasis > 0 ? ((t.realizedPnl ?? 0) / costBasis) * 100 : null;
  }
  return t.currentMovePct;
}

export interface EVStats {
  evPct: number;
  hitPct: number;
  missPct: number;
  avgHitGain: number | null;
  avgMissResult: number | null;
  n: number;
}

/** Single source of truth for EV — every breakdown (headline, per tranche-number,
 * per scrip, per time bucket) calls this on a pre-filtered tranche list. */
export function computeEV(tranches: Tranche[]): EVStats {
  const stats = computeHitRatio(tranches);
  const hits = tranches.filter(isHit);
  const misses = tranches.filter((t) => !isHit(t));

  const avgHitGain =
    hits.length > 0 ? hits.reduce((s, t) => s + (t.peakMovePct ?? 0), 0) / hits.length : null;
  const missResults = misses.map(missResultPct).filter((v): v is number => v != null);
  const avgMissResult =
    missResults.length > 0 ? missResults.reduce((s, v) => s + v, 0) / missResults.length : null;

  const hitFrac = stats.total > 0 ? stats.hit / stats.total : 0;
  const missFrac = stats.total > 0 ? stats.notHit / stats.total : 0;
  const evPct = hitFrac * (avgHitGain ?? 0) + missFrac * (avgMissResult ?? 0);

  return {
    evPct,
    hitPct: stats.hitPct,
    missPct: stats.total > 0 ? (stats.notHit / stats.total) * 100 : 0,
    avgHitGain,
    avgMissResult,
    n: stats.total,
  };
}

export interface ScripHitRatio {
  scripSymbol: string;
  total: number;
  hit: number;
  hitPct: number;
  ev: EVStats;
  mostRecentEntryDate: string;
}

/** Per-scrip rollup for the Stock-wise tab — takes a caller-filtered tranche
 * list per scrip (the Finished-trades-only/Every-trade toggle is applied by
 * the caller via `filterTranches` before this runs). */
export function perScripHitRatio(scrips: { scripSymbol: string; tranches: Tranche[] }[]): ScripHitRatio[] {
  return scrips.map((s) => {
    const stats = computeHitRatio(s.tranches);
    const mostRecent = s.tranches.reduce((max, t) => (t.entryDate > max ? t.entryDate : max), '');
    return {
      scripSymbol: s.scripSymbol,
      total: s.tranches.length,
      hit: stats.hit,
      hitPct: stats.hitPct,
      ev: computeEV(s.tranches),
      mostRecentEntryDate: mostRecent,
    };
  });
}

// --- Tranche-position (tranche-number) breakdown ---------------------------

export interface TrancheNumberStat {
  trancheNumber: number;
  label: string;
  stats: HitRatioStats;
  ev: EVStats;
}

/** One entry per tranche-sequence-number present (1..max), each with its own
 * hit-ratio and EV — "does the 3rd add-on to a position hit as often as the
 * 1st entry?" */
export function perTrancheNumberHitRatio(tranches: Tranche[]): TrancheNumberStat[] {
  const maxN = tranches.reduce((m, t) => Math.max(m, t.trancheNumber), 0);
  const out: TrancheNumberStat[] = [];
  for (let n = 1; n <= maxN; n++) {
    const list = tranches.filter((t) => t.trancheNumber === n);
    out.push({ trancheNumber: n, label: `Tranche ${n}`, stats: computeHitRatio(list), ev: computeEV(list) });
  }
  return out;
}

export interface GenerationStat {
  label: string;
  stats: HitRatioStats;
  ev: EVStats;
}

/** Tranche 1 (a brand-new position) vs Tranche 2+ (adding to an existing one) —
 * used for the secondary breakdown inside each Time-based bucket. */
export function splitByTrancheGeneration(tranches: Tranche[]): {
  first: GenerationStat;
  addOns: GenerationStat;
} {
  const first = tranches.filter((t) => t.trancheNumber === 1);
  const addOns = tranches.filter((t) => t.trancheNumber > 1);
  return {
    first: { label: 'Tranche 1 (new entries)', stats: computeHitRatio(first), ev: computeEV(first) },
    addOns: { label: 'Tranche 2+ (adds)', stats: computeHitRatio(addOns), ev: computeEV(addOns) },
  };
}

// --- Additional portfolio-wide metrics --------------------------------------

/** Mean days-to-hit among hit tranches only; null if there are none. */
export function avgDaysToHit(tranches: Tranche[]): number | null {
  const days = tranches
    .filter(isHit)
    .map((t) => t.daysToHit)
    .filter((d): d is number => d != null);
  return days.length > 0 ? days.reduce((s, d) => s + d, 0) / days.length : null;
}

export interface StreakStat {
  type: 'hit' | 'miss' | null;
  count: number;
}

/** Current portfolio-wide streak, walking backward from the most recent entry
 * date counting consecutive tranches with the same hit/miss outcome. */
export function currentStreak(tranches: Tranche[]): StreakStat {
  const sorted = [...tranches].sort((a, b) => (a.entryDate < b.entryDate ? -1 : a.entryDate > b.entryDate ? 1 : 0));
  if (sorted.length === 0) return { type: null, count: 0 };
  const lastIsHit = isHit(sorted[sorted.length - 1]);
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (isHit(sorted[i]) !== lastIsHit) break;
    count++;
  }
  return { type: lastIsHit ? 'hit' : 'miss', count };
}

export interface CapitalDeployedSplit {
  hitStillRunning: number;
  notHitStillOpen: number;
}

/** Cost-basis capital currently held in open positions, split by whether that
 * tranche has already hit (still running) or hasn't (still open, undecided). */
export function capitalDeployedSplit(tranches: Tranche[]): CapitalDeployedSplit {
  const open = tranches.filter((t) => t.remainingQty > 0);
  let hitStillRunning = 0;
  let notHitStillOpen = 0;
  for (const t of open) {
    const capital = t.remainingQty * t.entryPrice;
    if (isHit(t)) hitStillRunning += capital;
    else notHitStillOpen += capital;
  }
  return { hitStillRunning, notHitStillOpen };
}

/** Single tranche with the highest peak move across the whole set (hit or not). */
export function bestTranche(tranches: Tranche[]): Tranche | null {
  return tranches.reduce<Tranche | null>((best, t) => {
    if (t.peakMovePct == null) return best;
    return !best || t.peakMovePct > (best.peakMovePct ?? -Infinity) ? t : best;
  }, null);
}

/** Single tranche with the worst drawdown (lowest trough move) across the whole set. */
export function worstDrawdownTranche(tranches: Tranche[]): Tranche | null {
  return tranches.reduce<Tranche | null>((worst, t) => {
    if (t.troughMovePct == null) return worst;
    return !worst || t.troughMovePct < (worst.troughMovePct ?? Infinity) ? t : worst;
  }, null);
}

/** Mean capital committed per tranche at entry (qty × entry price). */
export function avgTrancheSize(tranches: Tranche[]): number | null {
  if (tranches.length === 0) return null;
  return tranches.reduce((s, t) => s + t.entryQty * t.entryPrice, 0) / tranches.length;
}

export type BucketGranularity = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export function bucketKey(dateIso: string, granularity: BucketGranularity): string {
  const [y, m] = dateIso.split('-');
  switch (granularity) {
    case 'daily':
      return dateIso;
    case 'weekly': {
      const d = parseISO(dateIso);
      const wy = getISOWeekYear(d);
      const w = String(getISOWeek(d)).padStart(2, '0');
      return `${wy}-W${w}`;
    }
    case 'monthly':
      return `${y}-${m}`;
    case 'quarterly':
      return `${y}-Q${Math.ceil(Number(m) / 3)}`;
    case 'yearly':
      return y;
  }
}

export interface TimeBucketStat {
  bucket: string;
  total: number;
  hit: number;
  hitPct: number;
  ev: EVStats;
  tranches: Tranche[];
}

/** Every bucket key between the earliest and latest entry date, inclusive — so
 * a period with zero tranches still renders as an explicit (muted) bar instead
 * of silently disappearing from the axis. */
function allBucketKeysInRange(minIso: string, maxIso: string, granularity: BucketGranularity): string[] {
  const start = parseISO(minIso);
  const end = parseISO(maxIso);
  let dates: Date[];
  switch (granularity) {
    case 'daily':
      dates = eachDayOfInterval({ start, end });
      break;
    case 'weekly':
      dates = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });
      break;
    case 'monthly':
      dates = eachMonthOfInterval({ start, end });
      break;
    case 'quarterly':
      dates = eachQuarterOfInterval({ start, end });
      break;
    case 'yearly':
      dates = eachYearOfInterval({ start, end });
      break;
  }
  return dates.map((d) => bucketKey(format(d, 'yyyy-MM-dd'), granularity));
}

export function bucketHitRatio(
  tranches: Tranche[],
  granularity: BucketGranularity,
): TimeBucketStat[] {
  if (tranches.length === 0) return [];

  const map = new Map<string, Tranche[]>();
  for (const t of tranches) {
    const key = bucketKey(t.entryDate, granularity);
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }

  const entryDates = tranches.map((t) => t.entryDate).sort();
  const allKeys = allBucketKeysInRange(entryDates[0], entryDates.at(-1)!, granularity);

  return allKeys.map((bucket) => {
    const list = map.get(bucket) ?? [];
    const stats = computeHitRatio(list);
    return {
      bucket,
      total: list.length,
      hit: stats.hit,
      hitPct: stats.hitPct,
      ev: computeEV(list),
      tranches: list,
    };
  });
}
