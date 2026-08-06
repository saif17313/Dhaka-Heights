'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

function formatValue(value, target) {
  const targetText = String(target);
  const decimalPlaces = targetText.includes('.') ? Math.min(targetText.split('.')[1].length, 2) : 0;
  const displayValue = decimalPlaces ? value : Math.floor(value);
  return displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

export default function Metrics({ statistics, previewMode = false }) {
  const metrics = useMemo(
    () => (statistics?.metrics || []).filter((metric) => metric.isVisible !== false),
    [statistics]
  );
  const [counts, setCounts] = useState(() => metrics.map(() => 0));
  const sectionRef = useRef(null);

  useEffect(() => {
    if (previewMode) return undefined;
    let timer;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          const duration = 1500; // 1.5 seconds animation
          const steps = 40;
          const stepTime = duration / steps;

          let currentStep = 0;
          clearInterval(timer);
          timer = setInterval(() => {
            currentStep++;
            setCounts(() =>
              metrics.map((metric) => {
                const target = metric.value;
                const value = (target / steps) * currentStep;
                return value >= target ? target : value;
              })
            );

            if (currentStep >= steps) {
              clearInterval(timer);
            }
          }, stepTime);
        } else {
          // Reset when scrolled out
          setCounts(metrics.map(() => 0));
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = sectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      clearInterval(timer);
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [metrics, previewMode]);

  if (!statistics || statistics.isVisible === false) return null;

  return (
    <section className="metrics-section" ref={sectionRef}>
      <div className="container grid-4">
        {metrics.map((metric, idx) => (
          <div key={metric.itemKey} className={`metric-item scroll-reveal zoom-in ${previewMode ? 'revealed' : ''}`}>
            <div className="metric-icon-box">
              <i className={`fa-solid ${metric.iconKey}`} aria-hidden="true"></i>
            </div>
            <div className="metric-number-box">
              <span className="metric-number">
                {formatValue(previewMode ? metric.value : (counts[idx] || 0), metric.value)}
              </span>
              <span className="metric-suffix">{metric.suffix}</span>
            </div>
            <p className="metric-label">{metric.label}</p>
            <p className="metric-subtext">{metric.supportingText}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
