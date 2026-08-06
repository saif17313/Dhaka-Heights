import HomeAboutEditor from '@/components/admin/HomeAboutEditor';
import { getAdminHomeAbout } from '@/lib/homeAboutRepository';

export const dynamic = 'force-dynamic';

export default async function HomeAboutEditorPage() {
  let initialAbout = null;
  let initialError = '';
  try {
    initialAbout = await getAdminHomeAbout();
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Unable to load the Home About editor.';
  }

  return <HomeAboutEditor key={initialAbout?.updatedAt || initialAbout?.id || 'unconfigured'} initialAbout={initialAbout} initialError={initialError} />;
}
