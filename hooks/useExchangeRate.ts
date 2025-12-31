import { useState, useEffect } from "react";

/**
 * 실시간 USDT to KRW 환율을 가져오는 커스텀 훅
 * @param updateInterval 환율 업데이트 간격 (밀리초, 기본값: 1분)
 * @param defaultValue 기본 환율 값 (기본값: 1350)
 * @returns 현재 환율 값
 */
export function useExchangeRate(
  updateInterval: number = 10 * 1000,
  defaultValue: number = 1350
) {
  const [usdtToKrwRate, setUsdtToKrwRate] = useState<number>(defaultValue);

  useEffect(() => {
    const fetchExchangeRate = async () => {
      try {
        // Next.js API 라우트를 통해 환율 가져오기 (CORS 문제 해결)
        const response = await fetch("/api/exchange-rate");
        if (response.ok) {
          const data = await response.json();
          if (data.rate) {
            // USDT는 USD와 거의 1:1이므로 USD-KRW 환율을 사용
            setUsdtToKrwRate(data.rate);
          }
        }
      } catch (error) {
        console.error("Error fetching exchange rate:", error);
        // 실패 시 기본값 유지
      }
    };

    // 초기 로딩
    fetchExchangeRate();

    // 지정된 간격마다 환율 업데이트
    const interval = setInterval(fetchExchangeRate, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  return usdtToKrwRate;
}
