"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  HistogramSeries,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  CHART_HIGHER_ORDER,
  CHART_MINUTE_ORDER,
  type ChartTimeframe,
  isMinuteTimeframe,
  timeframeToBinanceInterval,
  timeframeToRangeKey,
  timeframeUses15mInsteadOf10m,
} from "@/lib/chart-timeframe";
import { MARKET_COLOR_DOWN, MARKET_COLOR_UP } from "@/lib/market-colors";
import { useThemeStore } from "@/stores/useThemeStore";

export type { ChartTimeframe };

const TIMEFRAME_LABEL_KEY: Record<ChartTimeframe, string> = {
  "1m": "chart.int1m",
  "3m": "chart.int3m",
  "5m": "chart.int5m",
  "10m": "chart.int10m",
  "15m": "chart.int15m",
  "30m": "chart.int30m",
  "60m": "chart.int60m",
  "1D": "chart.range1d",
  "1W": "chart.range1w",
  "1Mo": "chart.range1mo",
  "1Y": "chart.range1y",
};

const BINANCE_WS = "wss://stream.binance.com:9443/ws";

/** 직전 봉보다 거래량 많음(상승색) / 적음(하락색) — 코인 테이블과 동일 HEX */
const VOL_UP = MARKET_COLOR_UP;
const VOL_DOWN = MARKET_COLOR_DOWN;

/**
 * 캔들/거래량 세로 비율 — lightweight-charts `scaleMargins`와 오버레이(선·라벨)를 동일 값으로 맞춤.
 * 히스토그램은 자동 스케일로 **패널 높이를 꽉 채우므로** 최대 막대 상단이 패널 상단에 붙음.
 * 구분선은 빈 띠 **중앙**이므로, 거래량 패널을 충분히 **아래로** 내려 최대 막대 꼭대기가
 * 구분선보다 **분명히 아래**에 오게 함.
 */
const CHART_CANDLE_MARGIN_BOTTOM = 0.3;
/** 거래량 축 상단 여백(전체 차트 높이 대비) — 값이 클수록 거래량 영역이 아래로 붙고 막대가 짧아짐 */
const CHART_VOLUME_MARGIN_TOP = 0.86;

function candlePaneBottomPct(): number {
  return (1 - CHART_CANDLE_MARGIN_BOTTOM) * 100;
}

function volumePaneTopPct(): number {
  return CHART_VOLUME_MARGIN_TOP * 100;
}

function volumeDividerLinePct(): number {
  return (candlePaneBottomPct() + volumePaneTopPct()) / 2;
}

function applyPriceScaleMargins(chart: IChartApi, theme: "light" | "dark") {
  const layout = layoutForTheme(theme);
  chart.priceScale("right").applyOptions({
    scaleMargins: { top: 0.05, bottom: CHART_CANDLE_MARGIN_BOTTOM },
    borderColor: layout.rightPriceScale.borderColor,
  });
  chart.priceScale("volume").applyOptions({
    scaleMargins: { top: CHART_VOLUME_MARGIN_TOP, bottom: 0 },
    borderVisible: false,
  });
}

function getPrevVolumeFromMap(
  map: Map<number, number>,
  timeSec: number,
): number | null {
  let bestT = -Infinity;
  let best: number | null = null;
  for (const t of map.keys()) {
    if (t < timeSec && t > bestT) {
      bestT = t;
      best = map.get(t) ?? null;
    }
  }
  return best;
}

function buildVolumeHistogramFromCandles(
  candles: { time: number; volumeQuote?: number }[],
): HistogramData[] {
  const out: HistogramData[] = [];
  for (let i = 0; i < candles.length; i++) {
    const v = candles[i].volumeQuote ?? 0;
    const prev = i > 0 ? (candles[i - 1].volumeQuote ?? 0) : null;
    const color = prev === null ? VOL_DOWN : v > prev ? VOL_UP : VOL_DOWN;
    out.push({
      time: candles[i].time as UTCTimestamp,
      value: v,
      color,
    });
  }
  return out;
}

type LegendState = {
  timeSec: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeQuote: number | null;
};

/** REST + WS와 동기화되는 봉(거래량 포함) — 과거 추가 로드 시 병합 */
type CandleRow = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeQuote: number;
};

