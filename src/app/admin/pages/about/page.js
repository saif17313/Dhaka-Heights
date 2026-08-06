import AboutPageEditor from '@/components/admin/AboutPageEditor';
import { getAdminAboutPage } from '@/lib/aboutPageRepository';
export default async function AdminAboutPage(){return <AboutPageEditor initialAbout={await getAdminAboutPage()}/>;}
