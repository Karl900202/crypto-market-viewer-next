import Header from "@/components/header";

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      {children}
    </div>
  );
}
