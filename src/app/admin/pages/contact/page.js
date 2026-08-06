import ContactPageEditor from '@/components/admin/ContactPageEditor';
import { getAdminContactPage } from '@/lib/contactPageRepository';
export default async function AdminContactPage() { return <ContactPageEditor initialContactPage={await getAdminContactPage()} />; }
