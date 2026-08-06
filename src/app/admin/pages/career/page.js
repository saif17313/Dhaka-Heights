import CareerPageEditor from '@/components/admin/CareerPageEditor';
import { getAdminCareerPage } from '@/lib/careerPageRepository';
export default async function AdminCareerContentPage() { return <CareerPageEditor initialCareerPage={await getAdminCareerPage()} />; }
