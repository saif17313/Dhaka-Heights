'use client';

import { useEffect, useRef, useState } from 'react';
import { usePublicShell } from './PublicShellProvider';

const DURATION_MS = 500;
const SEGMENTS = 4;

export default function RouteLoader() {
  const shell = usePublicShell();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const hideTimeoutRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const start = () => {
      clearTimeout(hideTimeoutRef.current);
      cancelAnimationFrame(frameRef.current);
      setProgress(0);
      setVisible(true);

      const startedAt = performance.now();
      const tick = (now) => {
        const elapsed = now - startedAt;
        setProgress(Math.min(100, Math.round((elapsed / DURATION_MS) * 100)));
        if (elapsed < DURATION_MS) frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);
      hideTimeoutRef.current = setTimeout(() => setVisible(false), DURATION_MS);
    };

    // Capture phase so this runs before next/link's own click handler
    // calls preventDefault() and starts the router navigation.
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
      if (`${url.pathname}${url.search}` === `${window.location.pathname}${window.location.search}`) return;
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
  }, []);

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