type BinanceKlineWsPayload = {
  e?: string;
  k?: {
    t: number;
    T: number;
    s: string;
    i: string;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    q: string;
    x: boolean;
  };
};

function layoutForTheme(theme: "light" | "dark") {
  if (theme === "dark") {
    return {
      layout: {
        background: { type: ColorType.Solid, color: "#111827" },
        textColor: "#d1d5db",
        fontSize: 11,
        fontFamily:
          'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
      },
      grid: {
        vertLines: { color: "rgba(55, 65, 81, 0.6)" },
        horzLines: { color: "rgba(55, 65, 81, 0.6)" },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { color: "#6b7280", width: 1 as const },
        horzLine: { color: "#6b7280", width: 1 as const },
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
      timeScale: {
        borderColor: "#374151",
        timeVisible: true,
        secondsVisible: false,
      },
    };
  }
  return {
    layout: {
      background: { type: ColorType.Solid, color: "#ffffff" },
      textColor: "#374151",
      fontSize: 11,
      fontFamily:
        'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
    },
    grid: {
      vertLines: { color: "#e5e7eb" },
      horzLines: { color: "#e5e7eb" },
    },
    crosshair: {
      mode: CrosshairMode.Magnet,
      vertLine: { color: "#9ca3af", width: 1 as const },
      horzLine: { color: "#9ca3af", width: 1 as const },
    },
    rightPriceScale: {
      borderColor: "#e5e7eb",
    },
    timeScale: {
      borderColor: "#e5e7eb",
      timeVisible: true,
      secondsVisible: false,
    },
  };
}

function formatLegendPrice(n: number) {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  const max =
    abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : abs >= 0.0001 ? 8 : 10;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: max,
  });
}

function formatVolumeQuote(v: number) {
  if (!Number.isFinite(v)) return "-";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`;
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** 시가 대비 값 — 고/저/종 색상용 */
type OpenDir = "up" | "down" | "flat";

function cmpToOpen(open: number, value: number): OpenDir {
  if (!Number.isFinite(open) || !Number.isFinite(value)) return "flat";
  const eps = Math.max(Math.abs(open), 1e-12) * 1e-9;
  if (value > open + eps) return "up";
  if (value < open - eps) return "down";
  return "flat";
}

function legendValueStyle(dir: OpenDir): React.CSSProperties | undefined {
  if (dir === "up") return { color: MARKET_COLOR_UP };
  if (dir === "down") return { color: MARKET_COLOR_DOWN };
  return undefined;
}

function legendValueClass(dir: OpenDir): string {
  return dir === "flat"
    ? "text-gray-900 dark:text-white"
    : "";
}

/** 시가 대비 등락율 — 고/저/종 행 괄호 표기용 */
function formatPctFromOpen(open: number, value: number): string {
  if (!Number.isFinite(open) || !Number.isFinite(value)) return "—";
  if (Math.abs(open) <= 1e-12) return "—";
  const pct = ((value - open) / open) * 100;
  if (pct === 0) return "0.00%";
  return pct > 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`;
}

/** 종가 전용: 시가 대비 금액 + 등락율 (거래량 위 한 줄) */
function formatDeltaFromOpen(open: number, close: number): string | null {
  if (!Number.isFinite(open) || !Number.isFinite(close)) return null;
  const delta = close - open;
  const absOpen = Math.abs(open);
  const pct = absOpen > 1e-12 ? (delta / open) * 100 : 0;
  const num =
    delta === 0
      ? formatLegendPrice(0)
      : delta > 0
        ? `+${formatLegendPrice(delta)}`
        : formatLegendPrice(delta);
  const pctStr =
    pct === 0
      ? "0.00%"
      : pct > 0
        ? `+${pct.toFixed(2)}%`
        : `${pct.toFixed(2)}%`;
  return `${num} (${pctStr})`;
}

/**
 * `getVisibleRange()` / `setVisibleRange`의 `Time` — 일봉 등에서 `BusinessDay` 객체가 올 수 있음.
 * 숫자만 처리하면 `fromSec === null` → 과거 캔들 추가 로드가 영구히 안 됨.
 */
