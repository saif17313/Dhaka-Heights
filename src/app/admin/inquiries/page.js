import InquiriesClient from '@/components/admin/InquiriesClient';
import { getAdminInquiries } from '@/lib/contactPageRepository';
export default async function AdminInquiriesPage() { return <InquiriesClient initialInquiries={await getAdminInquiries()} />; }
