import HomePartnersCarouselEditor from '@/components/admin/HomePartnersCarouselEditor';
import { getAdminHomePartnersCarousel } from '@/lib/homePartnersCarouselRepository';

export const dynamic = 'force-dynamic';

export default async function HomePartnersCarouselEditorPage() {
  let initialPartnersCarousel = null;
  let initialError = '';
  try {
    initialPartnersCarousel = await getAdminHomePartnersCarousel();
  } catch (error) {
    initialError = error instanceof Error ? error.message : 'Unable to load the Home Partners Carousel editor.';
  }
  return <HomePartnersCarouselEditor key={initialPartnersCarousel?.updatedAt || initialPartnersCarousel?.id || 'unconfigured'} initialPartnersCarousel={initialPartnersCarousel} initialError={initialError} />;
}
