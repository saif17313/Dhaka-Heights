import ConcernsPageEditor from '@/components/admin/ConcernsPageEditor';
import { getAdminConcernsPage } from '@/lib/concernsPageRepository';

export default async function AdminConcernPage({ params }) {
  const { concernSlug } = await params;
  return <ConcernsPageEditor initialConcernsPage={await getAdminConcernsPage()} initialSlug={concernSlug} />;
}
