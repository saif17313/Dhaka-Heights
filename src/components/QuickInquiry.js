'use client';

import React, { useState } from 'react';
import { usePublicShell } from './PublicShellProvider';

export default function QuickInquiry() {
  const { quickInquiry } = usePublicShell();
  const [isHovered, setIsHovered] = useState(false);

  const handleInquiryClick = (e) => {
    e.preventDefault();
    const contactSection = document.getElementById(quickInquiry.targetId);
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div 
      className={`quick-inquiry-drawer ${isHovered ? 'expanded' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleInquiryClick}
      role="button"
      aria-label={quickInquiry.tabLabel}
    >
      <div className="inquiry-drawer-tab">
        <i className="fa-solid fa-envelope-open-text tab-icon"></i>
        <span className="tab-label">{quickInquiry.tabLabel}</span>
      </div>
      <div className="inquiry-drawer-body">
        <h4>{quickInquiry.title}</h4>
        <p>{quickInquiry.phone}</p>
        <div className="drawer-divider"></div>
        <span className="drawer-btn-link">
          {quickInquiry.ctaLabel} <i className="fa-solid fa-arrow-right"></i>
        </span>
      </div>
    </div>
  );
}
