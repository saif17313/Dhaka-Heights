import HeroSlider from '@/components/HeroSlider';
import { getAdminHomeHero } from '@/lib/homeHeroRepository';

export const dynamic = 'force-dynamic';

function unwrapResult(result) {
  if (!result || result.ok === false) return null;
  return result.data || result.hero || result;
}

export default async function SavedHomeHeroPreviewPage() {
  let hero = null;
  let errorMessage = '';

  try {
    hero = unwrapResult(await getAdminHomeHero());
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unable to load the saved draft.';
  }

  if (!hero) {
    return (
      <main className="min-h-screen bg-[#07132B] text-white flex items-center justify-center p-6">
        <div className="max-w-lg rounded-2xl border border-amber-500/30 bg-[#0D1E42] p-6 text-center shadow-2xl">
          <i className="fa-solid fa-triangle-exclamation mb-3 text-2xl text-amber-400"></i>
          <h1 className="font-serif text-xl font-bold">Saved Hero preview unavailable</h1>
          <p className="mt-2 text-sm text-slate-300">
            {errorMessage || 'Save a valid Hero draft before opening this preview.'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07132B]">
      <div className="fixed left-4 top-4 z-[100] rounded-full border border-amber-300/40 bg-[#07132B]/90 px-4 py-2 text-xs font-bold text-amber-200 shadow-xl backdrop-blur">
        Saved {hero.status || 'content'} preview · version {hero.versionNumber || '—'}
      </div>
      <HeroSlider hero={hero} />
    </main>
  );
}
