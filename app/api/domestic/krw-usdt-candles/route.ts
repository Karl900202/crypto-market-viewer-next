import { NextRequest, NextResponse } from "next/server";
import {
  CHART_TIMEFRAME_ORDER,
  type ChartTimeframe,
} from "@/lib/chart-timeframe";

/** Binance `KlineCandleJson`과 동일 — `volumeQuote`는 KRW 거래대금 */
export type DomesticKrwCandleJson = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeQuote: number;
};

const UPBIT_BASE = "https://api.upbit.com/v1/candles";
const BITHUMB_PAIR = "USDT_KRW";
const COINONE_CHART = "https://api.coinone.co.kr/public/v2/chart/krw/usdt";

const COUNT = 200;

const TF_SET = new Set<string>(CHART_TIMEFRAME_ORDER);

const EXCHANGE_SET = new Set(["upbit", "bithumb", "coinone"]);

function isChartTimeframe(s: string): s is ChartTimeframe {
  return TF_SET.has(s);
}

type UpbitMinuteCandle = {
  timestamp: number;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_price: number;
};

function upbitToRows(rows: UpbitMinuteCandle[]): DomesticKrwCandleJson[] {
  const out: DomesticKrwCandleJson[] = [];
  for (const c of rows) {
    out.push({
      time: Math.floor(c.timestamp / 1000),
      open: c.opening_price,
      high: c.high_price,
      low: c.low_price,
      close: c.trade_price,
      volumeQuote: c.candle_acc_trade_price,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** 분봉 unit — Upbit는 10분 봉 제공 */
function upbitMinuteUnit(tf: ChartTimeframe): number {
  switch (tf) {
    case "1m":
      return 1;
    case "3m":
      return 3;
    case "5m":
      return 5;
    case "10m":
      return 10;
    case "15m":
      return 15;
    case "30m":
      return 30;
    case "60m":
      return 60;
    default:
      return 5;
  }
}

function upbitPathForTimeframe(tf: ChartTimeframe):
  | { kind: "minutes"; unit: number }
  | { kind: "days" }
  | { kind: "weeks" }
  | { kind: "months" } {
  switch (tf) {
    case "1m":
    case "3m":
    case "5m":
    case "10m":
    case "15m":
    case "30m":
    case "60m":
      return { kind: "minutes", unit: upbitMinuteUnit(tf) };
    case "1D":
      return { kind: "days" };
    case "1W":
      return { kind: "weeks" };
    case "1Mo":
    case "1Y":
      return { kind: "months" };
  }
}

async function fetchUpbit(
  tf: ChartTimeframe,
  beforeSec: number | null,
): Promise<DomesticKrwCandleJson[]> {
  const spec = upbitPathForTimeframe(tf);
  const market = "KRW-USDT";
  let url: URL;

  if (spec.kind === "minutes") {
    url = new URL(`${UPBIT_BASE}/minutes/${spec.unit}`);
  } else {
    url = new URL(`${UPBIT_BASE}/${spec.kind}`);
  }

  url.searchParams.set("market", market);
  url.searchParams.set("count", String(COUNT));

  if (beforeSec !== null) {
    const toMs = beforeSec * 1000 - 1;
    url.searchParams.set("to", new Date(toMs).toISOString());
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Upbit candles: ${res.status}`);
  }
  const raw = (await res.json()) as UpbitMinuteCandle[];
  if (!Array.isArray(raw)) {
    throw new Error("Upbit: invalid response");
  }
  return upbitToRows(raw);
}

/** 빗썸 `chart_intervals` — 일봉 이상은 24h 봉으로 길게 받음 */
function bithumbInterval(tf: ChartTimeframe): string {
  switch (tf) {
    case "1m":
      return "1m";
    case "3m":
      return "3m";
    case "5m":
      return "5m";
    case "10m":
      return "10m";
    case "15m":
      return "30m";
    case "30m":
      return "30m";
    case "60m":
      return "1h";
    case "1D":
    case "1W":
    case "1Mo":
    case "1Y":
      return "24h";
    default:
      return "5m";
  }
}

async function fetchBithumb(
  tf: ChartTimeframe,
  beforeSec: number | null,
): Promise<DomesticKrwCandleJson[]> {
  const interval = bithumbInterval(tf);
  const url = `https://api.bithumb.com/public/candlestick/${BITHUMB_PAIR}/${interval}`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Bithumb candlestick: ${res.status}`);
  }
  const json = (await res.json()) as {
    status?: string;
    data?: string[][];
  };
  if (json.status !== "0000" || !Array.isArray(json.data)) {
    throw new Error("Bithumb: invalid response");
  }

  const rows: DomesticKrwCandleJson[] = [];
  for (const row of json.data) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const tMs = Number.parseInt(row[0]!, 10);
    const timeSec = Math.floor(tMs / 1000);
    const close = Number.parseFloat(row[4]!);
    const baseVol = Number.parseFloat(row[5]!);
    if (beforeSec !== null && timeSec >= beforeSec) continue;
    rows.push({
      time: timeSec,
      open: Number.parseFloat(row[1]!),
      high: Number.parseFloat(row[2]!),
      low: Number.parseFloat(row[3]!),
      close,
      volumeQuote: close * baseVol,
    });
  }

  rows.sort((a, b) => a.time - b.time);

  if (beforeSec !== null) {
    return rows.filter((r) => r.time < beforeSec);
  }
  return rows;
}

/** 코인원 `interval` — 10m 없음 → 15m */
function coinoneInterval(tf: ChartTimeframe): string {
  switch (tf) {
    case "1m":
      return "1m";
    case "3m":
      return "3m";
    case "5m":
      return "5m";
    case "10m":
      return "15m";
    case "15m":
      return "15m";
    case "30m":
      return "30m";
    case "60m":
      return "1h";
    case "1D":
      return "1d";
    case "1W":
      return "1w";
    case "1Mo":
    case "1Y":
      return "1d";
    default:
      return "5m";
  }
}

type CoinoneChartRow = {
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  quote_volume: string;
};

async function fetchCoinone(
  tf: ChartTimeframe,
  beforeSec: number | null,
): Promise<DomesticKrwCandleJson[]> {
  const interval = coinoneInterval(tf);
  const url = new URL(COINONE_CHART);
  url.searchParams.set("interval", interval);
  if (beforeSec !== null) {
    url.searchParams.set("timestamp", String(beforeSec * 1000 - 1));
  }

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Coinone chart: ${res.status}`);
  }
  const json = (await res.json()) as {
    result?: string;
    chart?: CoinoneChartRow[];
  };
  if (json.result !== "success" || !Array.isArray(json.chart)) {
    throw new Error("Coinone: invalid response");
  }

  const rows: DomesticKrwCandleJson[] = [];
  for (const c of json.chart) {
    const timeSec = Math.floor(c.timestamp / 1000);
    if (beforeSec !== null && timeSec >= beforeSec) continue;
    rows.push({
      time: timeSec,
      open: Number.parseFloat(c.open),
      high: Number.parseFloat(c.high),
      low: Number.parseFloat(c.low),
      close: Number.parseFloat(c.close),
      volumeQuote: Number.parseFloat(c.quote_volume),
    });
  }
  rows.sort((a, b) => a.time - b.time);
  return rows;
}

export async function GET(request: NextRequest) {
  const exchange = request.nextUrl.searchParams.get("exchange")?.trim().toLowerCase();
  const tfRaw = request.nextUrl.searchParams.get("timeframe")?.trim() ?? "";
  const beforeParam = request.nextUrl.searchParams.get("beforeTime");

  if (!exchange || !EXCHANGE_SET.has(exchange)) {
    return NextResponse.json(
      { error: "exchange must be upbit, bithumb, or coinone" },
      { status: 400 },
    );
  }

  if (!isChartTimeframe(tfRaw)) {
    return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 });
  }
  const timeframe = tfRaw;

  let beforeSec: number | null = null;
  if (beforeParam !== null && beforeParam.trim() !== "") {
    const n = Number.parseInt(beforeParam.trim(), 10);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json(
        { error: "Invalid beforeTime (unix seconds)" },
        { status: 400 },
      );
    }
    beforeSec = n;
  }

  try {
    let candles: DomesticKrwCandleJson[];

    if (exchange === "upbit") {
      candles = await fetchUpbit(timeframe, beforeSec);
    } else if (exchange === "bithumb") {
      candles = await fetchBithumb(timeframe, beforeSec);
    } else {
      candles = await fetchCoinone(timeframe, beforeSec);
    }

    const byTime = new Map<number, DomesticKrwCandleJson>();
    for (const c of candles) {
      if (!byTime.has(c.time)) {
        byTime.set(c.time, c);
      }
    }
    candles = [...byTime.values()].sort((a, b) => a.time - b.time);

    return NextResponse.json({ candles, volumeQuoteCurrency: "KRW" as const });
  } catch (e) {
    console.error("domestic krw-usdt candles:", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to fetch candles",
      },
      { status: 502 },
    );
  }
}
