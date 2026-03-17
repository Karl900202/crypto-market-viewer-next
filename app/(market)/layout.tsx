import Header from "@/components/header";

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