function timeToUnixSeconds(t: Time): number | null {
  if (typeof t === "number" && Number.isFinite(t)) return t;
  if (typeof t === "string") {
    const n = Number.parseFloat(t);
    if (Number.isFinite(n)) return n;
    const parsed = Date.parse(t);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
    return null;
  }
  if (
    typeof t === "object" &&
    t !== null &&
    "year" in t &&
    "month" in t &&
    "day" in t
  ) {
    const bd = t as { year: number; month: number; day: number };
    if (
      Number.isFinite(bd.year) &&
      Number.isFinite(bd.month) &&
      Number.isFinite(bd.day)
    ) {
      return Math.floor(Date.UTC(bd.year, bd.month - 1, bd.day) / 1000);
    }
  }
  return null;
}

/** setData 후에도 사용자가 맞춘 가로 확대/축소(시간 범위) 유지 (종목 변경·첫 로드 시에만 fit) */
function restoreOrFitVisibleRange(
  chart: IChartApi,
  data: CandlestickData[],
  saved: { from: Time; to: Time } | null,
  resetZoom: boolean,
) {
  const ts = chart.timeScale();
  if (data.length === 0) {
    return;
  }
  const tMin = data[0].time as number;
  const tMax = data[data.length - 1].time as number;

  if (resetZoom || !saved) {
    ts.fitContent();
    return;
  }

  const fromSec = timeToUnixSeconds(saved.from);
  const toSec = timeToUnixSeconds(saved.to);
  if (fromSec === null || toSec === null || fromSec >= toSec) {
    ts.fitContent();
    return;
  }

  const from = Math.max(fromSec, tMin);
  const to = Math.min(toSec, tMax);
  if (from < to) {
    ts.setVisibleRange({
      from: from as UTCTimestamp,
      to: to as UTCTimestamp,
    });
  } else {
    ts.fitContent();
  }
}

/**
 * 같은 종목에서 분/일/주/월/연 봉만 바뀔 때: 화면에 보이던 **봉 개수(논리 폭 to−from)** 를 유지.
 * 최신 봉을 오른쪽에 맞추고, 폭만큼 왼쪽으로 펼친다. 데이터가 부족하면 가능한 만큼만.
 */
function restoreVisibleLogicalPreserveBarCount(
  chart: IChartApi,
  data: CandlestickData[],
  saved: { from: number; to: number } | null,
): boolean {
  if (
    data.length === 0 ||
    saved === null ||
    !Number.isFinite(saved.from) ||
    !Number.isFinite(saved.to)
  ) {
    return false;
  }
  const span = Math.max(0.5, saved.to - saved.from);
  const maxIdx = Math.max(0, data.length - 1);

  let newFrom: number;
  let newTo: number;

  if (span >= maxIdx) {
    newFrom = 0;
    newTo = maxIdx;
  } else {
    newTo = maxIdx;
    newFrom = newTo - span;
    if (newFrom < 0) {
      newFrom = 0;
      newTo = Math.min(maxIdx, span);
    }
  }

  if (newFrom >= newTo) {
    return false;
  }
  try {
    chart.timeScale().setVisibleLogicalRange({ from: newFrom, to: newTo });
    return true;
  } catch {
    return false;
  }
}

