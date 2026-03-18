import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://api.bithumb.com/public/ticker/ALL_KRW", {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Bithumb API error: ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Bithumb ALL_KRW ticker:", error);
    return NextResponse.json(
      { error: "Failed to fetch Bithumb ticker" },
      { status: 500 },
    );
  }
}

