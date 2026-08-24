'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { usePublicShell } from './PublicShellProvider';

const DURATION_MS = 500;
const SEGMENTS = 4;

export default function RouteLoader() {
  const shell = usePublicShell();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const hideTimeoutRef = useRef(null);
  const frameRef = useRef(null);
  const startedAtRef = useRef(null);
  const navigationCompleteRef = useRef(true);

  // When route changes, initiate the hiding sequence
  useEffect(() => {
    // If we're not currently animating, do nothing
    if (navigationCompleteRef.current) return;
    navigationCompleteRef.current = true;

    const hide = () => {
      // Wait a frame before unmounting to ensure paint
      frameRef.current = requestAnimationFrame(() => {
        setVisible(false);
      });
    };

    const now = performance.now();
    const elapsed = now - (startedAtRef.current || now);
    const remaining = Math.max(0, DURATION_MS - elapsed);

    clearTimeout(hideTimeoutRef.current);
    if (remaining > 0) {
      hideTimeoutRef.current = setTimeout(hide, remaining);
    } else {
      hide();
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const start = () => {
      navigationCompleteRef.current = false;
      clearTimeout(hideTimeoutRef.current);
      cancelAnimationFrame(frameRef.current);
      setProgress(0);
      setVisible(true);
      startedAtRef.current = performance.now();

      const tick = (now) => {
        const elapsed = now - startedAtRef.current;
        setProgress(Math.min(100, Math.round((elapsed / DURATION_MS) * 100)));
        if (elapsed < DURATION_MS) {
          frameRef.current = requestAnimationFrame(tick);
        }
      };
      frameRef.current = requestAnimationFrame(tick);
      
      // Fallback: forcefully hide after 5 seconds
      hideTimeoutRef.current = setTimeout(() => {
        navigationCompleteRef.current = true;
        setVisible(false);
      }, 5000);
    };

    // Initial hard load logic
    if (pathname !== '/') {
      start();
      hideTimeoutRef.current = setTimeout(() => {
        navigationCompleteRef.current = true;
        setVisible(false);
      }, DURATION_MS);
    }

    const handleClick = (event) => {
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target.closest('a[href]');
      if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download') || anchor.hasAttribute('data-route-loader-skip')) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (anchor.getAttribute('href').startsWith('#')) return;

      // Handle same-page links
      if (`${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`) {
        // Allow native anchor scrolling if hash is different
        if (url.hash && url.hash !== window.location.hash) {
          return;
        }
        event.preventDefault();
        start();
        setTimeout(() => window.location.reload(), DURATION_MS);
        return;
      }
      
      start();
    };

    document.addEventListener('click', handleClick, { capture: true });
    window.addEventListener('popstate', start);
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('popstate', start);
      clearTimeout(hideTimeoutRef.current);
      cancelAnimationFrame(frameRef.current);
    };
  }, []); // Run on initial mount and set up listeners

  if (!visible) return null;

  return (
    <div className="route-loader" role="presentation" aria-hidden="true">
      <span className="route-loader-frame route-loader-frame-tl" />
      <span className="route-loader-frame route-loader-frame-tr" />
      <span className="route-loader-frame route-loader-frame-bl" />
      <span className="route-loader-frame route-loader-frame-br" />
      <div className="route-loader-content">
        {shell.brand.logoMedia?.secureUrl && (
          <img src={shell.brand.logoMedia.secureUrl} alt="" className="route-loader-logo" />
        )}
        <div className="route-loader-dots">
          {Array.from({ length: SEGMENTS }, (_, index) => (
            <span key={index} className={`route-loader-dot ${progress >= ((index + 1) / SEGMENTS) * 100 ? 'filled' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