export type CandlestickChartProps = {
  symbol: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CandlestickChart({ symbol, t }: CandlestickChartProps) {
  const theme = useThemeStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const volumeByTimeRef = useRef<Map<number, number>>(new Map());
  const mergedCandlesRef = useRef<CandleRow[]>([]);
  const loadingMorePastRef = useRef(false);
  const noMorePastRef = useRef(false);
  const prevLoadedViewRef = useRef<{
    symbol: string;
    timeframe: ChartTimeframe;
  } | null>(null);
  /** 차트 마운트 시 한 번만 구독하고, 실제 로직은 데이터 이펙트가 ref로 갱신 */
  const visibleRangeListenerRef = useRef<() => void>(() => {});

  const [timeframe, setTimeframe] = useState<ChartTimeframe>("5m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legend, setLegend] = useState<LegendState | null>(null);
  const [wsLive, setWsLive] = useState(false);

  const binanceSymbol = useMemo(
    () => `${symbol.trim().toUpperCase()}USDT`,
    [symbol],
  );

  const binanceInterval = useMemo(
    () => timeframeToBinanceInterval(timeframe),
    [timeframe],
  );

  const rangeKey = useMemo(() => timeframeToRangeKey(timeframe), [timeframe]);

  const applyTheme = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.applyOptions(layoutForTheme(theme));
    applyPriceScaleMargins(chart, theme);
  }, [theme]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      ...layoutForTheme(theme),
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      priceScaleId: "right",
      upColor: MARKET_COLOR_UP,
      downColor: MARKET_COLOR_DOWN,
      borderVisible: false,
      wickUpColor: MARKET_COLOR_UP,
      wickDownColor: MARKET_COLOR_DOWN,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume", precision: 2, minMove: 0.01 },
      lastValueVisible: false,
      priceLineVisible: false,
      color: VOL_DOWN,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeSeriesRef.current = volumeSeries;

    applyPriceScaleMargins(chart, theme);

    const onVisibleTimeRangeBridge = () => {
      visibleRangeListenerRef.current();
    };
    chart
      .timeScale()
      .subscribeVisibleTimeRangeChange(onVisibleTimeRangeBridge);
    chart
      .timeScale()
      .subscribeVisibleLogicalRangeChange(onVisibleTimeRangeBridge);

    const onCrosshairMove = (param: MouseEventParams) => {
      const s = seriesRef.current;
      if (!s || param.time === undefined || param.point === undefined) {
        setLegend(null);
        return;
      }
      const item = param.seriesData.get(s);
      if (
        !item ||
        typeof item !== "object" ||
        !("open" in item) ||
        !("close" in item)
      ) {
        setLegend(null);
        return;
      }
      const c = item as CandlestickData;
      const timeSec =
        typeof param.time === "number"
          ? param.time
          : typeof param.time === "string"
            ? Number.parseInt(param.time, 10)
            : null;
      if (timeSec === null || Number.isNaN(timeSec)) {
        setLegend(null);
        return;
      }
      const vol = volumeByTimeRef.current.get(timeSec);
      setLegend({
        timeSec,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volumeQuote: vol ?? null,
      });
    };

    chart.subscribeCrosshairMove(onCrosshairMove);

    return () => {
      chart
        .timeScale()
        .unsubscribeVisibleTimeRangeChange(onVisibleTimeRangeBridge);
      chart
        .timeScale()
        .unsubscribeVisibleLogicalRangeChange(onVisibleTimeRangeBridge);
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      chartRef.current = null;
      seriesRef.current = null;
      volumeSeriesRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const streamName = `${binanceSymbol.toLowerCase()}@kline_${binanceInterval}`;
    const wsUrl = `${BINANCE_WS}/${streamName}`;

    function applyKlineUpdate(k: NonNullable<BinanceKlineWsPayload["k"]>) {
      if (k.s !== binanceSymbol) return;
      if (k.i !== binanceInterval) return;

      const timeSec = Math.floor(k.t / 1000) as UTCTimestamp;
      const candle: CandlestickData = {
        time: timeSec,
        open: Number.parseFloat(k.o),
        high: Number.parseFloat(k.h),
        low: Number.parseFloat(k.l),
        close: Number.parseFloat(k.c),
      };

      const vol = Number.parseFloat(k.q);
      const prevVol = getPrevVolumeFromMap(
        volumeByTimeRef.current,
        timeSec as number,
      );
      if (Number.isFinite(vol)) {
        volumeByTimeRef.current.set(timeSec as number, vol);
      }

      const s = seriesRef.current;
      const vs = volumeSeriesRef.current;
      if (!s || cancelled) return;
      s.update(candle);
      if (vs && Number.isFinite(vol)) {
        const vColor = prevVol !== null && vol > prevVol ? VOL_UP : VOL_DOWN;
        vs.update({
          time: timeSec,
          value: vol,
          color: vColor,
        });
      }

      const rows = mergedCandlesRef.current;
      const ri = rows.findIndex((r) => r.time === (timeSec as number));
      const row: CandleRow = {
        time: timeSec as number,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volumeQuote: Number.isFinite(vol) ? vol : 0,
      };
      if (ri >= 0) {
        rows[ri] = row;
      } else if (
        rows.length === 0 ||
        (timeSec as number) > rows[rows.length - 1].time
      ) {
        rows.push(row);
        rows.sort((a, b) => a.time - b.time);
      }
    }

    const LOAD_PAST_CHAIN_MAX = 6;

    async function loadMorePast() {
      if (cancelled || loadingMorePastRef.current || noMorePastRef.current) {
        return;
      }
      if (mergedCandlesRef.current.length === 0) return;

      loadingMorePastRef.current = true;
      try {
        for (let chain = 0; chain < LOAD_PAST_CHAIN_MAX; chain++) {
          if (cancelled || noMorePastRef.current) break;

          const merged = mergedCandlesRef.current;
          if (merged.length === 0) break;
          const oldest = merged[0].time;

          const res = await fetch(
            `/api/binance/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${encodeURIComponent(binanceInterval)}&beforeTime=${encodeURIComponent(String(oldest))}`,
            { cache: "no-store" },
          );
          const json = (await res.json()) as {
            candles?: {
              time: number;
              open: number;
              high: number;
              low: number;
              close: number;
              volumeQuote?: number;
            }[];
            error?: string;
          };
          if (!res.ok) {
            throw new Error(json.error ?? `HTTP ${res.status}`);
          }
          const incoming = json.candles ?? [];
          if (incoming.length === 0) {
            noMorePastRef.current = true;
            break;
          }

          const prevMap = new Map<number, CandleRow>();
          for (const c of merged) {
            prevMap.set(c.time, c);
          }
          for (const c of incoming) {
            if (!prevMap.has(c.time)) {
              prevMap.set(c.time, {
                time: c.time,
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                volumeQuote: c.volumeQuote ?? 0,
              });
            }
          }
          const next = [...prevMap.values()].sort((a, b) => a.time - b.time);
          mergedCandlesRef.current = next;

          const volMap = new Map<number, number>();
          for (const c of next) {
            volMap.set(c.time, c.volumeQuote);
          }
          volumeByTimeRef.current = volMap;

          const s = seriesRef.current;
          const vs = volumeSeriesRef.current;
          const chart = chartRef.current;
          if (!s || !chart) break;

          const data: CandlestickData[] = next.map((c) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }));
          const saved = chart.timeScale().getVisibleRange();
          s.setData(data);
          vs?.setData(buildVolumeHistogramFromCandles(next));
          if (saved) {
            const fromSec = timeToUnixSeconds(saved.from);
            const toSec = timeToUnixSeconds(saved.to);
            if (fromSec !== null && toSec !== null && fromSec < toSec) {
              chart.timeScale().setVisibleRange({
                from: saved.from,
                to: saved.to,
              });
            }
          }
        }
      } catch {
        /* ignore */
      } finally {
        loadingMorePastRef.current = false;
      }
    }

    let visibleDebounce: ReturnType<typeof setTimeout> | null = null;
    const onVisibleTimeRangeChange = () => {
      if (visibleDebounce !== null) clearTimeout(visibleDebounce);
      visibleDebounce = setTimeout(() => {
        visibleDebounce = null;
        if (cancelled) return;
        const chart = chartRef.current;
        if (!chart) return;
        const merged = mergedCandlesRef.current;
        if (merged.length === 0) return;

        /** 시간축 from은 데이터에 맞춰 잡혀 `from < oldest`가 안 나오는 경우가 많음 → 논리 인덱스로 판단 */
        const logical = chart.timeScale().getVisibleLogicalRange();
        let needPast =
          logical !== null &&
          Number.isFinite(logical.from) &&
          logical.from < 30;

        if (!needPast) {
          const vr = chart.timeScale().getVisibleRange();
          if (!vr) return;
          const fromSec = timeToUnixSeconds(vr.from);
          if (fromSec === null) return;
          const oldest = merged[0].time;
          needPast = fromSec < oldest;
        }

        if (needPast) {
          void loadMorePast();
        }
      }, 200);
    };

    visibleRangeListenerRef.current = onVisibleTimeRangeChange;

    function connectWs() {
      if (cancelled) return;
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!cancelled) setWsLive(true);
      };

      ws.onmessage = (ev) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(String(ev.data)) as BinanceKlineWsPayload;
          if (data.e !== "kline" || !data.k) return;
          applyKlineUpdate(data.k);
        } catch {
          /* ignore malformed */
        }
      };

      ws.onerror = () => {
        if (!cancelled) setWsLive(false);
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        if (!cancelled) setWsLive(false);
        if (cancelled) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectWs();
        }, 3000);
      };
    }

    async function loadHistoryThenWs() {
      setLoading(true);
      setError(null);
      setLegend(null);
      setWsLive(false);
      const oldBarCount = mergedCandlesRef.current.length;
      mergedCandlesRef.current = [];
      noMorePastRef.current = false;

      try {
        const res = await fetch(
          `/api/binance/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${encodeURIComponent(binanceInterval)}&range=${encodeURIComponent(rangeKey)}`,
          { cache: "no-store" },
        );
        const json = (await res.json()) as {
          candles?: {
            time: number;
            open: number;
            high: number;
            low: number;
            close: number;
            volumeQuote?: number;
          }[];
          error?: string;
        };

        if (!res.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }

        const candles = json.candles ?? [];
        const volMap = new Map<number, number>();
        const data: CandlestickData[] = candles.map((c) => {
          volMap.set(c.time, c.volumeQuote ?? 0);
          return {
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          };
        });

        if (cancelled) return;
        volumeByTimeRef.current = volMap;
        mergedCandlesRef.current = candles.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volumeQuote: c.volumeQuote ?? 0,
        }));

        const s = seriesRef.current;
        const vs = volumeSeriesRef.current;
        const chart = chartRef.current;
        if (!s || !chart) return;

        const prev = prevLoadedViewRef.current;
        const sameSymbol = prev !== null && prev.symbol === binanceSymbol;

        const savedVisible = sameSymbol
          ? chart.timeScale().getVisibleRange()
          : null;
        const savedLogical =
          sameSymbol && oldBarCount > 0
            ? chart.timeScale().getVisibleLogicalRange()
            : null;

        s.setData(data);
        const volHist = buildVolumeHistogramFromCandles(candles);
        vs?.setData(volHist);

        const logicalOk =
          sameSymbol &&
          savedLogical !== null &&
          restoreVisibleLogicalPreserveBarCount(chart, data, savedLogical);
        if (!logicalOk) {
          restoreOrFitVisibleRange(chart, data, savedVisible, !sameSymbol);
        }

        prevLoadedViewRef.current = {
          symbol: binanceSymbol,
          timeframe,
        };

        connectWs();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("chart.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadHistoryThenWs();

    return () => {
      cancelled = true;
      visibleRangeListenerRef.current = () => {};
      if (visibleDebounce !== null) clearTimeout(visibleDebounce);
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
      setWsLive(false);
    };
  }, [binanceSymbol, binanceInterval, rangeKey, timeframe, t]);

  const legendTimeStr = useMemo(() => {
    if (!legend) return "";
    return new Date(legend.timeSec * 1000).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [legend]);

  const legendDirs = useMemo(() => {
    if (!legend) return null;
    const { open, high, low, close } = legend;
    return {
      h: cmpToOpen(open, high),
      l: cmpToOpen(open, low),
      c: cmpToOpen(open, close),
    };
  }, [legend]);

  const legendDeltaFromOpen = useMemo(() => {
    if (!legend) return null;
    return formatDeltaFromOpen(legend.open, legend.close);
  }, [legend]);

  const minuteSelectValue = isMinuteTimeframe(timeframe)
    ? timeframe
    : "__higher__";

  return (
    <div className="flex h-full min-h-[280px] flex-col gap-2">
      <div className="flex shrink-0 flex-col gap-2 px-0.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t("chart.minutePlaceholder")}
              value={minuteSelectValue}
              onChange={(e) => {
                const v = e.target.value;
                if (v !== "__higher__") {
                  setTimeframe(v as ChartTimeframe);
                }
              }}
              className={`rounded border px-2 py-0.5 text-[13px] font-medium shadow-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white ${
                isMinuteTimeframe(timeframe)
                  ? "border-gray-200 bg-gray-200 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  : "border-gray-200 bg-white text-gray-500 dark:text-gray-400"
              }`}
            >
              <option value="__higher__" hidden>
                {t("chart.minutePlaceholder")}
              </option>
              {CHART_MINUTE_ORDER.map((tf) => (
                <option key={tf} value={tf}>
                  {t(TIMEFRAME_LABEL_KEY[tf])}
                </option>
              ))}
            </select>

            <span
              className="hidden h-4 w-px shrink-0 bg-gray-200 dark:bg-gray-600 sm:block"
              aria-hidden
            />

            <div className="flex flex-wrap gap-1">
              {CHART_HIGHER_ORDER.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`rounded px-2 py-0.5 text-[13px] font-medium transition-colors ${
                    timeframe === tf
                      ? "bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-white"
                      : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  }`}
                >
                  {t(TIMEFRAME_LABEL_KEY[tf])}
                </button>
              ))}
            </div>
          </div>

          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium sm:ml-auto ${
              wsLive
                ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
                : "bg-gray-200/80 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            }`}
          >
            {t("chart.wsLive")}
            {wsLive ? " ●" : ""}
          </span>
        </div>

        <div className="space-y-0.5 text-[13px] text-gray-500 dark:text-gray-400">
          <p>{t("chart.binanceCaption")}</p>
          {timeframeUses15mInsteadOf10m(timeframe) && (
            <p className="text-[10px] text-amber-700/90 dark:text-amber-400/90">
              {t("chart.caption10mAs15m")}
            </p>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 w-full rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/50">
        {legend && (
          <div className="pointer-events-none absolute left-2 top-2 z-[2] max-w-[min(100%-1rem,20rem)] rounded-md border border-gray-200/90 bg-white/95 px-2.5 py-2 text-[13px] shadow-sm backdrop-blur-sm dark:border-gray-600 dark:bg-gray-900/95">
            <div className="mb-1.5 font-medium text-gray-600 dark:text-gray-300">
              {legendTimeStr}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
              <span className="text-gray-500 dark:text-gray-400">
                {t("chart.legendO")}
              </span>
              <span className="text-right text-gray-900 dark:text-white">
                {formatLegendPrice(legend.open)}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {t("chart.legendH")}
              </span>
              <span
                className={`text-right ${legendDirs ? legendValueClass(legendDirs.h) : ""}`}
                style={legendDirs ? legendValueStyle(legendDirs.h) : undefined}
              >
                {`${formatLegendPrice(legend.high)} (${formatPctFromOpen(legend.open, legend.high)})`}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {t("chart.legendL")}
              </span>
              <span
                className={`text-right ${legendDirs ? legendValueClass(legendDirs.l) : ""}`}
                style={legendDirs ? legendValueStyle(legendDirs.l) : undefined}
              >
                {`${formatLegendPrice(legend.low)} (${formatPctFromOpen(legend.open, legend.low)})`}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {t("chart.legendC")}
              </span>
              <span
                className={`text-right ${legendDirs ? legendValueClass(legendDirs.c) : ""}`}
                style={legendDirs ? legendValueStyle(legendDirs.c) : undefined}
              >
                {`${formatLegendPrice(legend.close)} (${formatPctFromOpen(legend.open, legend.close)})`}
              </span>
              {legendDeltaFromOpen != null && legendDirs != null && (
                <>
                  <span
                    className="text-gray-500 dark:text-gray-400"
                    aria-hidden
                  />
                  <span
                    className={`text-right text-[12px] font-medium ${legendValueClass(legendDirs.c)}`}
                    style={legendValueStyle(legendDirs.c)}
                  >
                    {legendDeltaFromOpen}
                  </span>
                </>
              )}
              <span className="text-gray-500 dark:text-gray-400">
                {t("chart.legendV")}
              </span>
              <span className="text-right text-gray-900 dark:text-white">
                {legend.volumeQuote != null
                  ? `${formatVolumeQuote(legend.volumeQuote)} ${t("chart.volumeUnit")}`
                  : "—"}
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div className="absolute inset-0 z-[3] flex items-center justify-center rounded-lg bg-white/60 text-sm text-gray-600 backdrop-blur-[1px] dark:bg-gray-900/50 dark:text-gray-300">
            {t("chart.loading")}
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-[3] flex items-center justify-center rounded-lg bg-white/90 px-4 text-center text-sm text-red-600 dark:bg-gray-900/90 dark:text-red-400">
            {error}
          </div>
        )}
        <div ref={containerRef} className="h-full min-h-[240px] w-full" />
        <div className="pointer-events-none absolute inset-0 z-[1] min-h-[240px]">
          <div
            className="absolute left-0 right-0 border-t border-gray-300 dark:border-gray-600"
            aria-hidden
            style={{
              top: `${volumeDividerLinePct()}%`,
            }}
          />
          <div
            className="absolute left-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400"
            style={{ top: `calc(${volumePaneTopPct()}% + 0.25rem)` }}
          >
            {t("chart.volumePaneTitle")}
          </div>
        </div>
      </div>
    </div>
  );
}
