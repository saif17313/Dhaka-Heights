'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';

function HighlightedHeading({ heading, highlight }) {
  const index = heading.indexOf(highlight);
  if (index < 0) return heading;
  return (
    <>
      {heading.slice(0, index)}
      <span className="gold-text">{highlight}</span>
      {heading.slice(index + highlight.length)}
    </>
  );
}

function ConcernCard({ concern }) {
  const cardRef = useRef(null);
  const move = (event) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    cardRef.current.style.transform = `perspective(1000px) rotateX(${((rect.height / 2 - y) / (rect.height / 2)) * 10}deg) rotateY(${((x - rect.width / 2) / (rect.width / 2)) * 10}deg) scale3d(1.02,1.02,1.02)`;
  };
  const leave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform =
        'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    }
  };
  return (
    <Link
      ref={cardRef}
      href={`/concern/${concern.slug}`}
      className="concern-card-premium"
      onMouseMove={move}
      onMouseLeave={leave}
      style={{
        transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out, border-color 0.2s',
      }}
    >
      <div
        className="concern-card-bg-layer"
        style={{ backgroundImage: `url(${concern.media?.secureUrl})` }}
      />
      <div className="concern-card-overlay-layer" />
      <div style={{ position: 'relative', zIndex: 3 }}>
        <h4
          className="concern-card-title"
          style={{
            color: '#fff',
            fontFamily: 'var(--font-playfair)',
            fontSize: '1.15rem',
            marginBottom: '8px',
          }}
        >
          {concern.title}
        </h4>
        <p
          className="concern-card-desc"
          style={{ color: 'rgba(255,255,255,.75)', fontSize: '.8rem', lineHeight: '1.4', margin: 0 }}
        >
          {concern.description}
        </p>
      </div>
      <div style={{ position: 'relative', zIndex: 3, marginTop: '15px' }}>
        <span className="concern-card-link-premium">
          {concern.ctaLabel} <i className="fa-solid fa-arrow-right-long" />
        </span>
      </div>
    </Link>
  );
}

function AccreditationCard({ item }) {
  const ref = useRef(null);
  const move = (event) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    ref.current.style.transform = `perspective(1000px) rotateX(${((rect.height / 2 - y) / (rect.height / 2)) * 8}deg) rotateY(${((x - rect.width / 2) / (rect.width / 2)) * 8}deg) scale3d(1.03,1.03,1.03)`;
  };
  return (
    <div
      ref={ref}
      className="accreditation-card-premium"
      onMouseMove={move}
      onMouseLeave={() => {
        if (ref.current) {
          ref.current.style.transform =
            'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
        }
      }}
      style={{ transition: 'transform 0.12s ease-out, border-color 0.2s' }}
    >
      <div className="accreditation-icon-gold">
        <i className={`fa-solid ${item.iconKey}`} />
      </div>
      <span className="accreditation-title-premium">{item.title}</span>
    </div>
  );
}

