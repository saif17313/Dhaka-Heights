'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

const OUT_MS = 220;

export default function PageTransition({ children }) {
  const pathname = usePathname();
  const prevPathnameRef = useRef(pathname);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [stage, setStage] = useState('in');

  useEffect(() => {
    if (prevPathnameRef.current === pathname) {
      setDisplayChildren(children);
      return undefined;
    }
    prevPathnameRef.current = pathname;
    setStage('out');
    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setStage('in');
    }, OUT_MS);
    return () => clearTimeout(timeout);
  }, [pathname, children]);

  return <div className={`page-transition page-transition-${stage}`}>{displayChildren}</div>;
}
