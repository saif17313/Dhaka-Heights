'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePublicShell } from './PublicShellProvider';

function ExternalProps({ target }) {
  return target === '_blank' ? { target, rel: 'noopener noreferrer' } : { target };
}

function BrandLockup({ shell, logoUrl }) {
  return (
    <div className="logo-container">
      <img src={logoUrl} alt={shell.brand.logoAlt} className="header-logo" />
      <div className="logo-text nav-brand-lockup">
        <span className="brand-title nav-brand-title">{shell.brand.brandTitle}</span>
        <span className="brand-subtitle nav-brand-subtitle">{shell.brand.brandSubtitle}</span>
      </div>
    </div>
  );
}

export default function Navbar() {
  const shell = usePublicShell();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [openMobileKey, setOpenMobileKey] = useState(null);
  const lastScrollYRef = useRef(0);
  const pathname = usePathname();
  const isSubpage = pathname !== '/';
  const navigation = shell.navigation.filter((item) => item.isVisible);
  const socials = shell.socialLinks.filter((item) => item.isVisible);
  const logoUrl = shell.brand.logoMedia?.secureUrl;

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      setIsScrolled(currentY > 50);

      const delta = currentY - lastScrollYRef.current;
      if (currentY < 120) {
        setIsHidden(false);
      } else if (delta > 4) {
        setIsHidden(true);
      } else if (delta < -4) {
        setIsHidden(false);
      }
      lastScrollYRef.current = currentY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    document.body.classList.remove('loading-active');
  };

  const toggleDrawer = () => {
    setIsDrawerOpen((current) => {
      document.body.classList.toggle('loading-active', !current);
      return !current;
    });
  };

  const active = (url) =>
    url === '/' ? pathname === '/' : url !== '#' && pathname.startsWith(url.split('?')[0]);

  const dropdownActive = (children) =>
    children.some((child) => child.url !== '#' && active(child.url));

  return (
    <>
      <header
        className={`main-header ${isScrolled || isSubpage ? 'scrolled' : ''} ${isHidden && !isDrawerOpen ? 'nav-hidden' : ''}`}
        id="main-header"
      >
        <div className="header-container">
          <Link href="/" onClick={closeDrawer} className="logo-link" id="nav-logo-link">
            <BrandLockup shell={shell} logoUrl={logoUrl} />
          </Link>

          <nav className="desktop-nav" aria-label="Desktop Navigation">
            <ul className="nav-list">
              {navigation.map((item) => {
                const children = item.children.filter((child) => child.isVisible);
                const hasChildren = children.length > 0;
                return (
                  <li className={`nav-item ${hasChildren ? 'dropdown' : ''}`} key={item.itemKey}>
                    {item.url === '#' ? (
                      <span
                        className={`nav-link ${dropdownActive(children) ? 'active' : ''}`}
                        style={{ cursor: 'pointer' }}
                      >
                        {item.label}
                        {hasChildren && <i className="fa-solid fa-chevron-down dropdown-icon" />}
                      </span>
                    ) : (
                      <Link
                        href={item.url}
                        {...ExternalProps(item)}
                        className={`nav-link ${item.itemKey === 'nav-contact' ? 'contact-btn-nav ' : ''}${active(item.url) ? 'active' : ''}`}
                      >
                        {item.label}
                        {hasChildren && <i className="fa-solid fa-chevron-down dropdown-icon" />}
                      </Link>
                    )}
                    {hasChildren && (
                      <ul className="dropdown-menu">
                        {children.map((child) => (
                          <li key={child.itemKey}>
                            <Link href={child.url} {...ExternalProps(child)} className="dropdown-link">
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            className="mobile-menu-toggle"
            onClick={toggleDrawer}
            aria-label="Toggle Navigation Menu"
            aria-expanded={isDrawerOpen}
            id="mobile-menu-toggle-btn"
          >
            <span className="hamburger-line" />
            <span className="hamburger-line" />
            <span className="hamburger-line" />
          </button>
        </div>
      </header>

      <div className={`mobile-menu-drawer ${isDrawerOpen ? 'open' : ''}`} id="mobile-menu-drawer">
        <div className="drawer-header">
          <BrandLockup shell={shell} logoUrl={logoUrl} />
          <button className="drawer-close-btn" onClick={toggleDrawer} aria-label="Close Menu">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <nav className="mobile-nav" aria-label="Mobile Navigation">
          <ul className="mobile-nav-list">
            {navigation.map((item) => {
              const children = item.children.filter((child) => child.isVisible);
              const dropdown = item.mobileMode === 'dropdown' && children.length > 0;
              return dropdown ? (
                <li className="mobile-dropdown" key={item.itemKey}>
                  <button
                    className={`mobile-dropdown-btn ${openMobileKey === item.itemKey ? 'active' : ''}`}
                    onClick={() => setOpenMobileKey(openMobileKey === item.itemKey ? null : item.itemKey)}
                  >
                    {item.mobileLabel || item.label} <i className="fa-solid fa-chevron-down" />
                  </button>
                  <ul className={`mobile-dropdown-menu ${openMobileKey === item.itemKey ? 'open' : ''}`}>
                    {children.map((child) => (
                      <li key={child.itemKey}>
                        <Link
                          href={child.url}
                          {...ExternalProps(child)}
                          onClick={closeDrawer}
                          className="mobile-dropdown-link"
                        >
                          {child.mobileLabel || child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.itemKey}>
                  <Link
                    href={item.url === '#' ? '/' : item.url}
                    {...ExternalProps(item)}
                    onClick={closeDrawer}
                    className={`mobile-nav-link ${item.itemKey === 'nav-contact' ? 'm-contact-btn' : ''}`}
                  >
                    {item.mobileLabel || item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="drawer-footer">
            <p className="drawer-address">
              <i className="fa-solid fa-location-dot" /> {shell.mobileDrawer.address}
            </p>
            <p className="drawer-phone">
              <i className="fa-solid fa-phone" /> {shell.mobileDrawer.phone}
            </p>
            <div className="drawer-socials">
              {socials.slice(0, 3).map((item) => (
                <a key={item.itemKey} href={item.url} {...ExternalProps(item)} aria-label={item.platformName}>
                  <i className={`fa-brands ${item.iconKey}`} />
                </a>
              ))}
            </div>
          </div>
        </nav>
      </div>

      <div
        className={`drawer-overlay ${isDrawerOpen ? 'active' : ''}`}
        onClick={toggleDrawer}
        id="drawer-overlay"
      />
    </>
  );
}
