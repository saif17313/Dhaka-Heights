import { notFound } from 'next/navigation';
import InquiriesClient from '@/components/admin/InquiriesClient';
import { getAdminInquiries } from '@/lib/contactPageRepository';

const STATUSES = ['new', 'contacted', 'qualified', 'closed', 'spam'];
export default async function AdminFilteredInquiriesPage({ params }) {
  const { filterKey } = await params;
  if (!STATUSES.includes(filterKey)) notFound();
  return <InquiriesClient initialInquiries={await getAdminInquiries({ status: filterKey })} activeStatus={filterKey} />;
}
