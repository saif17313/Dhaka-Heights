import MediaPageEditor from '@/components/admin/MediaPageEditor';
import { getAdminMediaPage } from '@/lib/mediaPageRepository';
export default async function AdminMediaDetail({params}){const{contentSlug}=await params;return <MediaPageEditor initialMediaPage={await getAdminMediaPage()} initialSlug={contentSlug}/>;}
