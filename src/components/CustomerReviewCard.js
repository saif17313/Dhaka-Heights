import Link from 'next/link';
import YouTubeThumbnail from '@/components/YouTubeThumbnail';

function Stars({ rating }) {
  if (!rating) return null;
  return (
    <div className="customer-review-stars" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} aria-hidden="true" className={index < rating ? 'filled' : ''}>★</span>
      ))}
    </div>
  );
}

function Preview({ review }) {
  const preview = review.selectedPreview;
  if (!preview) return null;

  if (preview.mediaType === 'image' && preview.imageAsset?.secureUrl) {
    return (
      <div className="customer-review-card-media">
        <img
          src={preview.imageAsset.secureUrl}
          alt={preview.altText || preview.imageAsset.altText || `${review.customerName} review`}
          loading="lazy"
        />
        <span className="customer-review-media-label"><i className="fa-regular fa-image" /> Photo Review</span>
      </div>
    );
  }

  if (preview.mediaType === 'youtube' && preview.youtubeVideoId) {
    return (
      <div className="customer-review-card-media customer-review-card-video">
        <YouTubeThumbnail videoId={preview.youtubeVideoId} alt={`${review.customerName} video review`} />
        <span className="customer-review-video-overlay" aria-hidden="true" />
        <span className="customer-review-play" aria-hidden="true"><i className="fa-solid fa-play" /></span>
        <span className="customer-review-media-label"><i className="fa-solid fa-circle-play" /> Video Review</span>
      </div>
    );
  }

  return null;
}

export default function CustomerReviewCard({ review, interactive = true }) {
  const href = `/media-center/customer-reviews/${review.slug}`;
  const hasPreview = Boolean(
    review.selectedPreview
    && (
      (review.selectedPreview.mediaType === 'image' && review.selectedPreview.imageAsset?.secureUrl)
      || (review.selectedPreview.mediaType === 'youtube' && review.selectedPreview.youtubeVideoId)
    )
  );
  const excerpt = review.reviewText.length > 170
    ? `${review.reviewText.slice(0, 170).trim()}…`
    : review.reviewText;

  const cardContent = (
    <>
        <div className="customer-review-card-copy">
          <header className="customer-review-person">
            {review.profileImage?.secureUrl ? (
              <img
                src={review.profileImage.secureUrl}
                alt={review.profileImageAlt || review.profileImage.altText || review.customerName}
                className="customer-review-avatar"
                loading="lazy"
              />
            ) : (
              <span className="customer-review-avatar customer-review-avatar-fallback" aria-hidden="true">
                {review.customerName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span>
              <strong>{review.customerName}</strong>
              {review.customerDesignation && <small>{review.customerDesignation}</small>}
              {review.relatedProject && <small>Dhaka Heights — {review.relatedProject}</small>}
            </span>
          </header>
          <Stars rating={review.rating} />
          <blockquote>“{excerpt}”</blockquote>
          <div className="customer-review-meta">
            {review.customerType && <span>{review.customerType}</span>}
            {review.reviewCategory && <span>{review.reviewCategory}</span>}
            {review.customerLocation && <span>{review.customerLocation}</span>}
            {review.reviewDate && <time dateTime={review.reviewDate}>{new Date(`${review.reviewDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time>}
          </div>
        </div>
        {hasPreview && <Preview review={review} />}
    </>
  );

  return (
    <article className={`customer-review-card ${hasPreview ? 'has-media' : 'text-only'}`}>
      {interactive ? (
        <Link href={href} className="customer-review-card-link" aria-label={`Read ${review.customerName}'s customer review`}>
          {cardContent}
        </Link>
      ) : (
        <div className="customer-review-card-link" role="group" aria-label={`${review.customerName} customer review preview`}>
          {cardContent}
        </div>
      )}
    </article>
  );
}
