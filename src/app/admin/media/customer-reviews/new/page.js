import { randomUUID } from 'node:crypto';
import CustomerReviewEditor from '@/components/admin/CustomerReviewEditor';
import { getPublishedMediaPage } from '@/lib/mediaPageRepository';

export default async function NewCustomerReviewPage() {
  const id = randomUUID();
  const mediaPage = await getPublishedMediaPage();
  const initialReview = {
    id,
    slug: `customer-review-${id.split('-')[0]}`,
    customerName: '',
    customerDesignation: '',
    customerLocation: '',
    customerType: '',
    reviewCategory: '',
    relatedProject: '',
    profileImageId: null,
    profileImage: null,
    profileImageAlt: '',
    reviewText: '',
    rating: null,
    reviewDate: new Date().toISOString().slice(0, 10),
    selectedPreviewMediaId: null,
    selectedPreview: null,
    status: 'draft',
    isFeatured: false,
    sortOrder: 10,
    createdAt: null,
    updatedAt: null,
    media: [],
  };
  return <CustomerReviewEditor initialReview={initialReview} mediaPage={mediaPage} isNew />;
}
