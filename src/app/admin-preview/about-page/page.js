import AboutPageSavedPreview from '@/components/admin/AboutPageSavedPreview';
import { getAdminAboutPage } from '@/lib/aboutPageRepository';
export default async function AboutPagePreview(){return <AboutPageSavedPreview about={await getAdminAboutPage()}/>;}
