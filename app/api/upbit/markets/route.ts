import { NextResponse } from "next/server";

type UpbitMarket = {
  market: string;
  korean_name: string;
  english_name: string;
};

export async function GET() {
  try {
    const response = await fetch("https://api.upbit.com/v1/market/all?isDetails=false", {
      cache: "no-store",
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upbit API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = (await response.json()) as UpbitMarket[];
    const krwMarkets = data.filter((m) => m.market.startsWith("KRW-"));
    return NextResponse.json(krwMarkets);
  } catch (error) {
    console.error("Error fetching Upbit markets:", error);
    return NextResponse.json(
      { error: "Failed to fetch Upbit markets" },
      { status: 500 },
    );
  }
}

