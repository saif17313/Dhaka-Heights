'use client';

import React, { useEffect, useState } from 'react';

const RADIUS = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollableHeight > 0 ? Math.min(1, Math.max(0, scrollTop / scrollableHeight)) : 0);
      setIsVisible(scrollTop > 600);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      className={`scroll-to-top-btn ${isVisible ? 'visible' : ''}`}
      onClick={scrollToTop}
      aria-label={`Scroll to top, ${Math.round(progress * 100)}% of page read`}
    >
      <svg className="scroll-to-top-progress" viewBox="0 0 54 54" aria-hidden="true">
        <circle className="scroll-to-top-progress-track" cx="27" cy="27" r={RADIUS} />
        <circle
          className="scroll-to-top-progress-fill"
          cx="27"
          cy="27"
          r={RADIUS}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
        />
      </svg>
      <span className="scroll-to-top-arrow" aria-hidden="true">
        <i className="fa-solid fa-arrow-up" />
      </span>
    </button>
  );
}
