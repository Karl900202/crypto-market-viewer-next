import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      "https://api.coinone.co.kr/public/v2/ticker_new/KRW",
      {
        cache: "no-store",
        headers: { accept: "application/json" },
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Coinone API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Coinone ticker:", error);
    return NextResponse.json(
      { error: "Failed to fetch Coinone ticker" },
      { status: 500 },
    );
  }
}
