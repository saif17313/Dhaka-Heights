import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ConcernDetailClient from '@/components/ConcernDetailClient';
import { getPublishedConcern, getPublishedConcernsPage } from '@/lib/concernsPageRepository';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const result = await getPublishedConcern(slug);
  if (!result) return { title: 'Concern Not Found | Dhaka Heights Properties Limited' };
  const { concern } = result;
  return { title: `${concern.name} | Dhaka Heights Properties Limited`, description: concern.overview, alternates: { canonical: `/concern/${concern.slug}` }, openGraph: { title: concern.name, description: concern.overview, images: concern.coverMedia?.secureUrl ? [concern.coverMedia.secureUrl] : [], type: 'website', url: `/concern/${concern.slug}` }, twitter: { card: 'summary_large_image', title: concern.name, description: concern.overview, images: concern.coverMedia?.secureUrl ? [concern.coverMedia.secureUrl] : [] } };
}

export default async function ConcernDetailPage({ params }) {
  const { slug } = await params;
  const result = await getPublishedConcern(slug);
  if (result) return <ConcernDetailClient concern={result.concern} concernsPage={result.page} />;
  const page = await getPublishedConcernsPage();
  const labels = page.content.labels;
  return <div><Navbar /><main className="py-20 text-center" style={{ marginTop: '120px' }}><h2 className="text-navy font-serif text-3xl mb-4">{labels.notFoundTitle}</h2><p className="text-gray-500 mb-8">{labels.notFoundBody}</p><Link href="/about" className="btn btn-primary">{labels.returnLabel}</Link></main><Footer /></div>;
}
