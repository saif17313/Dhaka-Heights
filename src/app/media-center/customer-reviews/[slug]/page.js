import { notFound } from 'next/navigation';
import CustomerReviewDetail from '@/components/CustomerReviewDetail';
import { getPublishedMediaPage } from '@/lib/mediaPageRepository';
import { getPublishedCustomerReview } from '@/lib/customerReviewsRepository';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const review = await getPublishedCustomerReview(slug);
  if (!review) return { title: 'Customer Review Not Found | Dhaka Heights Properties Limited' };
  const description = review.reviewText.slice(0, 160);
  const image = review.selectedPreview?.imageAsset?.secureUrl || review.profileImage?.secureUrl;
  return {
    title: `${review.customerName} Customer Review | Dhaka Heights Properties Limited`,
    description,
    alternates: { canonical: `/media-center/customer-reviews/${review.slug}` },
    openGraph: {
      title: `${review.customerName} Customer Review`,
      description,
      images: image ? [image] : [],
      type: 'article',
      url: `/media-center/customer-reviews/${review.slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${review.customerName} Customer Review`,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function CustomerReviewPage({ params }) {
  const { slug } = await params;
  const [review, mediaPage] = await Promise.all([
    getPublishedCustomerReview(slug),
    getPublishedMediaPage(),
  ]);
  if (!review) notFound();
  return <CustomerReviewDetail review={review} mediaPage={mediaPage} />;
}
