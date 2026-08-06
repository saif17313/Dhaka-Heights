'use client';

import { useRef } from 'react';
import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';

function InteractiveOverviewImage({ src, alt }) {
  const frameRef = useRef(null);
  const move = (event) => {
    if (!frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    const rotateX = (((rect.height / 2) - (event.clientY - rect.top)) / (rect.height / 2)) * 12;
    const rotateY = (((event.clientX - rect.left) - (rect.width / 2)) / (rect.width / 2)) * 12;
    frameRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03, 1.03, 1.03)`;
  };
  const reset = () => { if (frameRef.current) frameRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'; };
  return <div ref={frameRef} onMouseMove={move} onMouseLeave={reset} style={{ position: 'relative', padding: '20px', transition: 'transform 0.15s ease-out, box-shadow 0.15s', transformStyle: 'preserve-3d', width: '100%', maxWidth: '500px', margin: '0 auto', cursor: 'pointer' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, width: '92%', height: '92%', border: '2px solid var(--accent-gold)', borderRadius: '8px', transform: 'translate(10px, 10px) translateZ(-15px)', zIndex: 0 }} />
    <img src={src} alt={alt} style={{ position: 'relative', zIndex: 1, width: '100%', height: 'auto', maxHeight: '400px', objectFit: 'cover', borderRadius: '8px', boxShadow: '0 25px 50px rgba(11,27,61,0.22)', transform: 'translateZ(20px)' }} />
  </div>;
}

function ServiceCapabilityCard({ service }) {
  const cardRef = useRef(null);
  const move = (event) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const rotateX = (((rect.height / 2) - (event.clientY - rect.top)) / (rect.height / 2)) * 8;
    const rotateY = (((event.clientX - rect.left) - (rect.width / 2)) / (rect.width / 2)) * 8;
    cardRef.current.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
  };
  const reset = () => { if (cardRef.current) cardRef.current.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'; };
  return <div ref={cardRef} onMouseMove={move} onMouseLeave={reset} className="service-capability-card" style={{ transition: 'transform 0.12s ease-out, box-shadow 0.4s, border-color 0.4s' }}><div style={{ transform: 'translateZ(30px)' }}><div className="text-gold"><i className={`fa-solid ${service.icon}`} /></div><h4 style={{ color: '#ffffff', fontSize: '1.1rem', fontFamily: 'var(--font-playfair)', fontWeight: 600, marginBottom: '8px' }}>{service.title}</h4><p style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: 1.5, margin: 0 }}>{service.description}</p></div></div>;
}

export default function ConcernDetailClient({ concern, concernsPage, previewMode = false }) {
  const labels = concernsPage.content.labels;
  const body = <main style={{ marginTop: previewMode ? 0 : '80px' }}>
    <PageHeader title={concern.name} subtitle={concern.subtitle} breadcrumbs={[{ label: labels.aboutBreadcrumb, url: '/about' }, { label: labels.concernsBreadcrumb, url: '/about#concerns' }, { label: concern.name }]} bgImage={concernsPage.content.header.media?.secureUrl} />
    <section className="concern-overview-section bg-white" style={{ padding: '100px 0' }}><div className="container grid-2" style={{ alignItems: 'center' }}><div className="flex flex-col justify-center"><span className="section-tag-gold" style={{ display: 'inline-block', marginBottom: '10px' }}>{labels.profileTag}</span><h2 className="section-title text-navy font-serif" style={{ color: 'var(--primary-navy)', fontFamily: 'var(--font-playfair)', fontSize: '2.4rem', marginBottom: '24px' }}>{labels.overviewHeading}</h2><p className="text-gray-600 leading-relaxed mb-6" style={{ fontSize: '1rem', lineHeight: 1.8 }}>{concern.overview}</p><div className="flex flex-col gap-4 mt-2">{concern.features.map((feature, index) => <div key={`${feature}-${index}`} className="flex items-center text-sm font-semibold" style={{ color: 'var(--primary-navy)' }}><i className="fa-solid fa-square-check" style={{ color: 'var(--accent-gold)', marginRight: '10px', fontSize: '1.1rem' }} /> {feature}</div>)}</div></div><div className="flex items-center justify-center"><InteractiveOverviewImage src={concern.coverMedia?.secureUrl} alt={concern.coverAlt} /></div></div></section>
    <section className="services-section" style={{ backgroundColor: 'var(--base-light)', borderTop: '1px solid var(--border-light)', padding: '100px 0' }}><div className="container"><div className="text-center mb-12"><span className="section-tag-gold" style={{ display: 'inline-block', marginBottom: '10px' }}>{labels.servicesTag}</span><h2 className="section-title text-navy font-serif" style={{ color: 'var(--primary-navy)', fontFamily: 'var(--font-playfair)' }}>{labels.servicesHeading}</h2></div><div className="grid-2 mt-10 gap-8">{concern.services.map((service, index) => <ServiceCapabilityCard service={service} key={`${service.title}-${index}`} />)}</div></div></section>
    {concern.relatedProjects.length > 0 && <section className="related-projects-section bg-white" style={{ borderTop: '1px solid var(--border-light)', padding: '100px 0' }}><div className="container"><div className="text-center mb-12"><span className="section-tag-gold" style={{ display: 'inline-block', marginBottom: '10px' }}>{labels.portfolioTag}</span><h2 className="section-title text-navy font-serif" style={{ color: 'var(--primary-navy)', fontFamily: 'var(--font-playfair)' }}>{labels.portfolioHeading}</h2></div><div className="projects-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '40px', marginTop: '40px' }}>{concern.relatedProjects.map((project) => <Link key={project.id} href={`/project/${project.slug}`} className="project-card-premium" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}><div className="project-img-wrapper" style={{ position: 'relative', height: '260px', overflow: 'hidden' }}><img src={project.coverMedia?.secureUrl} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)' }} /><div className="project-badge" style={{ position: 'absolute', top: '15px', right: '15px', backgroundColor: 'var(--accent-gold)', color: '#fff', fontSize: '0.75rem', padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>{project.badgeText}</div></div><div className="project-info" style={{ padding: '20px' }}><span className="project-location" style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', display: 'block', marginBottom: '6px' }}><i className="fa-solid fa-location-dot" style={{ marginRight: '6px' }} /> {project.locationText}</span><h3 className="project-name" style={{ fontSize: '1.2rem', color: 'var(--primary-navy)', margin: '0 0 8px 0', fontFamily: 'var(--font-playfair)', fontWeight: 600 }}>{project.name}</h3><p style={{ fontSize: '0.85rem', color: '#777', margin: 0 }}>{project.type}</p></div></Link>)}</div></div></section>}
  </main>;
  if (previewMode) return <div>{body}</div>;
  return <div><Navbar />{body}<Footer /><ScrollToTop /></div>;
}