export default function AboutPageClient({ about, previewMode = false }) {
  const overviewRef = useRef(null);
  const overviewBackRef = useRef(null);
  const overviewFrontRef = useRef(null);
  const greenRef = useRef(null);
  const greenImgRef = useRef(null);
  const leadershipRef = useRef(null);
  const content = about.content;
  const media = Object.fromEntries(about.media.map((item) => [item.role, item]));

  useEffect(() => {
    if (previewMode) return undefined;
    const elements = document.querySelectorAll('.scroll-reveal');
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => entry.target.classList.toggle('revealed', entry.isIntersecting)),
      { threshold: 0.1 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => elements.forEach((element) => observer.unobserve(element));
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return undefined;
    const scroll = () => {
      const vh = window.innerHeight;
      if (overviewRef.current) {
        const rect = overviewRef.current.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (vh - rect.top) / (rect.height + vh)));
        if (overviewBackRef.current) {
          overviewBackRef.current.style.transform = `translateY(${(progress - 0.5) * 90}px)`;
        }
        if (overviewFrontRef.current) {
          overviewFrontRef.current.style.transform = `translateY(${(progress - 0.5) * -70}px)`;
        }
      }
      if (greenRef.current && greenImgRef.current) {
        const rect = greenRef.current.getBoundingClientRect();
        const progress = Math.max(0, Math.min(1, (vh - rect.top) / (rect.height + vh)));
        greenImgRef.current.style.transform = `translateY(${(progress - 0.5) * 110}px) scale(1.05)`;
      }
    };
    window.addEventListener('scroll', scroll, { passive: true });
    scroll();
    return () => window.removeEventListener('scroll', scroll);
  }, [previewMode]);

  if (!about.isVisible) return null;

  const body = (
    <>
      <main style={{ marginTop: previewMode ? 0 : '80px' }}>
        <PageHeader
          title={content.hero.title}
          subtitle={content.hero.subtitle}
          breadcrumbs={[{ label: 'About Us' }]}
          bgImage={media.hero?.media?.secureUrl}
        />

        <section className="about-editorial-section bg-cream-premium" ref={overviewRef}>
          <div className="container-full about-split-grid">
            <div className="about-split-copy scroll-reveal slide-left">
              <span className="section-tag-gold">{content.overview.tag}</span>
              <h2 className="section-title">
                <HighlightedHeading
                  heading={content.overview.heading}
                  highlight={content.overview.highlight}
                />
              </h2>
              {content.overview.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            <div className="about-overlapping-images">
              <img
                ref={overviewBackRef}
                src={media['overview-back']?.media?.secureUrl}
                alt={media['overview-back']?.imageAlt}
                className="overview-img-back"
                style={{ willChange: 'transform' }}
              />
              <img
                ref={overviewFrontRef}
                src={media['overview-front']?.media?.secureUrl}
                alt={media['overview-front']?.imageAlt}
                className="overview-img-front"
                style={{ willChange: 'transform' }}
              />
            </div>
          </div>
        </section>

        <section className="about-pillars-grid">
          {about.pillars
            .filter((item) => item.isVisible)
            .map((item) => (
              <div className="pillar-card-premium" key={item.itemKey}>
                <div
                  className="pillar-card-bg"
                  role="img"
                  aria-label={item.imageAlt}
                  style={{ backgroundImage: `url("${item.media?.secureUrl}")` }}
                />
                <div className="pillar-card-overlay" />
                <div className="pillar-card-icon">
                  <i className={`fa-solid ${item.iconKey}`} />
                </div>
                <h3 className="pillar-card-title">{item.title}</h3>
                <p className="pillar-card-text">{item.description}</p>
              </div>
            ))}
        </section>

        <section className="about-editorial-section bg-white-premium" ref={greenRef}>
          <div className="container-full about-split-grid">
            <div className="about-split-copy scroll-reveal slide-left">
              <span className="section-tag-gold">{content.sustainability.tag}</span>
              <h2 className="section-title" style={{ color: 'var(--primary-navy)' }}>
                <HighlightedHeading
                  heading={content.sustainability.heading}
                  highlight={content.sustainability.highlight}
                />
              </h2>
              {content.sustainability.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              <div className="sustainability-quote-block">
                <p className="sustainability-quote-text">{content.sustainability.quote}</p>
                <span className="sustainability-quote-author">
                  {content.sustainability.quoteAuthor}
                </span>
              </div>
            </div>
            <div className="about-details-image flex items-center justify-center">
              <img
                ref={greenImgRef}
                src={media.sustainability?.media?.secureUrl}
                alt={media.sustainability?.imageAlt}
                className="rounded shadow-2xl"
                style={{
                  width: '100%',
                  maxHeight: '450px',
                  objectFit: 'cover',
                  border: '1px solid var(--accent-gold)',
                  borderRadius: '8px',
                  boxShadow: '0 20px 45px rgba(11,27,61,.15)',
                  willChange: 'transform',
                }}
              />
            </div>
          </div>
        </section>

        <section className="about-editorial-section bg-charcoal-premium" ref={leadershipRef}>
          <div className="container">
            <div className="leadership-message-box scroll-reveal zoom-in">
              <span className="section-tag-gold" style={{ display: 'inline-block', marginBottom: '15px' }}>
                {content.leadership.tag}
              </span>
              <div className="leadership-quote-icon-top">
                <i className="fa-solid fa-quote-left" />
              </div>
              <p className="leadership-quote-editorial">{content.leadership.primaryQuote}</p>
              <p className="leadership-quote-editorial sub-quote">
                {content.leadership.secondaryQuote}
              </p>
              <div className="leadership-author-info">
                <h4 className="leader-name">{content.leadership.authorName}</h4>
                <p className="leader-title">{content.leadership.authorTitle}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="about-editorial-section bg-cream-premium">
          <div className="container-full">
            <div className="text-center mb-12">
              <span className="section-tag-gold">{content.concernsSection.tag}</span>
              <h2 className="section-title" style={{ color: 'var(--primary-navy)' }}>
                {content.concernsSection.heading}
              </h2>
            </div>
            <div className="concerns-minimal-grid">
              {about.concerns
                .filter((item) => item.isVisible)
                .map((item) => (
                  <ConcernCard key={item.placementId || item.canonicalId} concern={item} />
                ))}
            </div>
          </div>
        </section>

        <section className="about-editorial-section bg-white-premium">
          <div className="container-full">
            <div className="text-center mb-12">
              <span className="section-tag-gold">{content.accreditationsSection.tag}</span>
              <h2 className="section-title" style={{ color: 'var(--primary-navy)' }}>
                {content.accreditationsSection.heading}
              </h2>
            </div>
            <div className="accreditations-premium-row">
              {about.accreditations
                .filter((item) => item.isVisible)
                .map((item) => (
                  <AccreditationCard key={item.itemKey} item={item} />
                ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );

  if (previewMode) return <div className="about-preview-surface">{body}</div>;
  return (
    <div>
      <Navbar />
      {body}
      <Footer />
      <ScrollToTop />
    </div>
  );
}
