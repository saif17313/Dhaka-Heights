import HomePageClient from '@/components/HomePageClient';
import { getPublishedHomeAbout } from '@/lib/homeAboutRepository';
import { getPublishedHomeHero } from '@/lib/homeHeroRepository';
import { getPublishedHomeFeaturedProjects } from '@/lib/homeFeaturedProjectsRepository';
import { getPublishedHomeStatistics } from '@/lib/homeStatisticsRepository';
import { getPublishedHomeCommitmentQuote } from '@/lib/homeCommitmentQuoteRepository';
import { getPublishedHomeMediaHighlights } from '@/lib/homeMediaHighlightsRepository';
import { getPublishedHomePartnersCarousel } from '@/lib/homePartnersCarouselRepository';
import { getPublishedHomeContactSection } from '@/lib/homeContactSectionRepository';
import { getPublishedContactPage } from '@/lib/contactPageRepository';
import { connection } from 'next/server';

async function getPublishedContactMap() {
  try {
    const contactPage = await getPublishedContactPage();
    return contactPage?.content?.map || null;
  } catch (error) {
    console.error('Home map configuration could not be loaded:', error);
    return null;
  }
}

export const metadata = {
  title: 'Dhaka Heights Properties Limited | Real Estate in Dhaka',
  description: 'Dhaka Heights Properties Limited develops premium residential and commercial properties in Dhaka, with a focus on quality, thoughtful design and modern living.',
  alternates: { canonical: 'https://www.dhakaheights.com/' },
  openGraph: {
    title: 'Dhaka Heights Properties Limited | Real Estate in Dhaka',
    description: 'Dhaka Heights Properties Limited develops premium residential and commercial properties in Dhaka, with a focus on quality, thoughtful design and modern living.',
    url: 'https://www.dhakaheights.com/',
    type: 'website',
  },
};

export default async function Home() {
  await connection();
  const [hero, about, statistics, featuredProjects, commitmentQuote, mediaHighlights, partnersCarousel, contactSection, contactMap] = await Promise.all([
    getPublishedHomeHero(),
    getPublishedHomeAbout(),
    getPublishedHomeStatistics(),
    getPublishedHomeFeaturedProjects(),
    getPublishedHomeCommitmentQuote(),
    getPublishedHomeMediaHighlights(),
    getPublishedHomePartnersCarousel(),
    getPublishedHomeContactSection(),
    getPublishedContactMap(),
  ]);

  if (!hero) {
    throw new Error('The published Home Hero Slider is not configured.');
  }

  if (!about) {
    throw new Error('The published Home About Corporate Block is not configured.');
  }

  if (!statistics) {
    throw new Error('The published Home Statistics Counter is not configured.');
  }

  if (!featuredProjects) {
    throw new Error('The published Home Featured Projects section is not configured.');
  }

  if (!commitmentQuote) {
    throw new Error('The published Home Commitment Quote is not configured.');
  }

  if (!mediaHighlights) {
    throw new Error('The published Home Media Highlights section is not configured.');
  }

  if (!partnersCarousel) {
    throw new Error('The published Home Partners Carousel is not configured.');
  }

  if (!contactSection) {
    throw new Error('The published Home Contact Section is not configured.');
  }

  return <HomePageClient hero={hero} about={about} statistics={statistics} featuredProjects={featuredProjects} commitmentQuote={commitmentQuote} mediaHighlights={mediaHighlights} partnersCarousel={partnersCarousel} contactSection={contactSection} contactMap={contactMap} />;
}
