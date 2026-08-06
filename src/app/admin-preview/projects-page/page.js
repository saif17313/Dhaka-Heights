import ProjectsPageSavedPreview from '@/components/admin/ProjectsPageSavedPreview';
import { getAdminProjectsPage } from '@/lib/projectsPageRepository';

export default async function ProjectsPagePreview() {
  return <ProjectsPageSavedPreview projectsPage={await getAdminProjectsPage()} />;
}
