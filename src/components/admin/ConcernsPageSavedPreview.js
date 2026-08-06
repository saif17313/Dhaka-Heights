'use client';

import ConcernDetailClient from '@/components/ConcernDetailClient';

export default function ConcernsPageSavedPreview({ concernsPage, concern }) {
  return <ConcernDetailClient concernsPage={concernsPage} concern={concern} />;
}
