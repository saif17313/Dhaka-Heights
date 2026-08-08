'use client';

import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import HeroSlider from './HeroSlider';
import AboutSection from './AboutSection';
import Metrics from './Metrics';
import ProjectsGrid from './ProjectsGrid';
import CommitmentQuote from './CommitmentQuote';
import MediaGrid from './MediaGrid';
import PartnersCarousel from './PartnersCarousel';
import ContactForm from './ContactForm';
import Footer from './Footer';
import DetailsModal from './DetailsModal';
import QuickInquiry from './QuickInquiry';
import ScrollToTop from './ScrollToTop';
import { usePublicShell } from './PublicShellProvider';

export default function HomePageClient({ hero, about, statistics, featuredProjects, commitmentQuote, mediaHighlights, partnersCarousel, contactSection, contactMap }) {
  const shell = usePublicShell();
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [modalType, setModalType] = useState(null);
  const [modalTargetId, setModalTargetId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const duration = shell.preloader.durationMs;
    const startedAt = performance.now();
    let frame;

    const tick = (now) => {
      const elapsed = now - startedAt;
      setProgress(Math.min(100, Math.round((elapsed / duration) * 100)));
      if (elapsed < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const timer = setTimeout(() => {
      setIsLoading(false);
      document.body.classList.remove('loading-active');
    }, duration);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [shell.preloader.durationMs]);

  useEffect(() => {
    const revealElements = document.querySelectorAll('.scroll-reveal');
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          } else {
            entry.target.classList.remove('revealed');
          }
        });
      },
      { threshold: 0.1 }
    );

    revealElements.forEach((element) => revealObserver.observe(element));

    return () => {
      revealElements.forEach((element) => revealObserver.unobserve(element));
    };
  }, [isLoading, activeFilter]);

  const handlePlayVideo = () => {
    setModalType('video');
    setModalTargetId(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalType(null);
    setModalTargetId(null);
  };

  return (
    <div className={isLoading ? 'loading-active' : ''}>
      {/* PAGE PRELOADER */}
      <div id="preloader" className={`preloader ${!isLoading ? 'fade-out' : ''}`}>
        <div className="preloader-panel preloader-panel-left"></div>
        <div className="preloader-panel preloader-panel-right"></div>
        <div className="preloader-content">
          <span className="preloader-frame preloader-frame-tl"></span>
          <span className="preloader-frame preloader-frame-tr"></span>
          <span className="preloader-frame preloader-frame-bl"></span>
          <span className="preloader-frame preloader-frame-br"></span>
          <div className="preloader-logo-wrapper">
            <img src={shell.brand.logoMedia?.secureUrl} alt={shell.brand.logoAlt} className="preloader-logo" />
          </div>
          <div className="preloader-dots" role="presentation" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => (
              <span key={index} className={`preloader-dot ${progress >= (index + 1) * 10 ? 'filled' : ''}`} />
            ))}
          </div>
          <h2 className="preloader-title">{shell.preloader.title}</h2>
          <p className="preloader-subtitle">{shell.preloader.subtitle}</p>
        </div>
      </div>

      {/* HEADER & MOBILE MENU */}
      <Navbar onFilterSelect={setActiveFilter} />

      {/* QUICK INQUIRY STICKY DRAWER */}
      <QuickInquiry />

      {/* MAIN SECTIONS */}
      <main>
        {/* HERO BANNER SLIDER */}
        <HeroSlider hero={hero} />

        {/* ABOUT CORPORATE BLOCK */}
        <AboutSection about={about} onPlayVideo={handlePlayVideo} />

        {/* METRIC STATS BANNER */}
        <Metrics statistics={statistics} />

        {/* PROPERTIES FILTER showcase */}
        <ProjectsGrid
          featuredProjects={featuredProjects}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {/* COMMITMENT QUOTE STATEMENT - inspired by Dominno and Fortress */}
        <CommitmentQuote commitmentQuote={commitmentQuote} />

        {/* MEDIA PRESS HIGHLIGHTS */}
        <MediaGrid mediaHighlights={mediaHighlights} />

        {/* INFINITE PARTNERS CAROUSEL */}
        <PartnersCarousel partnersCarousel={partnersCarousel} />

        {/* INTERACTIVE FORM & MAP */}
        <ContactForm contactSection={contactSection} mapConfig={contactMap} />
      </main>

      {/* FOOTER COORDINATES */}
      <Footer onFilterSelect={setActiveFilter} />

      {/* GLOBAL MODALS SYSTEM */}
      <DetailsModal
        isOpen={isModalOpen}
        modalType={modalType}
        targetId={modalTargetId}
        onClose={handleCloseModal}
      />

      {/* SCROLL TO TOP */}
      <ScrollToTop />
    </div>
  );
}
