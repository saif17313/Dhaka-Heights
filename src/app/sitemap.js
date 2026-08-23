import { getPublishedSiteShell } from '@/lib/siteShellRepository';
import { getPublicProjects } from '@/lib/publicData';

export default async function sitemap() {
  const baseUrl = 'https://www.dhakaheights.com';
  
  // Static Routes
  const staticRoutes = [
    '',
    '/about',
    '/about/our-team',
    '/projects',
    '/media',
    '/career'
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));

  try {
    const shell = await getPublishedSiteShell();
    const projects = await getPublicProjects();

    const concernRoutes = (shell.navigation || [])
      .flatMap((nav) => nav.children || [])
      .filter((child) => child.itemKey?.startsWith('nav-concern-'))
      .map((concern) => ({
        url: `${baseUrl}${concern.url}`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'monthly',
        priority: 0.7,
      }));

    const projectRoutes = (projects || [])
      .map((project) => ({
        url: `${baseUrl}/project/${project.slug}`,
        lastModified: new Date().toISOString(),
        changeFrequency: 'weekly',
        priority: 0.9,
      }));

    return [...staticRoutes, ...concernRoutes, ...projectRoutes];
  } catch (error) {
    console.error('Failed to load dynamic sitemap routes:', error);
    return staticRoutes;
  }
}
