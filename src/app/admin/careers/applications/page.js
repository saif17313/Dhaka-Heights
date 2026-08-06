import CareerApplicationsClient from '@/components/admin/CareerApplicationsClient';
import { getAdminCareerApplications } from '@/lib/careerPageRepository';
export default async function AdminCareerApplicationsPage() { return <CareerApplicationsClient initialApplications={await getAdminCareerApplications()} />; }
