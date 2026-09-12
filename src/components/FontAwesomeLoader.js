'use client';

import { useEffect } from 'react';

const FA_URL = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';

/**
 * Non-render-blocking FontAwesome loader.
 * In layout.js, the stylesheet is preloaded (<link rel="preload" as="style">).
 * This component injects the active <link rel="stylesheet"> after mount,
 * ensuring FCP/LCP are never delayed by external CSS roundtrips.
 */
export default function FontAwesomeLoader() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FA_URL}"][rel="stylesheet"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FA_URL;
    document.head.appendChild(link);
  }, []);

  return null;
}
