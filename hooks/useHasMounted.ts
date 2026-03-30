import { useEffect, useState } from "react";

/** SSR·첫 클라이언트 페인트를 동일하게 유지한 뒤, 마운트 후에만 뷰포트 의존 UI를 켠다 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
