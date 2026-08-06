import HomeMediaHighlightsEditor from '@/components/admin/HomeMediaHighlightsEditor';
import { getAdminHomeMediaHighlights, getAdminMediaPostCatalog } from '@/lib/homeMediaHighlightsRepository';

export const dynamic = 'force-dynamic';

export default async function HomeMediaHighlightsEditorPage() {
  let initialMediaHighlights = null;
  let mediaPostCatalog = [];
  let initialError = '';
  try {
    [initialMediaHighlights, mediaPostCatalog] = await Promise.all([getAdminHomeMediaHighlights(), getAdminMediaPostCatalog()]);
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Unable to load the Home Media Highlights editor.';
  }
  return <HomeMediaHighlightsEditor key={initialMediaHighlights?.updatedAt || initialMediaHighlights?.id || 'unconfigured'} initialMediaHighlights={initialMediaHighlights} mediaPostCatalog={mediaPostCatalog} initialError={initialError} />;
}
