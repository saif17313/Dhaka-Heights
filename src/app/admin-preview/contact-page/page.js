import ContactPageSavedPreview from '@/components/admin/ContactPageSavedPreview';
import { getAdminContactPage } from '@/lib/contactPageRepository';
export default async function ContactPagePreview() { return <ContactPageSavedPreview contactPage={await getAdminContactPage()} />; }
