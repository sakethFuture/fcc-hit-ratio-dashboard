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

export function computeHitRatio(tranches: Tranche[], closedOnly: boolean): HitRatioStats {
  const pool = closedOnly
    ? tranches.filter((t) => t.hitStatus === 'HIT' || t.hitStatus === 'NOT_HIT')
    : tranches;

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

export type BucketGranularity = 'daily' | 'monthly' | 'quarterly' | 'yearly';

function bucketKey(dateIso: string, granularity: BucketGranularity): string {
  const [y, m] = dateIso.split('-');
  switch (granularity) {
    case 'daily':
      return dateIso;
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
}

export function bucketHitRatio(
  tranches: Tranche[],
  granularity: BucketGranularity,
): TimeBucketStat[] {
  const map = new Map<string, Tranche[]>();
  for (const t of tranches) {
    const key = bucketKey(t.entryDate, granularity);
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([bucket, list]) => {
      const stats = computeHitRatio(list, true);
      return { bucket, total: list.length, hit: stats.hit, hitPct: stats.hitPct };
    })
    .sort((a, b) => (a.bucket < b.bucket ? -1 : 1));
}
