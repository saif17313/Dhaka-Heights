import CareerPageClient from '@/components/CareerPageClient';
import { getPublishedCareerPage } from '@/lib/careerPageRepository';

export async function generateMetadata() {
  const page = await getPublishedCareerPage();
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

export default async function CareerPage() {
  return <CareerPageClient careerPage={await getPublishedCareerPage()} />;
}
