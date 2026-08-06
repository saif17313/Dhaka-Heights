'use client';

import React, { useState } from 'react';
import ProjectsGrid from '@/components/ProjectsGrid';

export default function FeaturedProjectsPreviewClient({ featuredProjects }) {
  const [filter, setFilter] = useState('all');
  return <ProjectsGrid featuredProjects={featuredProjects} activeFilter={filter} onFilterChange={setFilter} previewMode />;
}
