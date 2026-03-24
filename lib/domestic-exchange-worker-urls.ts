/**
 * 국내 거래소 Web Worker 번들 URL.
 * `app/` 라우트 트리 밖 `workers/`에 두고, `new Worker(url)`에 넘깁니다.
 * (워커는 `.js`로 유지 — `.ts`로 번들 시 일부 환경에서 MIME 이슈)
 *
 * 파일 단위 `new URL(..., import.meta.url)`만 사용 (디렉터리 기준 URL은 Turbopack이 해석하지 않음)
 */
export const domesticExchangeWorkerUrls = {
  upbit: new URL(
    "../workers/domestic-exchange/upbit-ticker.worker.js",
    import.meta.url,
  ),
  bithumb: new URL(
    "../workers/domestic-exchange/bithumb-ticker.worker.js",
    import.meta.url,
  ),
  coinone: new URL(
    "../workers/domestic-exchange/coinone-ticker.worker.js",
    import.meta.url,
  ),
} as const;
