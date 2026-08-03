#!/usr/bin/env python3
"""
Fetches live LTP + historical daily closes for every scrip in ticker_map.json,
cross-checks LTP against NSE India's quote API for actively-held scrips, and
writes data/prices.json + data/historical_closes.json for the static frontend.

Incremental by design: historical closes are only fetched forward from the
last cached date per ticker, not re-downloaded in full each run. On first
sight of a ticker (no cache yet), it backfills from that scrip's earliest
tranche entry date in ledger.json, falling back to DEFAULT_BACKFILL_START.

Usage:
    python scripts/fetch_prices.py [--respect-market-hours] [--full-backfill]
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import requests
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "public" / "data"
TICKER_MAP_PATH = DATA_DIR / "ticker_map.json"
HISTORICAL_CLOSES_PATH = DATA_DIR / "historical_closes.json"
PRICES_PATH = DATA_DIR / "prices.json"
LEDGER_PATH = DATA_DIR / "ledger.json"
CORPORATE_ACTIONS_PATH = DATA_DIR / "corporate_actions.json"

DEFAULT_BACKFILL_START = "2026-04-01"
IST = timezone(timedelta(hours=5, minutes=30))
NSE_DIFF_FLAG_THRESHOLD = 0.01  # 1%


def load_json(path: Path, default):
    if not path.exists():
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def is_nse_market_hours() -> bool:
    now = datetime.now(IST)
    if now.weekday() >= 5:  # Sat/Sun
        return False
    start = now.replace(hour=9, minute=15, second=0, microsecond=0)
    end = now.replace(hour=15, minute=30, second=0, microsecond=0)
    return start <= now <= end


def earliest_entry_dates(ledger: dict | None) -> dict[str, str]:
    """scripSymbol -> earliest tranche entryDate, from ledger.json."""
    if not ledger:
        return {}
    out: dict[str, str] = {}
    for scrip in ledger.get("scrips", []):
        dates = [t["entryDate"] for t in scrip.get("tranches", [])]
        if dates:
            out[scrip["scripSymbol"]] = min(dates)
    return out


def fetch_history(ticker: str, start: str, end: str) -> list[dict]:
    """Returns [{date: iso, close: float}, ...] for [start, end)."""
    df = yf.Ticker(ticker).history(start=start, end=end, interval="1d", auto_adjust=False)
    if df is None or df.empty:
        return []
    out = []
    for idx, row in df.iterrows():
        close = row.get("Close")
        if pd.isna(close):
            continue
        out.append({"date": idx.strftime("%Y-%m-%d"), "close": round(float(close), 4)})
    return out


def fetch_splits(ticker: str) -> list[dict]:
    """Returns [{date: iso, ratio: float}, ...] for every stock split on record.
    Yahoo's close series is retroactively adjusted for all of these, which is
    why the frontend needs them to keep entryPrice comparable to that series."""
    try:
        splits = yf.Ticker(ticker).splits
    except Exception:
        return []
    if splits is None or splits.empty:
        return []
    return [
        {"date": idx.strftime("%Y-%m-%d"), "ratio": float(ratio)}
        for idx, ratio in splits.items()
        if ratio and ratio != 1.0
    ]


def fetch_ltp(ticker: str, cached_history: list[dict]) -> tuple[float | None, str]:
    """Returns (ltp, source). Tries yfinance fast_info, falls back to last cached close."""
    try:
        t = yf.Ticker(ticker)
        fast = t.fast_info
        price = fast.get("lastPrice") if hasattr(fast, "get") else getattr(fast, "last_price", None)
        if price:
            return float(price), "yfinance"
    except Exception:
        pass
    if cached_history:
        return cached_history[-1]["close"], "yfinance"
    return None, "yfinance"


_nse_session: requests.Session | None = None


def _get_nse_session() -> requests.Session:
    global _nse_session
    if _nse_session is not None:
        return _nse_session
    s = requests.Session()
    s.headers.update(
        {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
            ),
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )
    try:
        s.get("https://www.nseindia.com", timeout=10)
    except Exception:
        pass
    _nse_session = s
    return s


def fetch_nse_quote(symbol: str) -> float | None:
    """Best-effort NSE India quote lookup. NSE's WAF frequently blocks
    datacenter IPs (including GitHub Actions runners); failures here are
    expected and non-fatal — the cross-check is a bonus, not a dependency."""
    try:
        session = _get_nse_session()
        resp = session.get(
            f"https://www.nseindia.com/api/quote-equity?symbol={symbol}",
            timeout=10,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        price = data.get("priceInfo", {}).get("lastPrice")
        return float(price) if price is not None else None
    except Exception:
        return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--respect-market-hours", action="store_true")
    parser.add_argument("--full-backfill", action="store_true", help="Re-fetch full history, ignoring cache")
    args = parser.parse_args()

    if args.respect_market_hours and not is_nse_market_hours():
        print("Outside NSE market hours (IST) — skipping run.")
        return 0

    ticker_map: list[dict] = load_json(TICKER_MAP_PATH, [])
    if not ticker_map:
        print(f"No ticker map found at {TICKER_MAP_PATH} — nothing to fetch.", file=sys.stderr)
        return 1

    ledger = load_json(LEDGER_PATH, None)
    entry_dates = earliest_entry_dates(ledger)

    historical: dict[str, list[dict]] = load_json(HISTORICAL_CLOSES_PATH, {})
    corporate_actions: dict[str, list[dict]] = load_json(CORPORATE_ACTIONS_PATH, {})

    # Scrips currently held open, for the NSE cross-check pass.
    active_scrips: set[str] = set()
    if ledger:
        for scrip in ledger.get("scrips", []):
            for t in scrip.get("tranches", []):
                if t.get("remainingQty", 0) > 0:
                    active_scrips.add(scrip["scripSymbol"])

    today = datetime.now(IST).date()
    tomorrow = (today + timedelta(days=1)).isoformat()

    prices: dict[str, dict] = {}
    warnings: list[str] = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for entry in ticker_map:
        scrip = entry["scripSymbol"]
        ticker = entry["yahooTicker"]

        existing = [] if args.full_backfill else historical.get(ticker, [])
        if existing:
            last_date = max(b["date"] for b in existing)
            start = (datetime.strptime(last_date, "%Y-%m-%d").date() + timedelta(days=1)).isoformat()
        else:
            start = entry_dates.get(scrip, DEFAULT_BACKFILL_START)

        new_bars: list[dict] = []
        if start < tomorrow:
            try:
                new_bars = fetch_history(ticker, start, tomorrow)
            except Exception as e:
                warnings.append(f"{ticker}: history fetch failed ({e})")

        if not existing and not new_bars:
            entry["verified"] = False
            entry["manualOverride"] = True
            warnings.append(
                f"{ticker} ({scrip}): no historical data returned — likely a ticker mismatch, needs manual correction in ticker_map.json"
            )
        elif new_bars:
            entry["verified"] = True

        merged = {b["date"]: b["close"] for b in existing}
        for b in new_bars:
            merged[b["date"]] = b["close"]
        combined = [{"date": d, "close": c} for d, c in sorted(merged.items())]
        if combined:
            historical[ticker] = combined

        try:
            splits = fetch_splits(ticker)
            if splits:
                corporate_actions[ticker] = splits
        except Exception as e:
            warnings.append(f"{ticker}: splits fetch failed ({e})")

        ltp, source = fetch_ltp(ticker, combined)
        price_record = {
            "ticker": ticker,
            "ltp": ltp,
            "asOf": now_iso,
            "source": source,
        }

        if ltp is not None and scrip in active_scrips:
            nse_ltp = fetch_nse_quote(scrip)
            if nse_ltp is not None:
                diff_pct = abs(nse_ltp - ltp) / nse_ltp if nse_ltp else 0
                price_record["nseCheckLtp"] = nse_ltp
                price_record["nseCheckDiffPct"] = round(diff_pct * 100, 3)
                price_record["flagged"] = diff_pct > NSE_DIFF_FLAG_THRESHOLD
                if price_record["flagged"]:
                    warnings.append(
                        f"{ticker}: yfinance LTP {ltp} vs NSE {nse_ltp} differ by {diff_pct * 100:.2f}%"
                    )

        if ltp is not None:
            prices[ticker] = price_record

        time.sleep(0.3)  # gentle on both APIs

    save_json(HISTORICAL_CLOSES_PATH, historical)
    save_json(PRICES_PATH, {"generatedAt": now_iso, "prices": prices})
    save_json(TICKER_MAP_PATH, ticker_map)
    save_json(CORPORATE_ACTIONS_PATH, corporate_actions)

    print(f"Updated {len(prices)} live prices, {len(historical)} historical series.")
    if warnings:
        print(f"\n{len(warnings)} warning(s):")
        for w in warnings:
            print(f"  - {w}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
