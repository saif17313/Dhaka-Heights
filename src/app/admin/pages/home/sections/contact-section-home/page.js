import HomeContactSectionEditor from '@/components/admin/HomeContactSectionEditor';
import { getAdminHomeContactSection } from '@/lib/homeContactSectionRepository';

export const dynamic = 'force-dynamic';

export default async function HomeContactSectionEditorPage() {
  let initialContactSection = null;
  let initialError = '';
  try { initialContactSection = await getAdminHomeContactSection(); }
  catch (error) { initialError = error instanceof Error ? error.message : 'Unable to load the Home Contact Section editor.'; }
  return <HomeContactSectionEditor key={initialContactSection?.updatedAt || initialContactSection?.id || 'unconfigured'} initialContactSection={initialContactSection} initialError={initialError} />;
}
