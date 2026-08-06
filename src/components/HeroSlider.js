'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function mediaUrl(media) {
  if (!media) return '';
  if (typeof media === 'string') return media;
  return media.secureUrl || media.secure_url || media.url || '';
}

function cssBackground(imageUrl) {
  const escapedUrl = String(imageUrl || '').replace(/(["\\])/g, '\\$1');
  return `linear-gradient(rgba(11, 27, 61, 0.4), rgba(11, 27, 61, 0.75)), url("${escapedUrl}")`;
}

function linkProps(target) {
  if (target !== '_blank') return {};
  return { rel: 'noopener noreferrer' };
}

export default function HeroSlider({ hero, previewMode = false, previewViewport = 'desktop' }) {
  const slides = useMemo(
    () => (hero?.slides || []).filter((slide) => slide.isVisible !== false),
    [hero?.slides]
  );
  const autoplayMs = Number(hero?.autoplayMs) || 6000;
  const [currentSlide, setCurrentSlide] = useState(0);
  const timerRef = useRef(null);
  const slideCount = slides.length;
  const activeIndex = slideCount > 0 ? currentSlide % slideCount : 0;

  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);

    if (slideCount < 2) return;

    timerRef.current = setInterval(() => {
      setCurrentSlide((previous) => (previous + 1) % slideCount);
    }, autoplayMs);
  }, [autoplayMs, slideCount]);

  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]);

  const handleNext = () => {
    if (!slideCount) return;
    setCurrentSlide((previous) => (previous + 1) % slideCount);
    startTimer();
  };

  const handlePrev = () => {
    if (!slideCount) return;
    setCurrentSlide((previous) => (previous - 1 + slideCount) % slideCount);
    startTimer();
  };

  const handleDotClick = (index) => {
    setCurrentSlide(index);
    startTimer();
  };

  const handleScrollDown = (event) => {
    event.preventDefault();
    const element = document.getElementById('about');
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const handlePrimaryAction = (event, url, target) => {
    if (!url || target === '_blank' || !url.startsWith('#')) return;

    const targetElement = document.getElementById(url.slice(1));
    if (!targetElement) return;

    event.preventDefault();
    const headerOffset = 80;
    const elementPosition = targetElement.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    });
  };

  const handleSecondaryAction = (event, url, target) => {
    if (!url || target === '_blank' || !url.startsWith('#')) return;

    const targetElement = document.getElementById(url.slice(1));
    if (!targetElement) return;

    event.preventDefault();
    targetElement.scrollIntoView({ behavior: 'smooth' });
  };

  if (hero?.isVisible === false || slideCount === 0) return null;

  return (
    <section
      id="home"
      className={`hero-section ${previewMode ? `admin-hero-preview admin-hero-preview-${previewViewport}` : ''}`}
      aria-label="Welcome Banner"
      style={previewMode ? { height: 'min(680px, 70vh)', width: '100%' } : undefined}
    >
      <div className="slider-container">
        {/* Slider Wrapper */}
        <div className="slider-wrapper">
          {slides.map((slide, index) => {
            const desktopUrl = mediaUrl(slide.desktopMedia) || slide.desktopMediaUrl || '';
            const mobileUrl = mediaUrl(slide.mobileMedia) || slide.mobileMediaUrl || desktopUrl;
            const previewDesktopUrl = previewMode && previewViewport === 'mobile' ? mobileUrl : desktopUrl;

            return (
              <div
                key={slide.id || slide.clientKey || index}
                className={`slider-slide ${index === activeIndex ? 'active' : ''}`}
                aria-hidden={index !== activeIndex}
              >
                <div
                  className="slide-bg"
                  role="img"
                  aria-label={slide.imageAlt || ''}
                  style={{
                    '--hero-desktop-background': cssBackground(previewDesktopUrl),
                    '--hero-mobile-background': cssBackground(mobileUrl),
                  }}
                ></div>
                <div className="slide-content">
                  <div className="container">
                    <span className="slide-tag">{slide.eyebrow}</span>
                    {index === 0 ? (
                      <h1 className="slide-title">{slide.title}</h1>
                    ) : (
                      <h2 className="slide-title h1-replica">{slide.title}</h2>
                    )}
                    <p className="slide-desc">{slide.description}</p>
                    <div className="slide-actions">
                      {slide.primaryCtaLabel && slide.primaryCtaUrl && (
                        <a
                          href={slide.primaryCtaUrl}
                          target={slide.primaryCtaTarget || '_self'}
                          onClick={(event) => handlePrimaryAction(
                            event,
                            slide.primaryCtaUrl,
                            slide.primaryCtaTarget
                          )}
                          className="btn btn-primary"
                          {...linkProps(slide.primaryCtaTarget)}
                        >
                          <span>{slide.primaryCtaLabel} <i className="fa-solid fa-arrow-right"></i></span>
                        </a>
                      )}

                      {slide.secondaryCtaLabel && slide.secondaryCtaUrl && (
                        <a
                          href={slide.secondaryCtaUrl}
                          target={slide.secondaryCtaTarget || '_self'}
                          onClick={(event) => handleSecondaryAction(
                            event,
                            slide.secondaryCtaUrl,
                            slide.secondaryCtaTarget
                          )}
                          className="btn btn-secondary"
                          {...linkProps(slide.secondaryCtaTarget)}
                        >
                          <span>{slide.secondaryCtaLabel}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation buttons */}
        <div className="slider-controls">
          <button className="slider-btn prev-btn" onClick={handlePrev} aria-label="Previous Slide">
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <button className="slider-btn next-btn" onClick={handleNext} aria-label="Next Slide">
            <i className="fa-solid fa-arrow-right"></i>
          </button>
        </div>

        {/* Dots pagination */}
        <div className="slider-pagination">
          {slides.map((slide, index) => (
            <button
              key={slide.id || slide.clientKey || index}
              className={`pagination-dot ${index === activeIndex ? 'active' : ''}`}
              onClick={() => handleDotClick(index)}
              aria-label={`Slide ${index + 1}`}
            ></button>
          ))}
        </div>

        {/* Scroll down mouse indicator */}
        <a href="#about" onClick={handleScrollDown} className="scroll-down-indicator" aria-label="Scroll Down">
          <span className="scroll-mouse">
            <span className="scroll-wheel"></span>
          </span>
          <span className="scroll-text">Scroll Down</span>
        </a>
      </div>
    </section>
  );
}
