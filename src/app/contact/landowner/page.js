import LandownerEnquiryForm from '@/components/LandownerEnquiryForm';
import { getPublishedContactPage } from '@/lib/contactPageRepository';

export async function generateMetadata() {
  return {
    title: 'Landowner Submission | Dhaka Heights Properties Limited',
    description: 'Share your land details for a development or joint-venture partnership with Dhaka Heights.',
    alternates: { canonical: '/contact/landowner' },
  };
}

export default async function LandownerContactPage() {
  const contactPage = await getPublishedContactPage();
  return <LandownerEnquiryForm infoCards={contactPage.content.infoCards} map={contactPage.content.map} />;
}
