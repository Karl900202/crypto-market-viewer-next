import { NextResponse } from "next/server";

export async function GET() {
  try {
    // exchangerate-api.com 무료 API 사용 (USD to KRW)
    const response = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD",
      {
        next: { revalidate: 300 }, // 5분마다 캐시 갱신
      }
    );

    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.status}`);
    }

    const data = await response.json();
    const krwRate = data.rates?.KRW;

    if (!krwRate) {
      throw new Error("KRW rate not found");
    }

    return NextResponse.json({ rate: krwRate });
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    // 기본값 반환
    return NextResponse.json({ rate: 1350 }, { status: 200 });
  }
}

