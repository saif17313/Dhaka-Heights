import BuyerEnquiryForm from '@/components/BuyerEnquiryForm';
import { getPublishedProjectsPage } from '@/lib/projectsPageRepository';

export async function generateMetadata() {
  return {
    title: 'Buyer Enquiry | Dhaka Heights Properties Limited',
    description: 'Share what you are looking for and our sales team will get in touch with matching properties.',
    alternates: { canonical: '/contact/buyer' },
  };
}

export default async function BuyerContactPage() {
  const page = await getPublishedProjectsPage();
  const projects = page.content.projects
    .filter((project) => project.isVisible !== false)
    .map((project) => ({ slug: project.slug, name: project.name }));
  return <BuyerEnquiryForm projects={projects} />;
}
