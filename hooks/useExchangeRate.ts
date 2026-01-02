import { useRef, useEffect } from "react";

/**
 * 실시간 USDT to KRW 환율을 가져오는 커스텀 훅 (useRef 사용)
 * @param updateInterval 환율 업데이트 간격 (밀리초, 기본값: 10초)
 * @param defaultValue 기본 환율 값 (기본값: 1350)
 * @param onRateChange 환율이 변경될 때 호출되는 콜백 함수
 * @returns 현재 환율 값 (ref)
 */
export function useExchangeRate(
  updateInterval: number = 10 * 1000,
  defaultValue: number = 1350,
  onRateChange?: (newRate: number) => void
) {
  const usdtToKrwRateRef = useRef<number>(defaultValue);
  const prevRateRef = useRef<number>(defaultValue);
  // 콜백을 ref로 저장하여 의존성 배열에서 제외 (항상 최신 콜백 참조)
  const onRateChangeRef = useRef(onRateChange);
  // updateInterval을 ref로 저장하여 의존성 배열에서 제외
  const updateIntervalRef = useRef(updateInterval);

  // 콜백이 변경될 때마다 ref 업데이트
  useEffect(() => {
    onRateChangeRef.current = onRateChange;
  }, [onRateChange]);

  // updateInterval이 변경될 때마다 ref 업데이트
  useEffect(() => {
    updateIntervalRef.current = updateInterval;
  }, [updateInterval]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const fetchExchangeRate = async () => {
      try {
        // API 라우트를 통해 환율 가져오기 (CORS 문제 해결)
        const response = await fetch("/api/exchange-rate");
        if (response.ok) {
          const data = await response.json();
          if (data.rate) {
            const newRate = data.rate;
            const oldRate = usdtToKrwRateRef.current;

            // 값이 실제로 변경되었을 때만 업데이트
            if (newRate !== oldRate) {
              prevRateRef.current = oldRate;
              usdtToKrwRateRef.current = newRate;

              // 콜백이 제공된 경우 호출 (항상 최신 콜백 사용)
              if (onRateChangeRef.current) {
                onRateChangeRef.current(newRate);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching exchange rate:", error);
        // 실패 시 기본값 유지
      }
    };

    // 초기 로딩
    fetchExchangeRate();

    // 지정된 간격마다 환율 업데이트 (ref에서 가져온 값 사용)
    intervalId = setInterval(() => {
      fetchExchangeRate();
    }, updateIntervalRef.current);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // 빈 의존성 배열로 마운트 시 한 번만 실행
  return usdtToKrwRateRef;
}
