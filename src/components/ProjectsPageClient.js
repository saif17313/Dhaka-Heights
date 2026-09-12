'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from './Navbar';
import Footer from './Footer';
import PageHeader from './PageHeader';
import ScrollToTop from './ScrollToTop';
import PublicIcon from './PublicIcon';
import { normalizeProjectFilterOptions, resolveProjectFilterValue } from '@/lib/projectFilterOptions';

const STANDARD_PROJECT_STATUSES = new Set(['ongoing', 'completed', 'upcoming']);

function dynamicBadgeStyle(status) {
  return STANDARD_PROJECT_STATUSES.has(status) ? undefined : { backgroundColor: 'var(--primary-navy)' };
}

function renderTemplate(template, values) {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template || '');
}

function ProjectCard({ project, index }) {
  const yOffset = index % 2 === 1 ? 40 : 0;
  return (
    <div style={{ transform: `translateY(${yOffset}px)`, display: 'block' }}>
      <Link href={`/project/${project.slug}`} className="project-card-premium">
        <div className="project-img-wrapper">
          <img src={project.coverMedia?.secureUrl} alt={project.coverAlt} className="project-img" />
          <div className={`project-badge badge-${project.lifecycle}`} style={dynamicBadgeStyle(project.lifecycle)}>{project.badgeText}</div>
          <div className="project-hover-overlay">
            <span className="explore-icon-wrapper"><PublicIcon iconClass="fa-solid fa-arrow-up-right-from-square" /></span>
          </div>
        </div>
        <div className="project-info">
          <span className="project-location"><PublicIcon iconClass="fa-solid fa-location-dot" /> {project.cardLocation}</span>
          <h3 className="project-name">{project.name}</h3>
          <div className="project-details-row">
            <span className="project-size"><PublicIcon iconClass="fa-solid fa-ruler-combined" /> {project.cardSize}</span>
            <span className="project-type"><PublicIcon iconClass="fa-solid fa-briefcase" /> {project.projectType}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}

function ProjectsContent({ projectsPage, previewMode = false, searchParams = {} }) {
  const router = useRouter();
  const listing = projectsPage.content.listing;
  const filterOptions = useMemo(() => normalizeProjectFilterOptions(listing), [listing]);
  const allProjects = useMemo(
    () => projectsPage.content.projects.filter((project) => project.isVisible !== false),
    [projectsPage],
  );
  const [previewFilters, setPreviewFilters] = useState({ status: 'all', category: 'all', location: 'all', size: 'all' });
  const [currentPage, setCurrentPage] = useState(1);
  const filterStatus = resolveProjectFilterValue(filterOptions.status, previewMode ? previewFilters.status : searchParams?.status);
  const filterCategory = resolveProjectFilterValue(filterOptions.category, previewMode ? previewFilters.category : searchParams?.category);
  const filterLocation = resolveProjectFilterValue(filterOptions.location, previewMode ? previewFilters.location : searchParams?.location);
  const filterSize = resolveProjectFilterValue(filterOptions.size, previewMode ? previewFilters.size : searchParams?.size);

  const updateFilter = (key, value) => {
    setCurrentPage(1);
    if (previewMode) {
      setPreviewFilters((current) => ({ ...current, [key]: value }));
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (value === 'all') params.delete(key); else params.set(key, value);
    const query = params.toString();
    router.replace(query ? `/projects?${query}` : '/projects', { scroll: false });
  };

  const filteredProjects = allProjects.filter((project) => (
    (filterStatus === 'all' || project.lifecycle === filterStatus)
    && (filterCategory === 'all' || project.propertyCategory === filterCategory)
    && (filterLocation === 'all' || project.locationKey === filterLocation)
    && (filterSize === 'all' || project.sizeCategory === filterSize)
  ));
  const itemsPerPage = Number(listing.itemsPerPage) || 6;
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const scrollToGrid = () => {
    if (previewMode) return;
    const element = document.querySelector('.projects-grid-area');
    if (element) window.scrollTo({ top: element.getBoundingClientRect().top + window.pageYOffset - 100, behavior: 'smooth' });
  };
  const resetFilters = () => {
    setPreviewFilters({ status: 'all', category: 'all', location: 'all', size: 'all' }); setCurrentPage(1);
    if (!previewMode) router.replace('/projects', { scroll: false });
  };

  if (!projectsPage.isVisible) return null;
  const body = (
    <main style={{ marginTop: previewMode ? 0 : '80px' }}>
      <PageHeader
        title={projectsPage.content.header.title}
        subtitle={projectsPage.content.header.subtitle}
        breadcrumbs={[{ label: projectsPage.content.header.breadcrumbLabel }]}
        bgImage={projectsPage.content.header.media?.secureUrl}
      />
      <section className="projects-portfolio-section">
        <div className="container-full projects-portfolio-layout">
          <aside className="projects-sidebar-filter">
            <div className="sidebar-filter-header">
              <span className="sidebar-filter-title">{listing.filterTitle}</span>
              <button type="button" onClick={resetFilters} className="btn-sidebar-reset">{listing.resetLabel} <PublicIcon iconClass="fa-solid fa-rotate-right ml-1" /></button>
            </div>
            <div className="sidebar-filter-content">
              <div className="filter-dropdown-select"><label className="filter-select-label" htmlFor="project-status-filter">{listing.statusLabel}</label><select id="project-status-filter" value={filterStatus} onChange={(event) => updateFilter('status', event.target.value)} className="luxury-select-field"><option value="all">{listing.allStatusLabel}</option>{filterOptions.status.map((option) => <option value={option.key} key={option.key}>{option.label}</option>)}</select></div>
              <div className="filter-dropdown-select"><label className="filter-select-label" htmlFor="project-category-filter">{listing.categoryLabel}</label><select id="project-category-filter" value={filterCategory} onChange={(event) => updateFilter('category', event.target.value)} className="luxury-select-field"><option value="all">{listing.allCategoryLabel}</option>{filterOptions.category.map((option) => <option value={option.key} key={option.key}>{option.label}</option>)}</select></div>
              <div className="filter-dropdown-select"><label className="filter-select-label" htmlFor="project-location-filter">{listing.locationLabel}</label><select id="project-location-filter" value={filterLocation} onChange={(event) => updateFilter('location', event.target.value)} className="luxury-select-field"><option value="all">{listing.allLocationLabel}</option>{filterOptions.location.map((option) => <option value={option.key} key={option.key}>{option.label}</option>)}</select></div>
              <div className="filter-dropdown-select"><label className="filter-select-label" htmlFor="project-size-filter">{listing.sizeLabel}</label><select id="project-size-filter" value={filterSize} onChange={(event) => updateFilter('size', event.target.value)} className="luxury-select-field"><option value="all">{listing.allSizeLabel}</option>{filterOptions.size.map((option) => <option value={option.key} key={option.key}>{option.label}</option>)}</select></div>
            </div>
          </aside>
          <div className="projects-grid-area">
            <div className="results-count">{renderTemplate(listing.resultsTemplate, { visible: filteredProjects.length, total: allProjects.length })}</div>
            {filteredProjects.length > 0 ? <>
              <div className="projects-asymmetric-grid">{paginatedProjects.map((project, index) => <ProjectCard key={project.projectId} project={project} index={index} />)}</div>
              {totalPages > 1 && <div className="pagination-container">
                <button type="button" onClick={() => { setCurrentPage((page) => Math.max(page - 1, 1)); scrollToGrid(); }} disabled={currentPage === 1} className="pagination-btn pagination-prev"><PublicIcon iconClass="fa-solid fa-chevron-left" /> {listing.previousLabel}</button>
                <div className="pagination-pages">{Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => <button type="button" key={page} onClick={() => { setCurrentPage(page); scrollToGrid(); }} className={`pagination-number ${currentPage === page ? 'active' : ''}`}>{page}</button>)}</div>
                <button type="button" onClick={() => { setCurrentPage((page) => Math.min(page + 1, totalPages)); scrollToGrid(); }} disabled={currentPage === totalPages} className="pagination-btn pagination-next">{listing.nextLabel} <PublicIcon iconClass="fa-solid fa-chevron-right" /></button>
              </div>}
            </> : <div className="no-results-box-sidebar"><div className="no-results-icon"><PublicIcon iconClass="fa-solid fa-circle-exclamation" /></div><h3 className="no-results-title">{listing.emptyTitle}</h3><p className="no-results-text">{listing.emptyBody}</p><button type="button" onClick={resetFilters} className="btn-luxury-reset" style={{ marginTop: '10px' }}>{listing.emptyResetLabel}</button></div>}
          </div>
        </div>
      </section>
    </main>
  );
  if (previewMode) return <div>{body}</div>;
  return <div><Navbar />{body}<Footer /><ScrollToTop /></div>;
}

export default function ProjectsPageClient(props) {
  return <ProjectsContent {...props} />;
}
