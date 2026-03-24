## KorP

KorP는 **국내 거래소(업비트/빗썸/코인원) 시세**와 **글로벌(Binance USDT) 시세**를 한 화면에서 비교하고, 이를 기반으로 **KorP(Korean Premium)** 를 계산/표시하는 Next.js 앱입니다.

- **국내 기준 거래소**: 업비트(KRW) / 빗썸(KRW) / 코인원(KRW) 중 선택
- **글로벌 기준**: Binance USDT 마켓
- **핵심 목표**: 실시간성을 유지하면서도, 연결 실패/지연 시에도 “신뢰할 수 있는 데이터”만 표시

## Getting Started

### Requirements

- Node.js (권장: 20+)
- npm

### Run (dev)

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 을 열고 `/main`을 확인하세요.

### Build

```bash
npm run build
npm run start
```

## Architecture (Data flow)

프로젝트의 실시간 데이터 파이프라인은 다음 3가지로 구성됩니다.

1. **Web Worker(WebSocket)**: 업비트/빗썸/코인원 WS 연결 + 메시지 파싱/정규화
2. **Adaptive REST fallback polling**: WS가 지연/실패 시 REST로 안전망 가동 (고정 interval 없음)
3. **정합성(최신성) 검증**: WS/REST 경합에서도 스테일 데이터가 최신을 덮지 않게 드랍

## 국내 거래소 통합 분기 프로세스 (타임라인)

업비트·빗썸·코인원은 **동일한 단일 진입점**으로 연결됩니다: `lib/setup-domestic-exchange-connection.ts`  
타이밍 상수는 `lib/domestic-exchange-timing.ts`의 `DOMESTIC_EXCHANGE_TIMING`에만 정의되어 있습니다.

| 상수 | 값(ms) | 의미 |
|------|--------|------|
| `adaptiveFallbackAfterMs` | 2500 | 연결 직후, 이 시간이 지나면 “adaptive REST 폴백”을 **한 번만** 시작할 수 있음 |
| `fallbackFirstScheduleMs` | 1500 | 폴백이 시작되면 **첫 REST 요청**까지의 지연 |
| `restBackoffInitialMs` | 800 | REST 성공 시 백오프를 이 값 근처로 리셋 |
| `restBackoffMaxMs` | 5000 | REST 폴링 간격 백오프 상한 |

### 타임라인 (T = 기준 거래소 선택 후 `setupDomesticExchangeConnection` 실행 시각)

```text
T+0
  ├─ 상태: connecting
  ├─ Web Worker 생성 → 해당 거래소 WS 연결 시도
  ├─ (업비트) KRW 마켓 목록 확보 후 구독 / (빗썸·코인원) 심볼 목록 확보 후 구독
  └─ 심볼·마켓 목록이 비면 WS는 스킵하고 즉시 REST 폴백만 시작 (아래 “예외” 참고)

T+~ (비동기, 수 ms~수백 ms)
  ├─ Worker `open` → 연결 상태 live (가능한 한 빨리)
  └─ `tick` 수신 시마다: DTO → DomesticTickerVM → `applyDomesticTicker` → 국내 시세 UI 반영

T+2500ms
  └─ 아직 adaptive 폴백이 시작되지 않았다면 `startAdaptiveFallback()` 1회
      (이미 `reconnect_failed` 등으로 폴백이 켜졌으면 중복 시작 안 함)

T+2500 + 1500 (= T+4000ms) — 일반 경로
  └─ 첫 REST 폴링 1회 실행 (업비트 청크 / 빗썸 ALL_KRW / 코인원 ticker_new)

이후 (REST 루프)
  ├─ 매 요청 끝마다 백오프 갱신: 미준비 시 ×2(상한 5000ms), 준비됨 시 ×1.25(상한 5000ms)
  ├─ 다음 REST는 `backoffMs` 후에 다시 스케줄
  └─ **중단 조건**: 국내 데이터 준비됨 + WS가 live + 상장된 **모든** 심볼에 국내 가격이 찼을 때
      (`canStopRestFallbackWhileWsLive`) → 더 이상 REST 스케줄하지 않음
```

### 예외·분기 (같은 모듈 안에서 처리)

- **`reconnect_failed` (Worker가 WS 재연결 포기)**  
  → 즉시 `startAdaptiveFallback()` → **약 T+1500ms**에 첫 REST (이때는 2500ms 대기 없음).

- **구독할 심볼/마켓이 비어 WS를 시작하지 못한 경우**  
  → 즉시 `startAdaptiveFallback()` → **약 T+1500ms**에 첫 REST.

- **거래소 전환 / effect cleanup**  
  → `cleanup()` 한 번으로 Worker 종료 + REST 타이머 정리 + `currentExchangeRef`로 이전 응답 무시.

### VM·파일 맵

- DTO → 통합 VM: `lib/domestic-ticker-vm.ts`
- 연결 오케스트레이션: `lib/setup-domestic-exchange-connection.ts`
- 페이지에서 분기: `app/(market)/main/page.tsx` — 선택 거래소에 따라 위 모듈에 `workerUrl`·상태 setter만 넘김
- 렌더용 `CoinData`는 국내 시세를 **필드 복제 없이** `domestic?: DomesticTickerVM` 한 덩어리로 보관하고, KorP·글로벌 USDT 가격만 별도 필드(`korp`, `globalPriceUsdt`)로 둡니다.

## 환율 & 글로벌(Binance) 시세 환산

KorP는 Binance의 글로벌 시세가 **USDT 기준**이기 때문에, 화면에서 글로벌 가격을 KRW로 보여주고 KorP를 계산하려면 **USDT→KRW 환율**이 필요합니다.

