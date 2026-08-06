import React from 'react';

function optimizedIconUrl(url) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', '/upload/f_auto,q_auto,c_fit,w_96,h_96/');
}

function PartnerCard({ partner, duplicate = false }) {
  return (
    <div className="partner-logo-card" aria-hidden={duplicate || undefined}>
      <div className="partner-icon-box" style={{ backgroundColor: partner.accentColor }}>
        {partner.iconMode === 'custom' && partner.customIconMedia?.secureUrl
          ? <img src={optimizedIconUrl(partner.customIconMedia.secureUrl)} alt="" className="partner-custom-icon" aria-hidden="true" />
          : <i className={`fa-solid ${partner.iconKey}`} aria-hidden="true"></i>}
      </div>
      <div className="partner-info-box">
        <span className="partner-name-text">{partner.name}</span>
        <span className="partner-desc-text">{partner.category}</span>
      </div>
    </div>
  );
}

export default function PartnersCarousel({ partnersCarousel, previewMode = false }) {
  if (!partnersCarousel || partnersCarousel.isVisible === false) return null;
  const partners = (partnersCarousel.partners || []).filter((partner) => partner.isVisible !== false);
  if (!partners.length) return null;

  return (
    <section className="partners-section">
      <div className="container">
        <h3 className="partners-title">{partnersCarousel.heading}</h3>
        <div className="partners-carousel">
          <div
            className="partners-track"
            style={{
              width: `calc(280px * ${partners.length * 2})`,
              '--partners-distance': `-${partners.length * 280}px`,
              ...(previewMode ? { animationPlayState: 'paused' } : {}),
            }}
          >
            {partners.map((partner) => <PartnerCard key={partner.itemKey} partner={partner} />)}
            {partners.map((partner) => <PartnerCard key={`duplicate-${partner.itemKey}`} partner={partner} duplicate />)}
          </div>
        </div>
      </div>
    </section>
  );
}
