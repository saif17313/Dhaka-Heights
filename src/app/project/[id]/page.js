import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProjectDetailClient from '@/components/ProjectDetailClient';
import { getPublishedProject, getPublishedProjectsPage } from '@/lib/projectsPageRepository';

export async function generateMetadata({ params }) {
  const { id } = await params;
  const result = await getPublishedProject(id);
  if (!result) return { title: 'Project Not Found | Dhaka Heights Properties Limited' };
  const { project } = result;
  return {
    title: `${project.name} | Dhaka Heights Properties Limited`,
    description: project.descriptionShort || project.description,
    alternates: { canonical: `/project/${project.slug}` },
    openGraph: { title: project.name, description: project.descriptionShort || project.description, images: project.coverMedia?.secureUrl ? [project.coverMedia.secureUrl] : [], type: 'website', url: `/project/${project.slug}` },
    twitter: { card: 'summary_large_image', title: project.name, description: project.descriptionShort || project.description, images: project.coverMedia?.secureUrl ? [project.coverMedia.secureUrl] : [] },
  };
}

export default async function ProjectDetailPage({ params }) {
  const { id } = await params;
  const result = await getPublishedProject(id);
  if (result) return <ProjectDetailClient project={result.project} projectsPage={result.page} />;
  const page = await getPublishedProjectsPage();
  const detail = page.content.detail;
  return <div><Navbar /><main className="py-20 text-center" style={{ marginTop: '120px' }}><h2 className="text-navy font-serif text-3xl mb-4">{detail.notFoundTitle}</h2><p className="text-gray-500 mb-8">{detail.notFoundBody}</p><Link href="/projects" className="btn btn-primary">{detail.returnLabel}</Link></main><Footer /></div>;
}
