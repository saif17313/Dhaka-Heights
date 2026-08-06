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
  const [modalType, setModalType] = useState(null);
  const [modalTargetId, setModalTargetId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      document.body.classList.remove('loading-active');
    }, shell.preloader.durationMs);

    return () => clearTimeout(timer);
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
        <div className="preloader-content">
          <div className="preloader-logo-wrapper">
            <img src={shell.brand.logoMedia?.secureUrl} alt={shell.brand.logoAlt} className="preloader-logo" />
          </div>
          <div className="preloader-line">
            <div className="preloader-progress"></div>
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
