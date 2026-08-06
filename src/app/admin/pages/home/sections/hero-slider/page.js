import HomeHeroEditor from '@/components/admin/HomeHeroEditor';
import { getAdminHomeHero } from '@/lib/homeHeroRepository';

export const dynamic = 'force-dynamic';

function unwrapResult(result) {
  if (!result) return null;
  if (result.ok === false) return null;
  return result.data || result.hero || result;
}

export default async function HomeHeroEditorPage() {
  let initialHero = null;
  let initialError = '';

  try {
    const result = await getAdminHomeHero();
    initialHero = unwrapResult(result);
    if (!initialHero) {
      initialError = result?.error || 'No Home Hero draft or published version could be loaded.';
    }
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Unable to load the Home Hero editor.';
  }

  return (
    <HomeHeroEditor
      key={initialHero?.updatedAt || initialHero?.id || 'unconfigured'}
      initialHero={initialHero}
      initialError={initialError}
    />
  );
}
