import OurTeamPageSavedPreview from '@/components/admin/OurTeamPageSavedPreview';
import { getAdminAboutPage } from '@/lib/aboutPageRepository';
export default async function OurTeamPagePreview(){return <OurTeamPageSavedPreview about={await getAdminAboutPage()}/>;}
