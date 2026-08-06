'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePublicShell } from './PublicShellProvider';

function linkProps(target) { return target === '_blank' ? { target, rel: 'noopener noreferrer' } : { target }; }

export default function Footer() {
  const pathname = usePathname();
  const shell = usePublicShell();
  const footer = shell.footer;
  const groups = shell.footerGroups.filter((group) => group.isVisible);
  const socials = shell.socialLinks.filter((item) => item.isVisible);
  const handleScroll = (event, url) => {
    if (pathname !== '/' || !url.startsWith('/#')) return;
    event.preventDefault();
    const element = document.getElementById(url.slice(2));
    if (element) window.scrollTo({ top: element.getBoundingClientRect().top + window.pageYOffset - 80, behavior: 'smooth' });
  };
  return (
    <footer className="main-footer">
      <div className="footer-top-container"><div className="container grid-4">
        <div className="footer-col brand-col">
          <div className="logo-container"><Link href="/"><div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><img src={shell.brand.logoMedia?.secureUrl} alt={shell.brand.logoAlt} className="footer-logo" style={{ height: '54px', width: '54px' }} /><div className="logo-text"><span className="brand-title">{shell.brand.brandTitle}</span><span className="brand-subtitle">{shell.brand.brandSubtitle}</span></div></div></Link></div>
          <p className="footer-brand-desc">{footer.brandDescription}</p>
          <div className="footer-social-links">{socials.map((item) => <a key={item.itemKey} href={item.url} {...linkProps(item.target)} aria-label={item.platformName}><i className={`fa-brands ${item.iconKey}`}></i></a>)}</div>
        </div>
        {groups.map((group) => <div className="footer-col" key={group.groupKey}><h3 className="footer-col-title">{group.title}</h3><ul className="footer-links-list">{group.links.filter((item) => item.isVisible).map((item) => <li key={item.linkKey}><Link href={item.url} {...linkProps(item.target)} onClick={(event) => handleScroll(event, item.url)} className="footer-link-item">{item.label}</Link></li>)}</ul></div>)}
        <div className="footer-col address-col"><h3 className="footer-col-title">Corporate Office</h3><p className="footer-address"><i className="fa-solid fa-location-dot"></i> {footer.address}</p><p className="footer-contact-item"><i className="fa-solid fa-phone"></i> Hotline: {footer.phone}</p><p className="footer-contact-item"><i className="fa-solid fa-envelope"></i> Email: {footer.email}</p><p className="footer-contact-item"><i className="fa-solid fa-globe"></i> Web: {footer.website}</p></div>
      </div></div>
      <div className="footer-bottom-container"><div className="container footer-bottom-flex"><p className="copyright-text">{footer.copyright}</p><p className="credits-text">Developed by <a href={footer.developerUrl} target="_blank" rel="noopener noreferrer" className="gold-text" style={{ textDecoration: 'none', transition: 'color 0.2s' }}>{footer.developerName}</a></p></div></div>
    </footer>
  );
}
