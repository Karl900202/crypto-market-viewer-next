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
  trade_price: number;
  signed_change_rate: number;
  signed_change_price: number;
  acc_trade_price_24h: number;
};

type OutMessage =
  | { type: "open" }
  | { type: "close" }
  | { type: "error"; message: string }
  | {
      type: "tick";
      data: {
        market: string;
        tradePrice: number;
        signedChangeRate: number;
        signedChangePrice: number;
        accTradePrice24h: number;
      };
    };

let ws: WebSocket | null = null;

function send(msg: OutMessage) {
  // eslint-disable-next-line no-restricted-globals
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

function parseAndEmit(text: string) {
  try {
    const payload = JSON.parse(text) as UpbitWsTicker;
    const market = payload.code ?? payload.market;
    if (!market) return;
    send({
      type: "tick",
      data: {
        market,
        tradePrice: payload.trade_price,
        signedChangeRate: payload.signed_change_rate,
        signedChangePrice: payload.signed_change_price,
        accTradePrice24h: payload.acc_trade_price_24h,
      },
    });
  } catch {
    // ignore parse errors
  }
}

// eslint-disable-next-line no-restricted-globals
self.onmessage = (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  if (msg.type === "stop") {
    closeWs();
    return;
  }

  if (msg.type === "start") {
    closeWs();
    const markets = msg.markets.filter(Boolean);
    if (!markets.length) return;

    ws = new WebSocket("wss://api.upbit.com/websocket/v1");
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
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
    };
  }
};

