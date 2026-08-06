'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';
import CustomerReviewCard from './CustomerReviewCard';

function tabFromSearchParams(searchParams) {
  const category = searchParams.get('cat');
  if (category === 'blogs') return 'blogs';
  if (category === 'videos') return 'videos';
  if (category === 'reviews') return 'reviews';
  return 'news';
}

function ArticleCard({ article, readLabel }) {
  return (
    <div className="blog-premium-card">
      <div className="blog-card-img-wrapper">
        <img src={article.coverMedia?.secureUrl} alt={article.coverAlt} className="blog-card-img" />
      </div>
      <div className="blog-card-content">
        <div>
          <span className="blog-card-date">{article.displayDate}</span>
          <h3 className="blog-card-title">{article.title}</h3>
          <p className="blog-card-excerpt">{article.content.substring(0, 180)}...</p>
        </div>
        <div className="blog-card-actions">
          <Link href={`/media-center/${article.slug}`} className="btn-blog-read">
            {readLabel} <i className="fa-solid fa-arrow-right ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, onSelect, formatLabel }) {
  return (
    <div className="video-premium-card">
      <button
        type="button"
        className="video-card-thumbnail-wrapper"
        onClick={() => onSelect(video)}
        aria-label={`Play ${video.title}`}
      >
        <img src={video.thumbnailMedia?.secureUrl} alt={video.thumbnailAlt} className="video-card-thumbnail" />
        <span className="video-card-overlay" />
        <span className="video-card-play-btn-wrapper"><span className="video-card-play-btn-inner"><i className="fa-solid fa-play" /></span></span>
        <span className="video-card-duration">{video.duration}</span>
      </button>
      <div className="video-card-info">
        <h4 className="video-card-title">{video.title}</h4>
        <p className="video-card-subtitle">{formatLabel}</p>
      </div>
    </div>
  );
}

function EmptyReviews({ message }) {
  return (
    <div className="customer-reviews-empty">
      <span aria-hidden="true"><i className="fa-regular fa-comments" /></span>
      <h2>Customer stories are being prepared</h2>
      <p>{message || 'Published customer experiences will appear here.'}</p>
    </div>
  );
}

export default function MediaCenterClient({
  mediaPage,
  reviewsResult = null,
  reviewsError = '',
  previewMode = false,
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const content = mediaPage.content;
  const labels = content.labels;
  const routeTab = tabFromSearchParams(searchParams);
  const [previewTab, setPreviewTab] = useState(routeTab);
  const [activeVideo, setActiveVideo] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const activeTab = previewMode ? previewTab : routeTab;

  const selectTab = (key) => {
    setCurrentPage(1);
    if (previewMode) {
      setPreviewTab(key);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('cat', key);
    params.delete('reviewPage');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const news = content.articles.filter((item) => item.category === 'Latest News' && item.isVisible !== false);
  const blogs = content.articles.filter((item) => item.category === 'Blogs & Articles' && item.isVisible !== false);
  const videos = content.videos.filter((item) => item.isVisible !== false);
  const list = activeTab === 'news' ? news : activeTab === 'blogs' ? blogs : videos;
  const perPage = Number(content.itemsPerPage || 3);
  const pages = Math.ceil(list.length / perPage);
  const shown = list.slice((currentPage - 1) * perPage, currentPage * perPage);

  const scrollToContent = () => {
    const element = document.querySelector('.media-content-section');
    if (element) window.scrollTo({ top: element.getBoundingClientRect().top + window.pageYOffset - 100, behavior: 'smooth' });
  };

  const pageTo = (value) => {
    if (activeTab === 'reviews' && !previewMode) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('cat', 'reviews');
      params.set('reviewPage', String(value));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      window.setTimeout(scrollToContent, 60);
      return;
    }
    setCurrentPage(value);
    if (!previewMode) scrollToContent();
  };

  const reviewPages = reviewsResult?.totalPages || 1;
  const reviewPage = reviewsResult?.page || 1;
  const reviewItems = reviewsResult?.reviews || [];
  const tabItems = [
    ['news', labels.newsTab || 'News & Press'],
    ['blogs', labels.blogsTab || 'Blogs & Articles'],
    ['videos', labels.videosTab || 'Virtual Tours'],
    ['reviews', labels.customerReviewsTab || 'Customer Reviews'],
  ];

  const body = (
    <main style={{ marginTop: previewMode ? 0 : '80px' }}>
      <PageHeader
        title={content.header.title}
        subtitle={content.header.subtitle}
        breadcrumbs={[{ label: content.header.breadcrumbLabel }]}
        bgImage={content.header.media?.secureUrl}
      />
      <section className="media-tab-section">
        <div className="container-full media-tab-flex">
          <div className="media-tabs-wrapper" role="tablist" aria-label="Media Center categories">
            {tabItems.map(([key, label]) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === key}
                aria-controls={`media-panel-${key}`}
                key={key}
                className={`media-tab-btn ${activeTab === key ? 'active' : ''}`}
                onClick={() => selectTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="media-content-section" id={`media-panel-${activeTab}`} role="tabpanel">
        <div className="container-full">
          {activeTab === 'reviews' ? (
            reviewItems.length ? (
              <div className="customer-reviews-grid">
                {reviewItems.map((review) => <CustomerReviewCard key={review.id} review={review} />)}
              </div>
            ) : (
              <EmptyReviews message={reviewsError} />
            )
          ) : activeTab !== 'videos' ? (
            <div className="blogs-premium-grid">
              {shown.map((article) => (
                <ArticleCard
                  key={article.postId}
                  article={article}
                  readLabel={activeTab === 'news' ? labels.newsReadLabel : labels.blogReadLabel}
                />
              ))}
            </div>
          ) : (
            <div className="videos-premium-grid">
              {shown.map((video) => (
                <VideoCard
                  key={video.videoId}
                  video={video}
                  onSelect={setActiveVideo}
                  formatLabel={labels.videoFormatLabel}
                />
              ))}
            </div>
          )}

          {activeTab === 'reviews' && reviewPages > 1 && (
            <div className="pagination-container" style={{ marginTop: '50px' }}>
              <button type="button" onClick={() => pageTo(Math.max(reviewPage - 1, 1))} disabled={reviewPage === 1} className="pagination-btn pagination-prev">
                <i className="fa-solid fa-chevron-left" /> {labels.previousLabel}
              </button>
              <div className="pagination-pages">
                {Array.from({ length: reviewPages }, (_, index) => (
                  <button type="button" key={index + 1} onClick={() => pageTo(index + 1)} className={`pagination-number ${reviewPage === index + 1 ? 'active' : ''}`}>
                    {index + 1}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => pageTo(Math.min(reviewPage + 1, reviewPages))} disabled={reviewPage === reviewPages} className="pagination-btn pagination-next">
                {labels.nextLabel} <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}

          {activeTab !== 'reviews' && pages > 1 && (
            <div className="pagination-container" style={{ marginTop: '50px' }}>
              <button type="button" onClick={() => pageTo(Math.max(currentPage - 1, 1))} disabled={currentPage === 1} className="pagination-btn pagination-prev">
                <i className="fa-solid fa-chevron-left" /> {labels.previousLabel}
              </button>
              <div className="pagination-pages">
                {Array.from({ length: pages }, (_, index) => (
                  <button type="button" key={index + 1} onClick={() => pageTo(index + 1)} className={`pagination-number ${currentPage === index + 1 ? 'active' : ''}`}>
                    {index + 1}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => pageTo(Math.min(currentPage + 1, pages))} disabled={currentPage === pages} className="pagination-btn pagination-next">
                {labels.nextLabel} <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );

  const modal = activeVideo && (
    <div className="modal-overlay open" role="dialog" aria-modal="true" onClick={() => setActiveVideo(null)}>
      <div className="modal-wrapper details-modal-wrapper" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '800px', borderTop: '3px solid var(--accent-gold)' }}>
        <button type="button" className="modal-close-btn" onClick={() => setActiveVideo(null)} aria-label={labels.closeVideoLabel}>
          <i className="fa-solid fa-xmark" />
        </button>
        <div className="modal-content details-modal-content">
          <div className="modal-video-content" style={{ padding: '10px 0' }}>
            <h3 className="modal-project-title" style={{ fontSize: '1.5rem', fontFamily: 'var(--font-playfair)', color: 'var(--primary-navy)', marginBottom: '15px' }}>{activeVideo.title}</h3>
            <div className="simulated-video-player" style={{ position: 'relative', paddingTop: '56.25%', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden' }}>
              <iframe src={activeVideo.embedUrl} title={activeVideo.title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (previewMode) return <div>{body}{modal}</div>;
  return <div><Navbar />{body}{modal}<Footer /><ScrollToTop /></div>;
}
