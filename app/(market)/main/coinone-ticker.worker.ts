export {};

type StartMessage = {
  type: "start";
  symbols: string[]; // e.g. ["BTC", "ETH"] (base symbols)
};

type StopMessage = {
  type: "stop";
};

type InMessage = StartMessage | StopMessage;

/** Coinone WS TICKER data (DEFAULT format) */
type CoinoneWsTickerData = {
  quote_currency?: string;
  target_currency?: string;
  timestamp?: number;
  quote_volume?: string;
  first?: string;
  last?: string;
  [k: string]: unknown;
};

/** SHORT format field names */
type CoinoneWsTickerDataShort = {
  qc?: string;
  tc?: string;
  t?: number;
  qv?: string;
  fi?: string;
  la?: string;
  [k: string]: unknown;
};

type OutMessage =
  | { type: "open" }
  | { type: "close" }
  | { type: "error"; message: string }
  | { type: "reconnect_failed" }
  | {
      type: "tick";
      data: {
        symbol: string;
        connId: number;
        ts: number;
        seq: number;
        closePrice: number;
        changeRatePercent?: number;
        changeAmount?: number;
        tradeValueKrw?: number;
      };
    };

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pingTimer: number | null = null;
let currentSymbols: string[] = [];
let consecutiveFailures = 0;
let stopped = false;
let connId = 0;
const seqBySymbol = new Map<string, number>();

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 8000;
const PING_INTERVAL_MS = 60_000; // 30분 타임아웃 방지, 1분마다 PING
const SUBSCRIBE_CHUNK_SIZE = 50;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function send(msg: OutMessage) {
  (self as unknown as Worker).postMessage(msg);
}

function clearPingTimer() {
  if (pingTimer !== null) {
    clearTimeout(pingTimer);
    pingTimer = null;
  }
}

function schedulePing() {
  clearPingTimer();
  if (stopped || !ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify({ request_type: "PING" }));
  } catch {
    // ignore
  }
  pingTimer = setTimeout(schedulePing, PING_INTERVAL_MS) as unknown as number;
}

function closeWs() {
  clearPingTimer();
  try {
    ws?.close();
  } catch {
    // ignore
  } finally {
    ws = null;
  }
}

function clearReconnectTimer() {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (stopped) return;
  clearReconnectTimer();
  consecutiveFailures += 1;
  if (consecutiveFailures > MAX_RETRIES) {
    send({ type: "reconnect_failed" });
    return;
  }
  const delay = Math.min(
    MAX_DELAY_MS,
    BASE_DELAY_MS * 2 ** (consecutiveFailures - 1),
  );
  reconnectTimer = setTimeout(() => {
    connect();
  }, delay) as unknown as number;
}

function connect() {
  if (stopped) return;
  closeWs();
  const symbols = currentSymbols.filter(Boolean);
  if (!symbols.length) return;

  connId += 1;
  seqBySymbol.clear();

  ws = new WebSocket("wss://stream.coinone.co.kr");

  ws.onopen = () => {
    consecutiveFailures = 0;
    clearReconnectTimer();
    send({ type: "open" });
    schedulePing();
    try {
      // Coinone: 각 심볼별로 SUBSCRIBE (topic은 1:1)
      // 과도한 구독 시 chunk로 나눠 전송
      const chunks = chunk(symbols, SUBSCRIBE_CHUNK_SIZE);
      for (const symChunk of chunks) {
        for (const sym of symChunk) {
          ws?.send(
            JSON.stringify({
              request_type: "SUBSCRIBE",
              channel: "TICKER",
              topic: {
                quote_currency: "KRW",
                target_currency: sym,
              },
            }),
          );
        }
      }
    } catch {
      // ignore
    }
  };

  ws.onmessage = (event) => {
    const data = event.data;
    if (typeof data !== "string") return;
    parseAndEmit(data);
  };

  ws.onerror = () => {
    send({ type: "error", message: "Coinone WS error" });
  };

  ws.onclose = (ev) => {
    const code =
      ev && typeof (ev as CloseEvent).code === "number"
        ? (ev as CloseEvent).code
        : undefined;
    const reason =
      ev && typeof (ev as CloseEvent).reason === "string"
        ? (ev as CloseEvent).reason
        : undefined;
    if (code !== undefined || reason) {
      send({
        type: "error",
        message: `Coinone WS closed (code=${code ?? "?"}, reason=${reason ?? ""})`,
      });
    }
    send({ type: "close" });
    scheduleReconnect();
  };
}

function toNum(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseAndEmit(text: string) {
  try {
    const payload = JSON.parse(text) as {
      response_type?: string;
      r?: string;
      channel?: string;
      c?: string;
      data?: CoinoneWsTickerData | CoinoneWsTickerDataShort;
      d?: CoinoneWsTickerDataShort;
      [k: string]: unknown;
    };

    // PONG 무시
    if (payload.response_type === "PONG" || payload.r === "PONG") return;
    // SUBSCRIBED 확인 응답 무시
    if (
      payload.response_type === "SUBSCRIBED" ||
      payload.r === "SUBSCRIBED"
    )
      return;

    // TICKER DATA (DEFAULT: data, SHORT: d)
    if (payload.response_type !== "DATA" && payload.r !== "DATA") return;
    const data = (payload.d ?? payload.data) as
      | CoinoneWsTickerData
      | CoinoneWsTickerDataShort
      | undefined;
    if (!data || typeof data !== "object") return;

    const d = data as CoinoneWsTickerData & CoinoneWsTickerDataShort;
    const symbol = (
      (d.target_currency ?? d.tc) as string | undefined
    )?.toUpperCase?.();
    if (!symbol) return;

    const last = toNum(d.last ?? d.la);
    if (last === undefined) return;

    const first = toNum(d.first ?? d.fi);
    let changeRatePercent: number | undefined;
    let changeAmount: number | undefined;
    if (first !== undefined && first !== 0) {
      changeAmount = last - first;
      changeRatePercent = (changeAmount / first) * 100;
    }

    const quoteVol = toNum(d.quote_volume ?? d.qv);
    const tsRaw = d.timestamp ?? d.t;
    const ts =
      typeof tsRaw === "number" && Number.isFinite(tsRaw) ? tsRaw : Date.now();

    send({
      type: "tick",
      data: {
        symbol,
        connId,
        ts,
        seq: (seqBySymbol.get(symbol) ?? 0) + 1,
        closePrice: last,
        changeRatePercent,
        changeAmount,
        tradeValueKrw: quoteVol,
      },
    });
    seqBySymbol.set(symbol, (seqBySymbol.get(symbol) ?? 0) + 1);
  } catch {
    // ignore parse errors
  }
}

self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  if (msg.type === "stop") {
    stopped = true;
    clearReconnectTimer();
    clearPingTimer();
    closeWs();
    return;
  }

  if (msg.type === "start") {
    stopped = false;
    consecutiveFailures = 0;
    currentSymbols = msg.symbols.filter(Boolean);
    connect();
  }
};
