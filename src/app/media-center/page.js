import { Suspense } from 'react';
import MediaCenterClient from '@/components/MediaCenterClient';
import { getPublishedMediaPage } from '@/lib/mediaPageRepository';
import { getPublishedCustomerReviews } from '@/lib/customerReviewsRepository';

export async function generateMetadata() {
  const page = await getPublishedMediaPage();
  const seo = page.content.seo;
  const image = page.content.header.media?.secureUrl;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonicalUrl },
    openGraph: {
      title: seo.title,
      description: seo.description,
      images: image ? [image] : [],
      type: 'website',
      url: seo.canonicalUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: image ? [image] : [],
    },
  };
}

export default async function MediaCenter({ searchParams }) {
  const params = await searchParams;
  const page = await getPublishedMediaPage();
  const reviewPage = Math.max(1, Number(params?.reviewPage) || 1);
  let reviewsResult = { reviews: [], page: reviewPage, pageSize: 9, total: 0, totalPages: 1 };
  let reviewsError = '';

  if (params?.cat === 'reviews') {
    try {
      reviewsResult = await getPublishedCustomerReviews({ page: reviewPage, limit: 9 });
    } catch (error) {
      console.error('Customer Reviews listing unavailable:', error);
      reviewsError = 'Customer reviews are temporarily unavailable. The other Media Center sections remain available.';
    }
  }

  return (
    <Suspense fallback={<div className="preloader"><div className="preloader-content"><h2 className="preloader-title">{page.content.labels.loadingLabel}</h2></div></div>}>
      <MediaCenterClient mediaPage={page} reviewsResult={reviewsResult} reviewsError={reviewsError} />
    </Suspense>
  );
}
