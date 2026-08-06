import MediaPageEditor from '@/components/admin/MediaPageEditor';
import { getAdminMediaPage } from '@/lib/mediaPageRepository';
export default async function AdminArticlesPage(){return <MediaPageEditor initialMediaPage={await getAdminMediaPage()}/>;}
