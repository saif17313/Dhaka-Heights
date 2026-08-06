import CareerPageSavedPreview from '@/components/admin/CareerPageSavedPreview';
import { getAdminCareerPage } from '@/lib/careerPageRepository';
export default async function CareerPagePreview() { return <CareerPageSavedPreview careerPage={await getAdminCareerPage()} />; }
