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
import { getCloudinaryUrl } from '@/lib/imageOptimization';

function HomePreloader({ shell, onFinished }) {
  const [progress, setProgress] = useState(0);
  const [isFadeOut, setIsFadeOut] = useState(false);
  const [isDestroyed, setIsDestroyed] = useState(false);

  useEffect(() => {
    const targetDuration = Math.min(450, Number(shell?.preloader?.durationMs) || 450);
    const startedAt = performance.now();
    let frame;

    const tick = (now) => {
      const elapsed = now - startedAt;
      setProgress(Math.min(100, Math.round((elapsed / targetDuration) * 100)));
      if (elapsed < targetDuration) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);

    const timer = setTimeout(() => {
      setIsFadeOut(true);
      document.body.classList.remove('loading-active');
      if (onFinished) onFinished();
    }, targetDuration);

    const removeTimer = setTimeout(() => {
      setIsDestroyed(true);
    }, targetDuration + 600);

    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
      cancelAnimationFrame(frame);
    };
  }, [shell?.preloader?.durationMs, onFinished]);

  if (isDestroyed) return null;

  return (
    <div id="preloader" className={`preloader ${isFadeOut ? 'fade-out' : ''}`}>
      <div className="preloader-content">
        <span className="preloader-frame preloader-frame-tl"></span>
        <span className="preloader-frame preloader-frame-tr"></span>
        <span className="preloader-frame preloader-frame-bl"></span>
        <span className="preloader-frame preloader-frame-br"></span>
        <div className="preloader-logo-wrapper">
          <img
            src={getCloudinaryUrl(shell.brand.logoMedia?.secureUrl, { width: 120 })}
            alt={shell.brand.logoAlt || 'Dhaka Heights Logo'}
            className="preloader-logo"
            width={72}
            height={72}
          />
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
  );
}

export default function HomePageClient({ hero, about, statistics, featuredProjects, commitmentQuote, mediaHighlights, partnersCarousel, contactSection, contactMap }) {
  const shell = usePublicShell();
  const [isLoading, setIsLoading] = useState(false);
  const [modalType, setModalType] = useState(null);
  const [modalTargetId, setModalTargetId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

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
  }, [activeFilter]);

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
    <div>
      {/* PAGE PRELOADER */}
      <HomePreloader shell={shell} onFinished={() => setIsLoading(false)} />


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
