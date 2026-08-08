import OurTeamPageClient from '@/components/OurTeamPageClient';
import { getPublishedAboutPage } from '@/lib/aboutPageRepository';

export async function generateMetadata() {
  const about = await getPublishedAboutPage();
  const teamSection = about.content.teamSection || {};
  const hero = about.media.find((item) => item.role === 'hero')?.media?.secureUrl;
  const title = `Our Team | ${about.content.seo?.title || 'Dhaka Heights'}`;
  const description = teamSection.intro || about.content.seo?.description;
  return {
    title,
    description,
    alternates: { canonical: '/about/our-team' },
    openGraph: { title, description, images: hero ? [hero] : [], type: 'website', url: '/about/our-team' },
    twitter: { card: 'summary_large_image', title, description, images: hero ? [hero] : [] },
  };
}

export default async function OurTeamPage() {
  return <OurTeamPageClient about={await getPublishedAboutPage()} />;
}
