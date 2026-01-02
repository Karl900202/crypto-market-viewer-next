export default function Loading() {
  // 스켈레톤 로딩 컴포넌트
  const SkeletonRow = () => (
    <tr className="border-b border-gray-800">
      <td className="py-3 px-4">
        <div className="h-4 w-24 bg-gray-700 rounded animate-skeleton"></div>
        <div className="h-3 w-16 bg-gray-700 rounded animate-skeleton mt-2"></div>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-20 bg-gray-700 rounded animate-skeleton ml-auto"></div>
        <div className="h-3 w-16 bg-gray-700 rounded animate-skeleton ml-auto mt-2"></div>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-16 bg-gray-700 rounded animate-skeleton ml-auto"></div>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-16 bg-gray-700 rounded animate-skeleton ml-auto"></div>
        <div className="h-3 w-12 bg-gray-700 rounded animate-skeleton ml-auto mt-2"></div>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-16 bg-gray-700 rounded animate-skeleton ml-auto"></div>
        <div className="h-3 w-12 bg-gray-700 rounded animate-skeleton ml-auto mt-2"></div>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-16 bg-gray-700 rounded animate-skeleton ml-auto"></div>
        <div className="h-3 w-12 bg-gray-700 rounded animate-skeleton ml-auto mt-2"></div>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="h-4 w-20 bg-gray-700 rounded animate-skeleton ml-auto"></div>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Exchange Selection Bar */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-gray-400 text-sm">기준 거래소</label>
                <div className="bg-gray-700 h-8 w-32 rounded border border-gray-600 animate-skeleton"></div>
              </div>

              <div className="text-gray-500">⇄</div>

              <div className="flex items-center space-x-2">
                <label className="text-gray-400 text-sm">
                  바이낸스 USDT 마켓
                </label>
                <div className="bg-gray-700 h-8 w-40 rounded border border-gray-600 animate-skeleton"></div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <div className="h-4 w-24 bg-gray-700 rounded animate-skeleton"></div>
              <div className="bg-gray-700 h-10 w-48 rounded border border-gray-600 animate-skeleton"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Coin Table */}
      <div className="container mx-auto px-4 py-6">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[1200px]">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[180px]" />
              <col className="w-[120px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[180px]" />
              <col className="w-[150px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-normal">
                  이름
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  현재가
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  김프
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  전일대비
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  고가대비(전일)
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  저가대비(전일)
                </th>
                <th className="text-right py-3 px-4 text-gray-400 font-normal">
                  거래액(일)
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 9 }).map((_, index) => (
                <SkeletonRow key={index} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
