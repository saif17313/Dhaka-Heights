import SiteShellEditor from '@/components/admin/SiteShellEditor';
import { getAdminSiteShell } from '@/lib/siteShellRepository';

export default async function AdminSettingsPage() {
  const shell = await getAdminSiteShell();
  return <SiteShellEditor initialShell={shell} />;
}
