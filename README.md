# FCC Hit Ratio Dashboard

Tranche-level hit ratio analysis for FCC's prop equity trading. Every buy is
tracked as its own position ("tranche"); a tranche is a **Hit** if its daily
close ever reaches entry price × 1.15.

## How it works

- **Upload** the broker's "Equity Tradelisting" export (a full cumulative
  statement, Apr 1 → today) in the dashboard. Parsing and tranche
  construction run entirely client-side (`xlsx` + the engine in `src/lib/`).
- The engine groups same-day buys into tranches, applies sells strictly FIFO
  across tranches, and classifies each as Hit / Hit — still running / Not Hit
  / Active against a cached daily-close series.
- Historical closes, live prices, and stock-split data are fetched by
  `scripts/fetch_prices.py` (yfinance + an NSE India cross-check) and
  committed to `public/data/*.json` by the scheduled
  `.github/workflows/fetch-prices.yml` GitHub Action — the static site itself
  has no backend and just reads those JSON files.
- Uploading a new statement rebuilds `ledger.json` from scratch (replace, not
  merge — the file is cumulative) and auto-publishes it back to the repo via
  the GitHub Contents API, using a personal access token stored only in your
  browser's `localStorage`.

## Local development

```bash
npm install
npm run dev
```

## Price-fetch script

```bash
pip install -r scripts/requirements.txt
python scripts/fetch_prices.py               # incremental fetch
python scripts/fetch_prices.py --full-backfill   # re-fetch full history
```

## Ticker mapping

`public/data/ticker_map.json` maps each broker scrip symbol to a Yahoo Finance
ticker (`SYMBOL.NS` / `SYMBOL.BO`). The fetch script flags any symbol yfinance
can't resolve (`verified: false`, `manualOverride: true`) — fix those by hand
in that file.

## Known limitation

Stock splits are corrected for in hit/miss classification (entry price is
deflated by the cumulative split ratio to match Yahoo's retroactively
adjusted close series — see `splitAdjustmentFactor` in
`src/lib/hitClassification.ts`). Realized P&L uses raw broker trade prices
and is unaffected. Unrealized P&L on a tranche that's still open *and* has
split since entry assumes the held share count scales with the split, since
the broker statement itself won't show a new "buy" row for the bonus shares.
