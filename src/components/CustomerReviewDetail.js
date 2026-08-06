import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ScrollToTop from '@/components/ScrollToTop';
import PageHeader from '@/components/PageHeader';
import { getYouTubeEmbedUrl } from '@/lib/youtube';

function Stars({ rating }) {
  if (!rating) return null;
  return (
    <div className="customer-review-detail-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < rating ? 'filled' : ''} aria-hidden="true">★</span>
      ))}
    </div>
  );
}

export default function CustomerReviewDetail({ review, mediaPage, previewMode = false }) {
  const photos = (review.media || []).filter((item) => item.mediaType === 'image' && item.imageAsset?.secureUrl);
  const videos = (review.media || []).filter((item) => item.mediaType === 'youtube' && item.youtubeVideoId);
  const subtitle = [review.customerDesignation, review.relatedProject, review.customerLocation].filter(Boolean).join(' · ');

  const body = (
    <main style={{ marginTop: previewMode ? 0 : '80px' }}>
      <PageHeader
        title={review.customerName}
        subtitle={subtitle || 'Customer Experience'}
        breadcrumbs={[
          { label: 'Media Center', href: '/media-center' },
          { label: 'Customer Reviews', href: '/media-center?cat=reviews' },
          { label: review.customerName },
        ]}
        bgImage={mediaPage?.content?.header?.media?.secureUrl}
      />

      <article className="customer-review-detail-section">
        <div className="container-full customer-review-detail-shell">
          <Link href="/media-center?cat=reviews" className="customer-review-back-link">
            <i className="fa-solid fa-arrow-left" /> Back to Customer Reviews
          </Link>

          <section className="customer-review-detail-intro">
            <div className="customer-review-detail-profile">
              {review.profileImage?.secureUrl ? (
                <img
                  src={review.profileImage.secureUrl}
                  alt={review.profileImageAlt || review.profileImage.altText || review.customerName}
                />
              ) : (
                <span aria-hidden="true">{review.customerName.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <div className="customer-review-detail-copy">
              <p className="customer-review-detail-eyebrow">Customer Experience</p>
              <h2>{review.customerName}</h2>
              {review.customerDesignation && <p className="customer-review-detail-designation">{review.customerDesignation}</p>}
              <div className="customer-review-detail-meta">
                {review.customerType && <span><i className="fa-solid fa-user-check" /> {review.customerType}</span>}
                {review.reviewCategory && <span><i className="fa-solid fa-tag" /> {review.reviewCategory}</span>}
                {review.relatedProject && <span><i className="fa-solid fa-building" /> {review.relatedProject}</span>}
                {review.customerLocation && <span><i className="fa-solid fa-location-dot" /> {review.customerLocation}</span>}
                {review.reviewDate && (
                  <time dateTime={review.reviewDate}>
                    <i className="fa-regular fa-calendar" />{' '}
                    {new Date(`${review.reviewDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </time>
                )}
              </div>
              <Stars rating={review.rating} />
              <div className="customer-review-detail-quote-mark" aria-hidden="true">“</div>
              <div className="customer-review-detail-text">
                {review.reviewText.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={`${index}-${paragraph.slice(0, 20)}`}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>

          {photos.length > 0 && (
            <section className="customer-review-gallery" aria-labelledby="customer-review-gallery-title">
              <header>
                <p>Photo Gallery</p>
                <h2 id="customer-review-gallery-title">Moments from the Experience</h2>
              </header>
              <div className="customer-review-gallery-grid">
                {photos.map((item) => (
                  <figure key={item.id}>
                    <img
                      src={item.imageAsset.secureUrl}
                      alt={item.altText || item.imageAsset.altText || `${review.customerName} customer review photo`}
                      loading="lazy"
                    />
                    {item.caption && <figcaption>{item.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}

          {videos.length > 0 && (
            <section className="customer-review-videos" aria-labelledby="customer-review-videos-title">
              <header>
                <p>Video Reviews</p>
                <h2 id="customer-review-videos-title">Hear the Story Directly</h2>
              </header>
              <div className="customer-review-video-grid">
                {videos.map((item) => {
                  const embedUrl = getYouTubeEmbedUrl(item.youtubeVideoId);
                  if (!embedUrl) return null;
                  return (
                    <figure key={item.id}>
                      <div className="customer-review-video-frame">
                        <iframe
                          src={embedUrl}
                          title={item.caption || `${review.customerName} customer video review`}
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                      </div>
                      {item.caption && <figcaption>{item.caption}</figcaption>}
                    </figure>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </article>
    </main>
  );

  if (previewMode) return body;
  return <div><Navbar />{body}<Footer /><ScrollToTop /></div>;
}
