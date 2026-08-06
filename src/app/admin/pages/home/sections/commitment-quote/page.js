import HomeCommitmentQuoteEditor from '@/components/admin/HomeCommitmentQuoteEditor';
import { getAdminHomeCommitmentQuote } from '@/lib/homeCommitmentQuoteRepository';

export const dynamic = 'force-dynamic';

export default async function HomeCommitmentQuoteEditorPage() {
  let initialQuote = null;
  let initialError = '';
  try {
    initialQuote = await getAdminHomeCommitmentQuote();
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Unable to load the Home Commitment Quote editor.';
  }

  return <HomeCommitmentQuoteEditor key={initialQuote?.updatedAt || initialQuote?.id || 'unconfigured'} initialQuote={initialQuote} initialError={initialError} />;
}
