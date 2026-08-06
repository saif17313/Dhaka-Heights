import HomeFeaturedProjectsEditor from '@/components/admin/HomeFeaturedProjectsEditor';
import { getAdminHomeFeaturedProjects, getAdminProjectCatalog } from '@/lib/homeFeaturedProjectsRepository';

export const dynamic = 'force-dynamic';

export default async function HomeFeaturedProjectsEditorPage() {
  let initialFeaturedProjects = null;
  let projectCatalog = [];
  let initialError = '';
  try {
    [initialFeaturedProjects, projectCatalog] = await Promise.all([
      getAdminHomeFeaturedProjects(),
      getAdminProjectCatalog(),
    ]);
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Unable to load the Home Featured Projects editor.';
  }

  return <HomeFeaturedProjectsEditor key={initialFeaturedProjects?.updatedAt || initialFeaturedProjects?.id || 'unconfigured'} initialFeaturedProjects={initialFeaturedProjects} projectCatalog={projectCatalog} initialError={initialError} />;
}
