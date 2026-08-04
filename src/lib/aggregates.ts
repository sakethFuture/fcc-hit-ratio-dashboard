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

export interface HitRatioStats {
  total: number;
  hit: number;
  notHit: number;
  active: number;
  hitPct: number; // over `total` as passed in
}

/**
 * Single source of truth for hit-ratio rollups (Overview, Stock-wise, Time-based
 * all call this — never recompute hit/not-hit counts locally).
 *
 * "Finished only" (closedOnly=true) means "outcome decided" — HIT and
 * HIT_RUNNING both count as decided (the price already touched +15%,
 * regardless of whether shares are still held), so only ACTIVE (still open
 * AND never hit) is excluded. Whether a tranche is still open is irrelevant
 * to hit/not-hit; only whether price ever reached the threshold matters.
 */
export function computeHitRatio(tranches: Tranche[], closedOnly: boolean): HitRatioStats {
  const pool = closedOnly ? tranches.filter((t) => t.hitStatus !== 'ACTIVE') : tranches;

  const hit = pool.filter((t) => t.hitStatus === 'HIT' || t.hitStatus === 'HIT_RUNNING').length;
  const notHit = pool.filter((t) => t.hitStatus === 'NOT_HIT').length;
  const active = pool.filter((t) => t.hitStatus === 'ACTIVE').length;
  const total = pool.length;

  return { total, hit, notHit, active, hitPct: total > 0 ? (hit / total) * 100 : 0 };
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
    .filter((t) => t.hitStatus === 'HIT' || t.hitStatus === 'HIT_RUNNING')
    .sort((a, b) => (b.peakMovePct ?? 0) - (a.peakMovePct ?? 0))
    .slice(0, n);
}

/** Ranked by worst drawdown (trough move from entry) among fully closed, never-hit tranches. */
export function worstNotHits(tranches: Tranche[], n: number): Tranche[] {
  return tranches
    .filter((t) => t.hitStatus === 'NOT_HIT')
    .sort((a, b) => (a.troughMovePct ?? 0) - (b.troughMovePct ?? 0))
    .slice(0, n);
}

export interface ScripHitRatio {
  scripSymbol: string;
  total: number;
  hit: number;
  hitPct: number;
  mostRecentEntryDate: string;
}

export function perScripHitRatio(ledger: Ledger | null): ScripHitRatio[] {
  if (!ledger) return [];
  return ledger.scrips.map((s) => {
    const stats = computeHitRatio(s.tranches, true);
    const mostRecent = s.tranches.reduce(
      (max, t) => (t.entryDate > max ? t.entryDate : max),
      '',
    );
    return {
      scripSymbol: s.scripSymbol,
      total: s.tranches.length,
      hit: stats.hit,
      hitPct: stats.hitPct,
      mostRecentEntryDate: mostRecent,
    };
  });
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
    const stats = computeHitRatio(list, true);
    return { bucket, total: list.length, hit: stats.hit, hitPct: stats.hitPct, tranches: list };
  });
}
