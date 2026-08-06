'use client';

import React from 'react';
import Link from 'next/link';

export default function PageHeader({ title, subtitle, breadcrumbs = [], bgImage }) {
  const bgStyle = bgImage
    ? { backgroundImage: `linear-gradient(rgba(11, 27, 61, 0.25), rgba(11, 27, 61, 0.55)), url("${bgImage}")` }
    : {};

  return (
    <section className="page-header-section">
      <div className="page-header-bg" style={bgStyle}></div>
      <div className="page-header-overlay"></div>
      
      <div className="container page-header-container">
        <div className="page-header-content scroll-reveal revealed">
          <div className="breadcrumbs">
            <Link href="/" className="breadcrumb-link">Home</Link>
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                <span className="breadcrumb-separator"><i className="fa-solid fa-chevron-right"></i></span>
                {crumb.url ? (
                  <Link href={crumb.url} className="breadcrumb-link">{crumb.label}</Link>
                ) : (
                  <span className="breadcrumb-current">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </div>
          
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
          <div className="page-header-gold-line"></div>
        </div>
      </div>
    </section>
  );
}
