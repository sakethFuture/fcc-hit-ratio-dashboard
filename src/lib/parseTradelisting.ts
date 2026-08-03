import * as XLSX from 'xlsx';
import type { TradeRow, BuySell } from '../types';

const REQUIRED_HEADERS = ['Trade Date', 'Scrip Symbol', 'Buy/Sell', 'Quantity', 'Net Rate'];

function excelSerialToIso(serial: number): string {
  // Excel's epoch is 1899-12-30 (accounts for the 1900 leap-year bug).
  const utcMs = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(utcMs).toISOString().slice(0, 10);
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    return excelSerialToIso(value);
  }
  const str = String(value ?? '').trim();
  // Expected broker format: DD/MM/YYYY
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Fall back: already ISO or unparseable — return as-is.
  return str;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export interface ParseResult {
  rows: TradeRow[];
  warnings: string[];
}

/**
 * Parses a broker "Equity Tradelisting" export. The file has 8-11 rows of
 * account metadata before the real header row, so we locate the header by
 * scanning for its known column names rather than assuming a fixed offset.
 */
export function parseTradelistingWorkbook(data: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true });
  const sheetName =
    workbook.SheetNames.find((n) => /tradelisting/i.test(n)) ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  const headerRowIdx = raw.findIndex(
    (row) =>
      Array.isArray(row) &&
      REQUIRED_HEADERS.every((h) => row.some((cell) => String(cell ?? '').trim() === h)),
  );

  if (headerRowIdx === -1) {
    throw new Error(
      'Could not locate the Equity Tradelisting header row (expected columns: ' +
        REQUIRED_HEADERS.join(', ') +
        ').',
    );
  }

  const headerRow = raw[headerRowIdx].map((c) => String(c ?? '').trim());
  const colIdx = (name: string) => headerRow.indexOf(name);

  const idx = {
    exchange: colIdx('Exchange'),
    tradeDate: colIdx('Trade Date'),
    scripSymbol: colIdx('Scrip Symbol'),
    tdInd: colIdx('TDInd'),
    buySell: colIdx('Buy/Sell'),
    quantity: colIdx('Quantity'),
    rate: colIdx('Rate'),
    brokeragePerShare: colIdx('Brokerage Per Share'),
    netRate: colIdx('Net Rate'),
    netAmount: colIdx('Net Amount'),
    finalAmount: colIdx('Final Amount'),
  };

  const rows: TradeRow[] = [];
  const warnings: string[] = [];

  for (let r = headerRowIdx + 1; r < raw.length; r++) {
    const row = raw[r];
    if (!row || row.every((c) => c === null || c === undefined || c === '')) continue;

    const scripSymbol = String(row[idx.scripSymbol] ?? '').trim();
    const buySellRaw = String(row[idx.buySell] ?? '').trim().toUpperCase();
    if (!scripSymbol || (buySellRaw !== 'B' && buySellRaw !== 'S')) {
      warnings.push(`Row ${r + 1}: skipped (missing scrip symbol or invalid Buy/Sell "${buySellRaw}")`);
      continue;
    }

    rows.push({
      exchange: String(row[idx.exchange] ?? '').trim(),
      tradeDate: toIsoDate(row[idx.tradeDate]),
      scripSymbol,
      tdInd: String(row[idx.tdInd] ?? '').trim(),
      buySell: buySellRaw as BuySell,
      quantity: toNumber(row[idx.quantity]),
      rate: toNumber(row[idx.rate]),
      brokeragePerShare: toNumber(row[idx.brokeragePerShare]),
      netRate: toNumber(row[idx.netRate]),
      netAmount: toNumber(row[idx.netAmount]),
      finalAmount: toNumber(row[idx.finalAmount]),
      fileOrder: r,
    });
  }

  return { rows, warnings };
}

export interface AccountMetadata {
  name: string | null;
  clientCode: string | null;
  statementPeriod: string | null;
}

export function parseAccountMetadata(data: ArrayBuffer): AccountMetadata {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  let name: string | null = null;
  let clientCode: string | null = null;
  let statementPeriod: string | null = null;

  for (const row of raw.slice(0, 12)) {
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] ?? '').trim();
      if (/^NAME\s*:-/i.test(cell)) name = String(row[c + 1] ?? '').trim() || name;
      if (/^CLIENT CODE\s*:-/i.test(cell)) clientCode = String(row[c + 1] ?? '').trim() || clientCode;
      if (/^Statement period/i.test(cell)) statementPeriod = cell.replace(/^Statement period\s*/i, '').trim();
    }
  }

  return { name, clientCode, statementPeriod };
}
