'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const MIN_LOADING_MS = 500;
const DONE_VISIBLE_MS = 350;

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const key = `${pathname}?${searchParams.toString()}`;
  const prevKeyRef = useRef(key);
  const startedAtRef = useRef(0);
  const timeoutRef = useRef(null);
  const [phase, setPhase] = useState('idle');

  useEffect(() => {
    const start = () => {
      clearTimeout(timeoutRef.current);
      startedAtRef.current = Date.now();
      setPhase('loading');
    };

    // Capture phase so this runs before next/link's own click handler
    // calls preventDefault() and starts the (often near-instant) router navigation.
    const handleClick = (event) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (`${url.pathname}${url.search}` === key) return;
      start();
    };

    document.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('popstate', start);
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('popstate', start);
    };
  }, [key]);

  useEffect(() => {
    if (prevKeyRef.current === key) return;
    prevKeyRef.current = key;
    clearTimeout(timeoutRef.current);

    const elapsed = Date.now() - startedAtRef.current;
    const wait = Math.max(0, MIN_LOADING_MS - elapsed);
    timeoutRef.current = setTimeout(() => {
      setPhase('done');
      timeoutRef.current = setTimeout(() => setPhase('idle'), DONE_VISIBLE_MS);
    }, wait);

    return () => clearTimeout(timeoutRef.current);
  }, [key]);

  return <div className="route-progress-bar" data-phase={phase} aria-hidden="true" />;
}