### 1) 환율(USDT→KRW) 가져오기

- 클라이언트 훅 `useExchangeRate`가 주기적으로 `/api/exchange-rate`를 호출해 **환율을 ref로 유지**합니다.
- `/api/exchange-rate`는 `exchangerate-api.com`의 `USD→KRW`를 가져오며, 실패 시 기본값(1350)을 반환합니다.

관련 파일:

- `hooks/useExchangeRate.ts`
- `app/api/exchange-rate/route.ts`

### 2) Binance USDT 시세 가져오기

- 메인 페이지는 `/api/binance/prices?quote=USDT`를 주기적으로 호출해 **모든 USDT 페어 가격 맵(base→priceUSDT)** 를 가져옵니다.
- 글로벌 시세는 `globalPriceKrw = priceUSDT * usdtToKrwRate`로 환산합니다.

관련 파일:

- `app/api/binance/prices/route.ts`
- `app/(market)/main/page.tsx`

### 3) KorP 계산

- 국내(선택 거래소) KRW 가격과, 위에서 환산한 글로벌 KRW 가격이 모두 존재할 때:

\[
KorP = \frac{KRW*{domestic} - KRW*{global}}{KRW\_{global}} \times 100
\]

로 계산해 표시합니다.

### Why Web Worker?

업비트/빗썸의 전 종목 ticker는 메시지량이 많습니다. 메인 스레드에서 WS 프레임 파싱/정규화를 처리하면 렌더링/스크롤/입력 이벤트에 영향을 줄 수 있어 아래 이유로 Worker로 분리했습니다.

- **UI 스레드 보호**: 파싱/정규화 CPU 작업을 백그라운드로 이동
- **안정적인 재연결 루프**: WS 끊김/재연결(backoff)을 UI 로직과 분리
- **단순한 메인 스레드**: Worker가 보내는 “최종 정리 tick”만 반영

관련 파일:

- `workers/domestic-exchange/upbit-ticker.worker.js`
- `workers/domestic-exchange/bithumb-ticker.worker.js`
- `workers/domestic-exchange/coinone-ticker.worker.js`
- 엔트리 URL: `lib/domestic-exchange-worker-urls.ts` → `app/(market)/main/page.tsx`에서 `new Worker(url)`에 전달

(`.ts` 확장자로 번들하면 `/_next/static/media/*.ts` URL이 되어 브라우저가 MIME을 `video/mp2t`로 잡는 문제가 있어, 워커는 `.js`로 둡니다. 라우트·페이지와 분리하려고 `app/` 밖 `workers/`에 둡니다.)

## WS → REST fallback 전략

국내 거래소(업비트/빗썸/코인원) 데이터는 우선 WS로 받습니다. 다만 환경/네트워크에 따라 WS가 지연되거나 끊길 수 있으므로, 일정 조건에서 **REST 폴백**을 동작시킵니다.

### 1) WS

- Worker가 WS를 연결하고 ticker 구독
- 끊기면 Worker 내부에서 **지수 backoff**로 자동 재연결
- 재연결이 일정 횟수 이상 실패하면 Worker가 메인으로 `reconnect_failed` 신호를 보냄

### 2) Adaptive REST polling (fallback)

- 메인 스레드에서 `setTimeout` 기반으로 폴백을 스케줄링 (고정 `setInterval` 사용 안 함)
- 실패/미수신이면 backoff 증가(최대 cap)
- 성공하면 backoff를 낮게 리셋
- WS가 **live** + 데이터 준비 상태면 폴백은 요청을 중단

REST 프록시(브라우저 CORS/차단 회피):

- 업비트: `app/api/upbit/route.ts` (ticker proxy), `app/api/upbit/markets/route.ts` (market list)
- 빗썸: `app/api/bithumb/all-krw/route.ts` (ALL_KRW proxy)
- 코인원: `app/api/coinone/all-krw/route.ts` (ticker_new/KRW proxy)
- 바이낸스: `app/api/binance/prices/route.ts`

## 정합성(최신성) 문제 해결

WS/REST를 동시에 운영하면 아래 경합이 생길 수 있습니다.

- **REST 응답이 늦게 도착하여 WS 최신값을 덮음**
- **WS 메시지가 out-of-order로 도착하여 과거 tick이 최신 tick을 덮음**
- **재연결 직후 이전 세션의 늦은 메시지가 새 세션을 덮음**

이를 방지하기 위해, 심볼별로 “마지막 적용 키”를 저장하고, 더 오래된 이벤트는 drop 합니다.

### 최신성 키: `(connId, ts, seq)`

- **connId(epoch)**: WS 연결 세션. Worker가 `connect()`마다 증가
- **ts**: 거래소가 제공하는 timestamp(가능하면 공식 필드) 기반
- **seq**: 동일 `(connId, ts)`에서 tie-break용 로컬 증가값

메인 스레드는 심볼별로 마지막 적용 키를 저장하고, 새 업데이트가 들어오면 다음 규칙으로 적용 여부를 결정합니다.

1. `connId`가 큰 것이 최신
2. `connId`가 같으면 `ts`가 큰 것이 최신
3. `ts`도 같으면 `seq`가 큰 것이 최신

구현 위치:

- `app/(market)/main/page.tsx`의 `domesticLastKeyRef` 및 `shouldApply(...)`

> 참고: REST 폴백은 `connId=0`으로 처리하여, WS가 살아서 `connId>=1` 데이터가 들어오면 WS가 항상 우선됩니다. (REST는 안전망 역할)
