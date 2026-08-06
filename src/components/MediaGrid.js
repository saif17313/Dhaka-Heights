'use client';

import React from 'react';
import Link from 'next/link';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateLabel(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

export default function MediaGrid({ mediaHighlights, previewMode = false }) {
  if (!mediaHighlights || !mediaHighlights.isVisible) return null;
  const articles = (mediaHighlights.articles || []).filter((article) => article.isVisible);

  return (
    <section id="media" className={`media-section scroll-reveal${previewMode ? ' revealed' : ''}`}>
      <div className="container-full">
        <div className="section-header-flex">
          <div>
            <span className="section-tag">{mediaHighlights.tagText}</span>
            <h2 className="section-title">{mediaHighlights.heading}</h2>
          </div>
          <Link href={mediaHighlights.viewAllUrl} className="btn btn-secondary-outline" id="btn-view-all-news">
            <span>{mediaHighlights.viewAllLabel}</span>
          </Link>
        </div>

        <div className="media-grid">
          {articles.map((article) => (
            <article key={article.placementId || article.mediaPostId} className={`media-card scroll-reveal zoom-in${previewMode ? ' revealed' : ''}`}>
              <div className="media-img-wrapper">
                <img src={article.coverMedia?.secureUrl} alt={article.title} className="media-img" />
              </div>
              <div className="media-info">
                <div className="media-meta-row">
                  <span className="media-date-text">{dateLabel(article.publishedDate)}</span>
                  <span className="media-meta-divider">|</span>
                  <span className="media-category-text">{article.category}</span>
                </div>
                <h3 className="media-title">{article.title}</h3>
                <p className="media-summary">{article.summary}</p>
                <Link href={article.ctaUrl} className="read-more-link">
                  {article.ctaLabel} <i className="fa-solid fa-arrow-right-long"></i>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
