import ConcernsPageEditor from '@/components/admin/ConcernsPageEditor';
import { getAdminConcernsPage } from '@/lib/concernsPageRepository';

export default async function AdminConcernsPage() {
  return <ConcernsPageEditor initialConcernsPage={await getAdminConcernsPage()} />;
}
