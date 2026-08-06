import SiteShellSavedPreview from '@/components/admin/SiteShellSavedPreview';
import { getAdminSiteShell } from '@/lib/siteShellRepository';

export default async function SiteShellPreviewPage() {
  return <SiteShellSavedPreview shell={await getAdminSiteShell()} />;
}
