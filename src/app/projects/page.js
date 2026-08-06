import ProjectsPageClient from '@/components/ProjectsPageClient';
import { getPublishedProjectsPage } from '@/lib/projectsPageRepository';

export async function generateMetadata() {
  const page = await getPublishedProjectsPage();
  const seo = page.content.seo;
  const image = page.content.header.media?.secureUrl;
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonicalUrl },
    openGraph: { title: seo.title, description: seo.description, images: image ? [image] : [], type: 'website', url: seo.canonicalUrl },
    twitter: { card: 'summary_large_image', title: seo.title, description: seo.description, images: image ? [image] : [] },
  };
}

export default async function ProjectsPage() {
  return <ProjectsPageClient projectsPage={await getPublishedProjectsPage()} />;
}
