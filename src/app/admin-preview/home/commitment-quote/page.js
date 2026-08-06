import CommitmentQuote from '@/components/CommitmentQuote';
import { getAdminHomeCommitmentQuote } from '@/lib/homeCommitmentQuoteRepository';

export const dynamic = 'force-dynamic';

export default async function SavedHomeCommitmentQuotePreviewPage() {
  let commitmentQuote = null;
  let errorMessage = '';
  try {
    commitmentQuote = await getAdminHomeCommitmentQuote();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'Unable to load the saved Commitment Quote.';
  }

  if (!commitmentQuote) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07132B] p-6">
        <div className="max-w-lg rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-xl">
          <h1 className="font-serif text-xl font-bold text-[#0B1B3D]">Saved Commitment Quote preview unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{errorMessage || 'Save a valid Commitment Quote draft before opening this preview.'}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07132B]">
      <div className="fixed left-4 top-4 z-[100] rounded-full border border-amber-300/50 bg-[#07132B]/90 px-4 py-2 text-xs font-bold text-amber-200 shadow-xl backdrop-blur">Saved {commitmentQuote.status} preview · version {commitmentQuote.versionNumber}</div>
      <CommitmentQuote commitmentQuote={commitmentQuote} previewMode />
    </main>
  );
}
