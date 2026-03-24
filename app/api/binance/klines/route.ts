import { NextRequest, NextResponse } from "next/server";

/** Binance `GET /api/v3/klines` — 서버에서만 호출 (CORS 회피) */
const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";

/** `BTCUSDT` 형태 (영숫자만, 길이 제한) */
const SYMBOL_RE = /^[A-Z0-9]{5,24}$/;

const ALLOWED_INTERVALS = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "8h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

/** 뷰 범위 (쿼리 `range`) — 히스토리 시작 시각 = now − rangeMs */
const RANGE_MS: Record<string, number> = {
  "1d": 86400000,
  "1w": 7 * 86400000,
  "1mo": 30 * 86400000,
  "1y": 365 * 86400000,
  "2y": 2 * 365 * 86400000,
  "5y": 5 * 365 * 86400000,
  "10y": 10 * 365 * 86400000,
};

type BinanceKlineRow = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

export type KlineCandleJson = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Quote asset volume (USDT) */
  volumeQuote: number;
};

function mapRow(row: BinanceKlineRow): KlineCandleJson {
  return {
    time: Math.floor(row[0] / 1000),
    open: Number.parseFloat(row[1]),
    high: Number.parseFloat(row[2]),
    low: Number.parseFloat(row[3]),
    close: Number.parseFloat(row[4]),
    volumeQuote: Number.parseFloat(row[7]),
  };
}

async function fetchKlinesPage(
  symbol: string,
  interval: string,
  endTime: number,
  limit: number,
): Promise<BinanceKlineRow[]> {
  const url = new URL(BINANCE_KLINES);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("endTime", String(endTime));
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Binance error: ${response.status}`);
  }

  return (await response.json()) as BinanceKlineRow[];
}

const BEFORE_TIME_MAX_PAGES = 12;

/**
 * `beforeSec`보다 이전에 연 봉만 모음. 한 페이지(최대 1000개)만 받으면
 * 전부가 `time >= beforeSec`(중복)로 걸러져 빈 배열이 되는 경우가 있어
 * endTime을 더 과거로 넘기며 여러 번 받는다.
 */
async function fetchKlinesBeforeTime(
  symbol: string,
  interval: string,
  beforeSec: number,
): Promise<KlineCandleJson[]> {
  const byTime = new Map<number, KlineCandleJson>();
  let endMs = beforeSec * 1000 - 1;

  for (let page = 0; page < BEFORE_TIME_MAX_PAGES; page++) {
    const raw = await fetchKlinesPage(symbol, interval, endMs, 1000);
    if (raw.length === 0) break;

    for (const row of raw) {
      const c = mapRow(row);
      if (c.time < beforeSec) {
        byTime.set(c.time, c);
      }
    }

    if (raw.length < 1000) break;

    const oldestOpen = raw[0][0];
    const nextEnd = oldestOpen - 1;
    if (nextEnd >= endMs) break;
    endMs = nextEnd;

    if (byTime.size > 0) break;
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

/**
 * `endTime` 기준 과거로 페이지네이션해 `rangeStart` 이후 봉만 합침.
 * 상한 페이지 수 없음 — `rangeStart` 이전까지 또는 Binance가 더 줄 데이터가 없을 때까지 반복.
 */
async function fetchKlinesForRange(
  symbol: string,
  interval: string,
  rangeStart: number,
): Promise<KlineCandleJson[]> {
  const now = Date.now();
  let endTime = now;
  const byTime = new Map<number, KlineCandleJson>();

  for (;;) {
    const raw = await fetchKlinesPage(symbol, interval, endTime, 1000);
    if (raw.length === 0) break;

    for (const row of raw) {
      const openMs = row[0];
      if (openMs < rangeStart || openMs > now) continue;
      const c = mapRow(row);
      byTime.set(c.time, c);
    }

    const oldestOpen = raw[0][0];
    if (oldestOpen <= rangeStart) break;
    endTime = oldestOpen - 1;
    if (raw.length < 1000) break;
  }

  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  const interval =
    request.nextUrl.searchParams.get("interval")?.trim() ?? "1h";
  const rangeKey = request.nextUrl.searchParams.get("range")?.trim().toLowerCase();
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(
    1000,
    Math.max(10, limitRaw ? Number.parseInt(limitRaw, 10) : 300),
  );

  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json(
      { error: "Invalid or missing symbol (e.g. BTCUSDT)" },
      { status: 400 },
    );
  }

  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: "Invalid interval" },
      { status: 400 },
    );
  }

  try {
    /** 과거 추가 로드: `beforeTime`(Unix 초)보다 이전에 열린 봉만 최대 1000개 */
    const beforeParam = request.nextUrl.searchParams.get("beforeTime");
    if (beforeParam !== null && beforeParam.trim() !== "") {
      const beforeSec = Number.parseInt(beforeParam.trim(), 10);
      if (!Number.isFinite(beforeSec) || beforeSec <= 0) {
        return NextResponse.json(
          { error: "Invalid beforeTime (unix seconds)" },
          { status: 400 },
        );
      }
      const candles = await fetchKlinesBeforeTime(symbol, interval, beforeSec);
      return NextResponse.json({ candles });
    }

    if (rangeKey && rangeKey in RANGE_MS) {
      const rangeMs = RANGE_MS[rangeKey];
      if (!rangeMs) {
        return NextResponse.json({ error: "Invalid range" }, { status: 400 });
      }
      const rangeStart = Date.now() - rangeMs;
      const candles = await fetchKlinesForRange(symbol, interval, rangeStart);
      return NextResponse.json({ candles });
    }

    if (!Number.isFinite(limit)) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }

    const url = new URL(BINANCE_KLINES);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url.toString(), {
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Binance error: ${response.status}` },
        { status: 502 },
      );
    }

    const raw = (await response.json()) as BinanceKlineRow[];
    const candles: KlineCandleJson[] = raw.map(mapRow);

    return NextResponse.json({ candles });
  } catch (error) {
    console.error("binance klines:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch klines",
      },
      { status: 500 },
    );
  }
}
