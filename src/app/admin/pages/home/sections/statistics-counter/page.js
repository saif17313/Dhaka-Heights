import HomeStatisticsEditor from '@/components/admin/HomeStatisticsEditor';
import { getAdminHomeStatistics } from '@/lib/homeStatisticsRepository';

export const dynamic = 'force-dynamic';

export default async function HomeStatisticsEditorPage() {
  let initialStatistics = null;
  let initialError = '';
  try {
    initialStatistics = await getAdminHomeStatistics();
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Unable to load the Home Statistics editor.';
  }

  return <HomeStatisticsEditor key={initialStatistics?.updatedAt || initialStatistics?.id || 'unconfigured'} initialStatistics={initialStatistics} initialError={initialError} />;
}
