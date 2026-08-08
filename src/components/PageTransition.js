'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const DURATION_MS = 420;

export default function PageTransition({ children }) {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  const [current, setCurrent] = useState(children);
  const [outgoing, setOutgoing] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (prevPathnameRef.current === pathname) {
      setCurrent(children);
      return undefined;
    }
    prevPathnameRef.current = pathname;
    clearTimeout(timeoutRef.current);
    setOutgoing(current);
    setCurrent(children);
    timeoutRef.current = setTimeout(() => setOutgoing(null), DURATION_MS);
    return () => clearTimeout(timeoutRef.current);
    // Intentionally excludes `current`/`children` - only pathname changes should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <div className="page-transition-stack">
      <div key={pathname} className="page-transition-layer page-transition-in">{current}</div>
      {outgoing && (
        <div className="page-transition-layer page-transition-out" aria-hidden="true">
          {outgoing}
        </div>
      )}
    </div>
  );
}
