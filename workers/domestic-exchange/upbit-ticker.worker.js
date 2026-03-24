let ws = null;
let reconnectTimer = null;
let currentMarkets = [];
let consecutiveFailures = 0;
let stopped = false;
let connId = 0;
const seqByMarket = new Map();

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 8000;
const SUBSCRIBE_CHUNK_SIZE = 100;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function send(msg) {
  self.postMessage(msg);
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
  }, delay);
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
      const codesChunks = chunk(markets, SUBSCRIBE_CHUNK_SIZE);
      for (const codes of codesChunks) {
        ws?.send(
          JSON.stringify([
            { ticket: "crypto-market-viewer" },
            { type: "ticker", codes },
            { format: "DEFAULT" },
          ]),
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
    send({ type: "error", message: "Upbit WS error" });
  };

  ws.onclose = (ev) => {
    const code =
      ev && typeof ev.code === "number" ? ev.code : undefined;
    const reason =
      ev && typeof ev.reason === "string" ? ev.reason : undefined;
    if (code !== undefined || reason) {
      send({
        type: "error",
        message: `Upbit WS closed (code=${code ?? "?"}, reason=${reason ?? ""})`,
      });
    }
    send({ type: "close" });
    scheduleReconnect();
  };
}

function parseAndEmit(text) {
  try {
    const payload = JSON.parse(text);
    const market = payload.code ?? payload.market;
    if (!market) return;
    if (
      typeof payload.trade_price !== "number" ||
      !Number.isFinite(payload.trade_price)
    ) {
      return;
    }
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

self.onmessage = (e) => {
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
