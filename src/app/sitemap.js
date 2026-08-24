import { getPublishedSiteShell } from '@/lib/siteShellRepository';
import { getPublicProjects } from '@/lib/publicData';
import { getCustomerReviewSitemapEntries } from '@/lib/customerReviewsRepository';

export default async function sitemap() {
  const baseUrl = 'https://www.dhakaheights.com';
  
  // Static Routes
  const staticRoutes = [
    '',
    '/about',
    '/about/our-team',
    '/projects',
    '/media-center',
    '/career',
    '/contact',
    '/contact/buyer',
    '/contact/landowner'
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1 : 0.8,
  }));

  try {
    const shell = await getPublishedSiteShell();
    const projects = await getPublicProjects();
    const reviews = await getCustomerReviewSitemapEntries();

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

    const reviewRoutes = (reviews || [])
      .map((review) => ({
        url: `${baseUrl}/media-center/customer-reviews/${review.slug}`,
        lastModified: review.updatedAt || review.createdAt || new Date().toISOString(),
        changeFrequency: 'monthly',
        priority: 0.7,
      }));

    return [...staticRoutes, ...concernRoutes, ...projectRoutes, ...reviewRoutes];
  } catch (error) {
    console.error('Failed to load dynamic sitemap routes:', error);
    return staticRoutes;
  }
}
