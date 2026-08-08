'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';
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

function normalizeTeamHeading(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

function TeamCard({ member, onOpen }) {
  const buttonRef = useRef(null);

  return (
    <button
      ref={buttonRef}
      type="button"
      className="about-team-card scroll-reveal zoom-in"
      onClick={() => onOpen(member, buttonRef.current)}
      aria-label={`View profile of ${member.name}`}
    >
      <div className="about-team-card-image-wrap">
        <img
          src={member.media?.secureUrl}
          alt={member.imageAlt || `${member.name} portrait`}
          loading="lazy"
          decoding="async"
        />
        <div className="about-team-card-overlay" aria-hidden="true">
          <span className="about-team-card-view">
            View Profile <i className="fa-solid fa-arrow-right-long" />
          </span>
        </div>
      </div>
      <div className="about-team-card-copy">
        <h3>{member.name}</h3>
        <p>{member.role}</p>
      </div>
    </button>
  );
}

function TeamMemberModal({ member, heading, onClose, returnFocusRef }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!member) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusableSelector =
      'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(focusableSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.requestAnimationFrame(() => closeRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.requestAnimationFrame(() => returnFocusRef?.current?.focus());
    };
  }, [member, onClose, returnFocusRef]);

  if (!member) return null;

  const paragraphs = String(member.biography || '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className="about-team-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="about-team-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-team-modal-title"
        aria-describedby={paragraphs.length ? 'about-team-modal-biography' : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="about-team-modal-header">
          <span>{heading || 'OUR TEAM'}</span>
          <button
            ref={closeRef}
            type="button"
            className="about-team-modal-close"
            onClick={onClose}
            aria-label="Close team member profile"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        </header>
        <div className="about-team-modal-rule" />
        <div className="about-team-modal-content">
          <div className="about-team-modal-copy">
            <h2 id="about-team-modal-title">{member.name}</h2>
            <p className="about-team-modal-role">{member.role}</p>
            <div className="about-team-modal-divider" />
            <div id="about-team-modal-biography" className="about-team-modal-biography">
              {paragraphs.length ? (
                paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
              ) : (
                <p>Profile details will be published soon.</p>
              )}
            </div>
          </div>
          <div className="about-team-modal-image">
            <img
              src={member.media?.secureUrl}
              alt={member.imageAlt || `${member.name} portrait`}
            />
          </div>
        </div>
      </div>
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
  const [selectedMember, setSelectedMember] = useState(null);
  const selectedMemberTriggerRef = useRef(null);
  const content = about.content;
  const media = Object.fromEntries(about.media.map((item) => [item.role, item]));
  const teamCategories = [...(about.teamCategories || [])].sort(
    (a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0),
  );
  const visibleTeam = [...(about.teamMembers || [])]
    .filter((item) => item.isVisible && item.media?.secureUrl)
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
  const visibleCategories = teamCategories.filter((category) => category.isVisible);
  const teamGroups = visibleCategories
    .map((category) => ({
      category,
      members: visibleTeam.filter((member) => member.categoryKey === category.itemKey),
    }))
    .filter((group) => group.members.length > 0);
  const teamSection = content.teamSection || {};
  const selectedCategory = selectedMember
    ? teamCategories.find((category) => category.itemKey === selectedMember.categoryKey)
    : null;
  const openMember = (member, trigger) => {
    selectedMemberTriggerRef.current = trigger;
    setSelectedMember(member);
  };
  const closeMember = () => setSelectedMember(null);

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
  }, [previewMode, visibleTeam.length, visibleCategories.length]);

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
        <section className="about-hero-banner">
          <div
            className="about-hero-bg-layer"
            style={{
              backgroundImage: `linear-gradient(rgba(11,27,61,.75),rgba(11,27,61,.75)), url("${media.hero?.media?.secureUrl}")`,
            }}
          />
          <h1 className="about-hero-title">{content.hero.title}</h1>
          <p className="about-hero-subtitle">{content.hero.subtitle}</p>
        </section>

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

        {(teamGroups.length > 0 || previewMode) && (
          <section className="about-team-section" aria-labelledby="about-team-heading">
            <div className="container-full about-team-container">
              <div className="about-team-heading scroll-reveal slide-left">
                <span className="section-tag-gold">{teamSection.tag || 'OUR TEAM'}</span>
                <h2 id="about-team-heading" className="section-title">
                  {teamSection.heading || 'Meet Our Leadership'}
                </h2>
                {teamSection.intro && <p>{teamSection.intro}</p>}
              </div>
              {teamGroups.length > 0 ? (
                <div className="about-team-groups">
                  {teamGroups.map(({ category, members }) => {
                    const repeatsSectionHeading =
                      normalizeTeamHeading(category.title) ===
                      normalizeTeamHeading(teamSection.heading);
                    const categoryHeadingId = `${category.itemKey}-heading`;

                    return (
                      <section
                        key={category.itemKey}
                        className="about-team-category"
                        aria-labelledby={repeatsSectionHeading ? 'about-team-heading' : categoryHeadingId}
                      >
                        {(!repeatsSectionHeading || category.description) && (
                          <header className="about-team-category-heading scroll-reveal slide-left">
                            {!repeatsSectionHeading && (
                              <h3 id={categoryHeadingId}>{category.title}</h3>
                            )}
                            {category.description && <p>{category.description}</p>}
                          </header>
                        )}
                        <div className="about-team-grid">
                          {members.map((member) => (
                            <TeamCard key={member.itemKey} member={member} onOpen={openMember} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="about-team-empty-preview">
                  Add a visible category and at least one visible team member with a portrait from
                  the Team tab to preview this section.
                </div>
              )}
            </div>
          </section>
        )}

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
      <TeamMemberModal
        member={selectedMember}
        heading={
          selectedCategory?.title || teamSection.modalHeading || teamSection.heading || 'OUR TEAM'
        }
        onClose={closeMember}
        returnFocusRef={selectedMemberTriggerRef}
      />
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
