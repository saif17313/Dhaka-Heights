import CustomerReviewsAdminList from '@/components/admin/CustomerReviewsAdminList';
import { getAdminCustomerReviews } from '@/lib/customerReviewsRepository';

export default async function AdminCustomerReviewsPage({ searchParams }) {
  const params = await searchParams;
  const filters = {
    search: params?.search || '',
    status: params?.status || '',
    customerType: params?.customerType || '',
    sort: params?.sort || 'serial',
    page: Math.max(1, Number(params?.page) || 1),
    limit: 12,
  };
  const result = await getAdminCustomerReviews(filters);
  return <CustomerReviewsAdminList result={result} initialFilters={filters} />;
}
