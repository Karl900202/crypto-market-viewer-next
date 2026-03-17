import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const markets = request.nextUrl.searchParams.get("markets") ?? "";

  if (!markets.trim()) {
    return NextResponse.json(
      { error: "markets query param is required (comma-separated)" },
      { status: 400 },
    );
  }

  // Upbit expects a comma-separated list as-is (commas must NOT be percent-encoded).
  // Example: KRW-BTC,KRW-ETH
  const normalized = markets.replace(/\s+/g, "");
  const isValid =
    /^([A-Z]+-[A-Z0-9]+)(,[A-Z]+-[A-Z0-9]+)*$/.test(normalized);
  if (!isValid) {
    return NextResponse.json(
      { error: "invalid markets format" },
      { status: 400 },
    );
  }

  try {
    const url = `https://api.upbit.com/v1/ticker?markets=${normalized}`;
    const response = await fetch(url, {
      // Upbit is public; keep it fresh but avoid overfetching on server
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upbit API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Upbit ticker:", error);
    return NextResponse.json(
      { error: "Failed to fetch Upbit ticker" },
      { status: 500 },
    );
  }
}

