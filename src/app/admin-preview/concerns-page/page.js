import ConcernsPageSavedPreview from '@/components/admin/ConcernsPageSavedPreview';
import { getAdminConcernsPage } from '@/lib/concernsPageRepository';

export default async function ConcernsPagePreview({ searchParams }) {
  const { slug } = await searchParams;
  const page = await getAdminConcernsPage();
  const concern = page.content.concerns.find((item) => item.slug === slug) || page.content.concerns[0];
  return <ConcernsPageSavedPreview concernsPage={page} concern={concern} />;
}
