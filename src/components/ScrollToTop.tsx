// src/components/ScrollToTop.tsx
import React from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Global scroll resetter.
 * Ensures every navigation starts from the very top, even with query/hash changes
 * and regardless of browser scroll restoration.
 */
export default function ScrollToTop() {
  const location = useLocation();

  React.useLayoutEffect(() => {
    try { if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'; } catch {}

    const forceAll = () => {
      try { window.scrollTo(0, 0); } catch {}
      try { (document.scrollingElement || document.documentElement).scrollTop = 0; } catch {}
      try { document.documentElement.scrollTop = 0; } catch {}
      try { document.body.scrollTop = 0; } catch {}
      try {
        const root = document.getElementById('root');
        if (root) (root as HTMLElement).scrollTop = 0;
      } catch {}
      try {
        const mainEl = document.querySelector('main') as HTMLElement | null;
        if (mainEl) mainEl.scrollTop = 0;
      } catch {}
      try {
        const alt = document.querySelector('.scroll-container,[data-scroll-root]') as HTMLElement | null;
        if (alt) alt.scrollTop = 0;
      } catch {}
    };

    // Do it immediately, on the next frame, and once more after the frame
    forceAll();
    const id = requestAnimationFrame(() => {
      forceAll();
      setTimeout(forceAll, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [location.pathname, location.search, location.hash, location.key]);

  return null;
}
