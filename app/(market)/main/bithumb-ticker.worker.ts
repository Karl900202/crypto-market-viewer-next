export {};

type StartMessage = {
  type: "start";
  symbols: string[]; // e.g. ["BTC", "ETH"] (base symbols)
};

type StopMessage = {
  type: "stop";
};

type InMessage = StartMessage | StopMessage;

type BithumbWsEnvelope =
  | {
      type: string; // "ticker" | ...
      content?: unknown;
    }
  | {
      status?: string;
      resmsg?: string;
    };

type BithumbWsTickerContent = {
  symbol?: string; // e.g. "BTC_KRW"
  tickTime?: string | number;
  date?: string | number;
  time?: string | number;
  timestamp?: string | number;
  closePrice?: string; // last price
  chgRate?: string; // percent change (string number)
  chgAmt?: string; // change amount (string number)
  value?: string; // turnover value
  // sometimes docs differ; keep loose
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
        symbol: string; // base symbol, e.g. "BTC"
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
let currentSymbols: string[] = [];
let consecutiveFailures = 0;
let stopped = false;
let connId = 0;
const seqBySymbol = new Map<string, number>();

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 8000;
const SUBSCRIBE_CHUNK_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function send(msg: OutMessage) {
  (self as unknown as Worker).postMessage(msg);
}

function closeWs() {
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

  ws = new WebSocket("wss://pubwss.bithumb.com/pub/ws");
  ws.onopen = () => {
    consecutiveFailures = 0;
    clearReconnectTimer();
    send({ type: "open" });
    try {
      const markets = symbols.map((s) => `${s}_KRW`);
      // Bithumb public WS commonly requires tickTypes for ticker stream.
      // Bithumb WS may close if subscribing too many symbols at once.
      const chunks = chunk(markets, SUBSCRIBE_CHUNK_SIZE);
      for (const symbolsChunk of chunks) {
        ws?.send(
          JSON.stringify({
            type: "ticker",
            symbols: symbolsChunk,
            tickTypes: ["24H"],
          }),
        );
      }
    } catch {
      // ignore
    }
  };

  ws.onmessage = (event) => {
    const data = event.data;
    if (typeof data === "string") {
      parseAndEmit(data);
    } else if (data instanceof ArrayBuffer) {
      parseAndEmit(new TextDecoder("utf-8").decode(data));
    } else if (data instanceof Blob) {
      data
        .text()
        .then(parseAndEmit)
        .catch(() => {});
    }
  };

  ws.onerror = () => {
    send({ type: "error", message: "Bithumb WS error" });
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
        message: `Bithumb WS closed (code=${code ?? "?"}, reason=${reason ?? ""})`,
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

function toTs(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    // common cases: ms timestamp as string
    const n = Number.parseInt(s, 10);
    if (Number.isFinite(n)) {
      // if it's in seconds, convert to ms (heuristic)
      return n < 10_000_000_000 ? n * 1000 : n;
    }
  }
  return undefined;
}

function parseAndEmit(text: string) {
  try {
    const payload = JSON.parse(text) as BithumbWsEnvelope;
    if (!payload || typeof payload !== "object") return;
    if ("status" in payload && typeof payload.status === "string") {
      // subscription ack/error
      if (payload.status !== "0000") {
        send({
          type: "error",
          message:
            payload.resmsg ??
            `Bithumb WS subscription error (status=${payload.status})`,
        });
      } else {
        // status === "0000" means subscribe succeeded (ACK). Not an error.
        // Avoid sending it as "error" because the main thread marks WS as degraded on errors.
      }
      return;
    }

    if (!("type" in payload) || payload.type !== "ticker") return;
    const content = (payload as { content?: unknown }).content;
    if (!content || typeof content !== "object") return;

    const c = content as BithumbWsTickerContent;
    const market = typeof c.symbol === "string" ? c.symbol : undefined;
    if (!market || !market.includes("_")) return;
    const base = market.split("_")[0];
    if (!base) return;

    const cx = c as BithumbWsTickerContent & Record<string, unknown>;
    const close = toNum(cx.closePrice ?? cx.close_price);
    if (close === undefined) return;

    const rate = toNum(cx.chgRate ?? cx.chg_rate);
    const amt = toNum(cx.chgAmt ?? cx.chg_amt);
    const value = toNum(cx.value ?? cx.trade_value);
    const ts =
      toTs(cx.tickTime ?? cx.tick_time) ??
      toTs(cx.timestamp) ??
      toTs(cx.time) ??
      toTs(cx.date) ??
      Date.now();

    send({
      type: "tick",
      data: {
        symbol: base,
        connId,
        ts,
        seq: (seqBySymbol.get(base) ?? 0) + 1,
        closePrice: close,
        changeRatePercent: rate,
        changeAmount: amt,
        tradeValueKrw: value,
      },
    });
    seqBySymbol.set(base, (seqBySymbol.get(base) ?? 0) + 1);
  } catch {
    // ignore parse errors
  }
}

self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  if (msg.type === "stop") {
    stopped = true;
    clearReconnectTimer();
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

