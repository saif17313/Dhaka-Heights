import React from 'react';
import PublicIcon from './PublicIcon';

export default function CommitmentQuote({ commitmentQuote, previewMode = false }) {
  if (!commitmentQuote || !commitmentQuote.isVisible) return null;

  return (
    <section className="quote-section">
      <div className="container">
        <div className={`quote-box scroll-reveal${previewMode ? ' revealed' : ''}`}>
          <div className="quote-decor-line top-left"></div>
          <div className="quote-decor-line bottom-right"></div>

          <PublicIcon iconClass="fa-solid fa-quote-left quote-icon-main" />

          <blockquote className="quote-text">
            &quot;{commitmentQuote.quoteText}&quot;
          </blockquote>

          <cite className="quote-author">
            &mdash; {commitmentQuote.attribution}
          </cite>
        </div>
      </div>
    </section>
  );
}
