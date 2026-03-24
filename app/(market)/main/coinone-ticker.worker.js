let ws = null;
let reconnectTimer = null;
let pingTimer = null;
let currentSymbols = [];
let consecutiveFailures = 0;
let stopped = false;
let connId = 0;
const seqBySymbol = new Map();

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 400;
const MAX_DELAY_MS = 8000;
const PING_INTERVAL_MS = 60_000;
const SUBSCRIBE_CHUNK_SIZE = 50;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function send(msg) {
  self.postMessage(msg);
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
  pingTimer = setTimeout(schedulePing, PING_INTERVAL_MS);
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
  }, delay);
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
      ev && typeof ev.code === "number" ? ev.code : undefined;
    const reason =
      ev && typeof ev.reason === "string" ? ev.reason : undefined;
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

function toNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function parseAndEmit(text) {
  try {
    const payload = JSON.parse(text);

    if (payload.response_type === "PONG" || payload.r === "PONG") return;
    if (
      payload.response_type === "SUBSCRIBED" ||
      payload.r === "SUBSCRIBED"
    )
      return;

    if (payload.response_type !== "DATA" && payload.r !== "DATA") return;
    const data = payload.d ?? payload.data;
    if (!data || typeof data !== "object") return;

    const d = data;
    const symbol = d.target_currency ?? d.tc;
    const sym =
      typeof symbol === "string" ? symbol.toUpperCase() : undefined;
    if (!sym) return;

    const last = toNum(d.last ?? d.la);
    if (last === undefined) return;

    const first = toNum(d.first ?? d.fi);
    let changeRatePercent;
    let changeAmount;
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
        symbol: sym,
        connId,
        ts,
        seq: (seqBySymbol.get(sym) ?? 0) + 1,
        closePrice: last,
        changeRatePercent,
        changeAmount,
        tradeValueKrw: quoteVol,
      },
    });
    seqBySymbol.set(sym, (seqBySymbol.get(sym) ?? 0) + 1);
  } catch {
    // ignore parse errors
  }
}

self.onmessage = (e) => {
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
