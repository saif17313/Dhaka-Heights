import ProjectsPageEditor from '@/components/admin/ProjectsPageEditor';
import { getAdminProjectsPage } from '@/lib/projectsPageRepository';

export default async function AdminProjectCataloguePage() {
  return <ProjectsPageEditor initialProjectsPage={await getAdminProjectsPage()} />;
}
