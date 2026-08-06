'use client';

import React from 'react';
import Link from 'next/link';

const STANDARD_PROJECT_STATUSES = new Set(['ongoing', 'completed', 'upcoming']);

function dynamicBadgeStyle(status) {
  return STANDARD_PROJECT_STATUSES.has(status) ? undefined : { backgroundColor: 'var(--primary-navy)' };
}

function displayFilterLabel(value) {
  if (value === 'all') return 'All Projects';
  return value.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

export default function ProjectsGrid({ featuredProjects, activeFilter = 'all', onFilterChange = () => {}, previewMode = false }) {
  const [pagination, setPagination] = React.useState({ filter: activeFilter, page: 1 });
  const placedProjects = React.useMemo(
    () => (featuredProjects?.projects || [])
      .filter((placement) => placement.isVisible !== false && placement.project)
      .map((placement) => placement.project),
    [featuredProjects]
  );

  const filters = React.useMemo(() => ['all', ...new Set(placedProjects.map((project) => project.category).filter(Boolean))], [placedProjects]);
  const effectiveFilter = filters.includes(activeFilter) ? activeFilter : 'all';
  const currentPage = pagination.filter === effectiveFilter ? pagination.page : 1;

  React.useEffect(() => {
    if (previewMode) return undefined;
    const revealElements = document.querySelectorAll('#projects .scroll-reveal');
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('revealed');
          else entry.target.classList.remove('revealed');
        });
      },
      { threshold: 0.1 }
    );

    revealElements.forEach((element) => revealObserver.observe(element));
    return () => revealElements.forEach((element) => revealObserver.unobserve(element));
  }, [currentPage, previewMode]);

  if (!featuredProjects || featuredProjects.isVisible === false) return null;

  const filteredProjects = effectiveFilter === 'all'
    ? placedProjects
    : placedProjects.filter((project) => project.category === effectiveFilter);
  const projectsPerPage = featuredProjects.pageSize || 6;
  const totalPages = Math.ceil(filteredProjects.length / projectsPerPage);
  const safeCurrentPage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safeCurrentPage - 1) * projectsPerPage;
  const paginatedProjects = filteredProjects.slice(startIndex, startIndex + projectsPerPage);

  const changePage = (nextPage) => {
    setPagination({ filter: effectiveFilter, page: nextPage });
    if (!previewMode) document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="projects" className={`projects-section scroll-reveal ${previewMode ? 'revealed' : ''}`}>
      <div className="container-full">
        <div className="section-header-flex">
          <div>
            <span className="section-tag">{featuredProjects.tagText}</span>
            <h2 className="section-title">{featuredProjects.heading}</h2>
          </div>

          <div className="filter-controls" role="tablist" aria-label="Filter featured projects">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                className={`filter-btn ${effectiveFilter === filter ? 'active' : ''}`}
                onClick={() => {
                  setPagination({ filter, page: 1 });
                  onFilterChange(filter);
                }}
                role="tab"
                aria-selected={effectiveFilter === filter}
              >
                {displayFilterLabel(filter)}
              </button>
            ))}
          </div>
        </div>

        <div className="projects-grid">
          {paginatedProjects.map((project) => (
            <Link
              key={project.id}
              href={`/project/${project.slug}`}
              className={`project-card scroll-reveal zoom-in ${previewMode ? 'revealed' : ''}`}
              style={{ display: 'block' }}
            >
              <div className="project-img-wrapper">
                <img
                  src={project.coverMedia?.secureUrl}
                  alt={project.coverMedia?.altText || project.name}
                  className="project-img"
                />
                <div className={`project-badge badge-${project.category}`} style={dynamicBadgeStyle(project.category)}>{project.badgeText}</div>
                <div className="project-hover-overlay">
                  <span className="explore-icon-wrapper">
                    <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
                  </span>
                </div>
              </div>
              <div className="project-info">
                <span className="project-location">
                  <i className="fa-solid fa-location-dot" aria-hidden="true"></i> {project.location}
                </span>
                <h3 className="project-name">{project.name}</h3>
                <div className="project-details-row">
                  <span className="project-size">
                    <i className="fa-solid fa-ruler-combined" aria-hidden="true"></i> {project.size}
                  </span>
                  <span className="project-type">
                    <i className="fa-solid fa-briefcase" aria-hidden="true"></i> {project.projectType}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              onClick={() => changePage(safeCurrentPage - 1)}
              disabled={safeCurrentPage === 1}
              aria-label="Previous page"
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <div className="pagination-info">
              <span className="pagination-current">{safeCurrentPage}</span>
              <span className="pagination-divider">/</span>
              <span className="pagination-total">{totalPages}</span>
            </div>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => changePage(safeCurrentPage + 1)}
              disabled={safeCurrentPage === totalPages}
              aria-label="Next page"
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
