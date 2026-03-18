export {};

type StartMessage = {
  type: "start";
  markets: string[];
};

type StopMessage = {
  type: "stop";
};

type InMessage = StartMessage | StopMessage;

type UpbitWsTicker = {
  code?: string; // WS DEFAULT: code
  market?: string; // REST-style fallback
  timestamp?: number; // ms
  trade_timestamp?: number; // ms
  trade_price: number;
  signed_change_rate: number;
  signed_change_price: number;
  acc_trade_price_24h: number;
};

type OutMessage =
  | { type: "open" }
  | { type: "close" }
  | { type: "error"; message: string }
  | { type: "reconnect_failed" }
  | {
      type: "tick";
      data: {
        market: string;
        connId: number;
        ts: number;
        seq: number;
        tradePrice: number;
        signedChangeRate: number;
        signedChangePrice: number;
        accTradePrice24h: number;
      };
    };

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let currentMarkets: string[] = [];
let consecutiveFailures = 0;
let stopped = false;
let connId = 0;
const seqByMarket = new Map<string, number>();

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 8000;

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
  const markets = currentMarkets.filter(Boolean);
  if (!markets.length) return;

  connId += 1;
  seqByMarket.clear();

  ws = new WebSocket("wss://api.upbit.com/websocket/v1");
  ws.binaryType = "arraybuffer";

  ws.onopen = () => {
    consecutiveFailures = 0;
    clearReconnectTimer();
    send({ type: "open" });
    try {
      ws?.send(
        JSON.stringify([
          { ticket: "crypto-market-viewer" },
          { type: "ticker", codes: markets },
          { format: "DEFAULT" },
        ]),
      );
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
    send({ type: "error", message: "Upbit WS error" });
  };

  ws.onclose = () => {
    send({ type: "close" });
    scheduleReconnect();
  };
}

function parseAndEmit(text: string) {
  try {
    const payload = JSON.parse(text) as UpbitWsTicker;
    const market = payload.code ?? payload.market;
    if (!market) return;
    const ts =
      (typeof payload.trade_timestamp === "number" && payload.trade_timestamp) ||
      (typeof payload.timestamp === "number" && payload.timestamp) ||
      Date.now();
    send({
      type: "tick",
      data: {
        market,
        connId,
        ts,
        seq: (seqByMarket.get(market) ?? 0) + 1,
        tradePrice: payload.trade_price,
        signedChangeRate: payload.signed_change_rate,
        signedChangePrice: payload.signed_change_price,
        accTradePrice24h: payload.acc_trade_price_24h,
      },
    });
    seqByMarket.set(market, (seqByMarket.get(market) ?? 0) + 1);
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
    currentMarkets = msg.markets.filter(Boolean);
    connect();
  }
};

