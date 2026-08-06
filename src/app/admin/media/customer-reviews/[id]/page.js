import { notFound } from 'next/navigation';
import CustomerReviewEditor from '@/components/admin/CustomerReviewEditor';
import { getAdminCustomerReview } from '@/lib/customerReviewsRepository';
import { getPublishedMediaPage } from '@/lib/mediaPageRepository';

export default async function EditCustomerReviewPage({ params, searchParams }) {
  const { id } = await params;
  const query = await searchParams;
  const [review, mediaPage] = await Promise.all([
    getAdminCustomerReview(id),
    getPublishedMediaPage(),
  ]);
  if (!review) notFound();
  return <CustomerReviewEditor initialReview={review} mediaPage={mediaPage} initialTab={query?.preview === '1' ? 'Preview' : 'Customer & Review'} />;
}
