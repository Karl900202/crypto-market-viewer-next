let ws = null;
let reconnectTimer = null;
let currentSymbols = [];
let consecutiveFailures = 0;
let stopped = false;
let connId = 0;
const seqBySymbol = new Map();

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
      ev && typeof ev.code === "number" ? ev.code : undefined;
    const reason =
      ev && typeof ev.reason === "string" ? ev.reason : undefined;
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

function toNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toTs(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    const n = Number.parseInt(s, 10);
    if (Number.isFinite(n)) {
      return n < 10_000_000_000 ? n * 1000 : n;
    }
  }
  return undefined;
}

function parseAndEmit(text) {
  try {
    const payload = JSON.parse(text);
    if (!payload || typeof payload !== "object") return;
    if ("status" in payload && typeof payload.status === "string") {
      if (payload.status !== "0000") {
        send({
          type: "error",
          message:
            payload.resmsg ??
            `Bithumb WS subscription error (status=${payload.status})`,
        });
      }
      return;
    }

    if (!("type" in payload) || payload.type !== "ticker") return;
    const content = payload.content;
    if (!content || typeof content !== "object") return;

    const c = content;
    const market = typeof c.symbol === "string" ? c.symbol : undefined;
    if (!market || !market.includes("_")) return;
    const base = market.split("_")[0];
    if (!base) return;

    const close = toNum(c.closePrice ?? c.close_price);
    if (close === undefined) return;

    const rate = toNum(c.chgRate ?? c.chg_rate);
    const amt = toNum(c.chgAmt ?? c.chg_amt);
    const value = toNum(c.value ?? c.trade_value);
    const ts =
      toTs(c.tickTime ?? c.tick_time) ??
      toTs(c.timestamp) ??
      toTs(c.time) ??
      toTs(c.date) ??
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
    currentSymbols = msg.symbols.filter(Boolean);
    connect();
  }
};
