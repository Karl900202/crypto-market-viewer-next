import Header from "@/components/header";
import { MarketBootstrapPrefetch } from "@/components/market-bootstrap-prefetch";

/** 헤더·본문 콘텐츠 열 정렬 (넓은 화면에서 좌우 여백) */
const CONTENT_MAX_W = "max-w-[1400px]";

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-white">
      <MarketBootstrapPrefetch />
      <Header />

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div
          className={`mx-auto box-border flex h-full min-h-0 min-w-[1400px] w-full flex-col ${CONTENT_MAX_W} px-4 py-3`}
        >
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
