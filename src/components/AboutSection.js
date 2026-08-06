'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

function mediaUrl(image) {
  return image?.media?.secureUrl || image?.media?.secure_url || '';
}

function externalLinkProps(target) {
  return target === '_blank' ? { rel: 'noopener noreferrer' } : {};
}

const lerp = (start, end, factor) => start + (end - start) * factor;
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const mapRange = (value, inMin, inMax, outMin, outMax) => {
  const progress = clamp01((value - inMin) / (inMax - inMin));
  return outMin + progress * (outMax - outMin);
};

export default function AboutSection({ about, onPlayVideo, previewMode = false }) {
  const sectionRef = useRef(null);
  const rafRef = useRef(null);

  // Store refs for elements we'll animate
  const topImgRef = useRef(null);
  const bottomImgRef = useRef(null);

  // Smooth interpolated values (for inertial feel)
  const smoothValues = useRef({
    topImgScale: 1.12, topImgY: 0,
    bottomImgScale: 1.12, bottomImgY: 0,
  });

  // Target values (computed from scroll position)
  const targetValues = useRef({
    topImgScale: 1.12, topImgY: 0,
    bottomImgScale: 1.12, bottomImgY: 0,
  });

  const updateTargets = useCallback(() => {
    if (!sectionRef.current) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const sectionTop = rect.top;
    const sectionHeight = rect.height;

    // scrollY relative to section
    const scrollInSection = vh - sectionTop;
    const totalRange = sectionHeight + vh;

    // Section-relative scroll progress 0..1
    const progress = clamp01(scrollInSection / totalRange);
    const simScroll = progress * 2400;

    const tv = targetValues.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Render each image taller than its clipped frame and keep all movement
    // inside that overscan so the wrapper can never become visible.
    const topFrameHeight = topImgRef.current?.parentElement?.clientHeight || 0;
    const bottomFrameHeight = bottomImgRef.current?.parentElement?.clientHeight || 0;
    const topTravel = Math.min(96, topFrameHeight * 0.12);
    const bottomTravel = Math.min(96, bottomFrameHeight * 0.12);

    if (reduceMotion) {
      tv.topImgScale = 1.04;
      tv.topImgY = 0;
      tv.bottomImgScale = 1.04;
      tv.bottomImgY = 0;
      return;
    }

    // Preserve the current parallax effect with a safe minimum scale and a
    // responsive travel distance for desktop, tablet, and mobile frames.
    tv.topImgScale = mapRange(simScroll, 200, 2000, 1.12, 1.04);
    tv.topImgY = mapRange(simScroll, 200, 2000, -topTravel, topTravel);

    tv.bottomImgScale = mapRange(simScroll, 600, 2200, 1.12, 1.04);
    tv.bottomImgY = mapRange(simScroll, 600, 2200, -bottomTravel, bottomTravel);
  }, []);

  useEffect(() => {
    let hashRevealTimer;
    const onScroll = () => updateTargets();
    const onResize = () => updateTargets();
    const animationLoop = () => {
      const sv = smoothValues.current;
      const tv = targetValues.current;
      const lerpFactor = 0.08;

      sv.topImgScale = lerp(sv.topImgScale, tv.topImgScale, lerpFactor);
      sv.topImgY = lerp(sv.topImgY, tv.topImgY, lerpFactor);
      sv.bottomImgScale = lerp(sv.bottomImgScale, tv.bottomImgScale, lerpFactor);
      sv.bottomImgY = lerp(sv.bottomImgY, tv.bottomImgY, lerpFactor);

      if (topImgRef.current) {
        topImgRef.current.style.transform = `translate3d(0, ${sv.topImgY}px, 0) scale(${sv.topImgScale})`;
      }
      if (bottomImgRef.current) {
        bottomImgRef.current.style.transform = `translate3d(0, ${sv.bottomImgY}px, 0) scale(${sv.bottomImgScale})`;
      }

      rafRef.current = requestAnimationFrame(animationLoop);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    updateTargets();
    if (window.location.hash === '#about') {
      sectionRef.current
        ?.querySelectorAll('.scroll-reveal')
        .forEach((element) => element.classList.add('revealed'));
      hashRevealTimer = window.setTimeout(() => {
        sectionRef.current?.scrollIntoView({ block: 'start' });
        sectionRef.current
          ?.querySelectorAll('.scroll-reveal')
          .forEach((element) => element.classList.add('revealed'));
      }, 1600);
    }
    rafRef.current = requestAnimationFrame(animationLoop);

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (hashRevealTimer) window.clearTimeout(hashRevealTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateTargets]);

  if (!about || about.isVisible === false) return null;

  return (
    <section
      id="about"
      className={`about-section-premium ${previewMode ? 'admin-about-preview' : ''}`}
      ref={sectionRef}
    >
      {/* Subtle background glow */}
      <div className="about-premium-bg"></div>

      <div className="container-full about-premium-grid">
        {/* LEFT COLUMN: Text Content */}
        <div className={`about-premium-copy scroll-reveal slide-left ${previewMode ? 'revealed' : ''}`}>
          <span className="section-tag-gold">{about.tagText}</span>

          <h2 className="section-title-premium">
            {about.heading}{' '}
            <span className="gold-text">{about.highlightedHeading}</span>
          </h2>

          <p className="about-lead-premium">
            {about.leadText}
          </p>

          <div className="about-bottom-para">
            <p className="about-text-premium">
              {about.bodyText}
            </p>
          </div>

          <div className="about-actions-premium">
            <Link
              href={about.primaryCtaUrl}
              target={about.primaryCtaTarget || '_self'}
              className="btn-premium btn-gold"
              id="btn-about-corporate"
              {...externalLinkProps(about.primaryCtaTarget)}
            >
              <span>{about.primaryCtaLabel} <i className="fa-solid fa-arrow-right"></i></span>
            </Link>
            <button
              onClick={onPlayVideo}
              className="btn-premium btn-outline-navy"
              aria-label="Play Corporate Video"
            >
              <span><i className="fa-solid fa-play" style={{ marginRight: '10px' }}></i> {about.videoButtonLabel}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Scattered Overlapping Images */}
        <div className={`about-premium-visuals scroll-reveal slide-right ${previewMode ? 'revealed' : ''}`}>
          {/* Top Image - wide landscape */}
          <div className="overview-top-img">
            <img
              ref={topImgRef}
              src={mediaUrl(about.topImage)}
              alt={about.topImage?.imageAlt || ''}
              className="parallax-inner-img"
              style={{
                top: '-16%',
                height: '132%',
                display: 'block',
                transformOrigin: 'center center',
                backfaceVisibility: 'hidden',
              }}
            />
          </div>

          {/* Bottom Image - tall portrait, overlaps upwards */}
          <div className="overview-bottom-img">
            <img
              ref={bottomImgRef}
              src={mediaUrl(about.bottomImage)}
              alt={about.bottomImage?.imageAlt || ''}
              className="parallax-inner-img"
              style={{
                top: '-16%',
                height: '132%',
                display: 'block',
                transformOrigin: 'center center',
                backfaceVisibility: 'hidden',
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
