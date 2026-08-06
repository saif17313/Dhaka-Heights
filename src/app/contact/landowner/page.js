import LandownerEnquiryForm from '@/components/LandownerEnquiryForm';

export async function generateMetadata() {
  return {
    title: 'Landowner Submission | Dhaka Heights Properties Limited',
    description: 'Share your land details for a development or joint-venture partnership with Dhaka Heights.',
    alternates: { canonical: '/contact/landowner' },
  };
}

export default function LandownerContactPage() {
  return <LandownerEnquiryForm />;
}
