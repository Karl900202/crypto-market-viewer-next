import Header from "@/components/header";
import { MarketBootstrapPrefetch } from "@/components/market-bootstrap-prefetch";
import { MarketLayoutViewport } from "@/components/market-layout-viewport";

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground"
      suppressHydrationWarning
    >
      <MarketBootstrapPrefetch />
      <Header />

      <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <MarketLayoutViewport>{children}</MarketLayoutViewport>
      </div>
    </div>
  );
}
