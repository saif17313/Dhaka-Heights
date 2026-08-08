'use client';

import { useEffect, useRef, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';

function normalizeTeamHeading(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
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

export default function OurTeamPageClient({ about, previewMode = false }) {
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

  if (!about.isVisible) return null;

  const body = (
    <>
      <main style={{ marginTop: previewMode ? 0 : '80px' }}>
        <PageHeader
          title="Our Team"
          subtitle={teamSection.intro}
          breadcrumbs={[{ label: 'About', url: '/about' }, { label: 'Our Team' }]}
          bgImage={media.sustainability?.media?.secureUrl || media.hero?.media?.secureUrl}
        />

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
                  the Team tab to preview this page.
                </div>
              )}
            </div>
          </section>
        )}
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
