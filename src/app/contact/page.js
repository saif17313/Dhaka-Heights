import ContactPageClient from '@/components/ContactPageClient';
import { getPublishedContactPage } from '@/lib/contactPageRepository';

export async function generateMetadata() {
  const page = await getPublishedContactPage();
  return { title: page.content.seo.title, description: page.content.seo.description, alternates: { canonical: page.content.seo.canonicalUrl } };
}

export default async function Contact() {
  return <ContactPageClient contactPage={await getPublishedContactPage()} />;
}
