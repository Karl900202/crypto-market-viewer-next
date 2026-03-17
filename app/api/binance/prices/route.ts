import { NextRequest, NextResponse } from "next/server";

type BinancePriceTicker = {
  symbol: string;
  price: string;
};

export async function GET(request: NextRequest) {
  const quote = (request.nextUrl.searchParams.get("quote") ?? "USDT").toUpperCase();

  try {
    const response = await fetch("https://api.binance.com/api/v3/ticker/price", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Binance API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as BinancePriceTicker[];
    const map: Record<string, number> = {};

    for (const t of data) {
      if (!t.symbol.endsWith(quote)) continue;
      const base = t.symbol.slice(0, -quote.length);
      const p = Number.parseFloat(t.price);
      if (!Number.isFinite(p)) continue;
      map[base] = p;
    }

    return NextResponse.json({ quote, prices: map });
  } catch (error) {
    console.error("Error fetching Binance prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch Binance prices" },
      { status: 500 },
    );
  }
}

