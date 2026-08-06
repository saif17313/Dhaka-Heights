import AboutPageClient from '@/components/AboutPageClient';
import { getPublishedAboutPage } from '@/lib/aboutPageRepository';

export async function generateMetadata() {
  const about=await getPublishedAboutPage(); const seo=about.content.seo; const hero=about.media.find((item)=>item.role==='hero')?.media?.secureUrl;
  return { title:seo.title,description:seo.description,alternates:{canonical:seo.canonicalUrl},openGraph:{title:seo.ogTitle||seo.title,description:seo.ogDescription||seo.description,images:hero?[hero]:[],type:'website',url:seo.canonicalUrl},twitter:{card:'summary_large_image',title:seo.ogTitle||seo.title,description:seo.ogDescription||seo.description,images:hero?[hero]:[]} };
}
export default async function AboutPage() { return <AboutPageClient about={await getPublishedAboutPage()} />; }
