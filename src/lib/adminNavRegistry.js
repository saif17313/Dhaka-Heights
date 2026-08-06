import { createClient } from '@/lib/supabase/client';

export const BASE_NAV_DOMAINS = [
  {
    id: 'dashboard',
    label: 'Executive Dashboard',
    href: '/admin',
    icon: 'fa-gauge-high',
    roles: ['super_admin', 'content_editor', 'sales_manager', 'hr_manager'],
  },
  {
    id: 'pages',
    label: 'Website Pages & Layout Sections',
    href: '/admin/pages',
    icon: 'fa-layer-group',
    roles: ['super_admin', 'content_editor'],
    isAccordion: true,
  },
  {
    id: 'projects',
    label: 'Real Estate Projects',
    href: '/admin/projects',
    icon: 'fa-building-user',
    roles: ['super_admin', 'content_editor', 'sales_manager'],
    isAccordion: true,
    children: [
      { label: 'Projects Page & Catalog', href: '/admin/projects' },
    ],
  },
  {
    id: 'concerns',
    label: 'Sister Concerns',
    href: '/admin/concerns',
    icon: 'fa-briefcase',
    roles: ['super_admin', 'content_editor'],
    isAccordion: true,
  },
  {
    id: 'media',
    label: 'Media & Articles',
    href: '/admin/articles',
    icon: 'fa-newspaper',
    roles: ['super_admin', 'content_editor'],
    isAccordion: true,
    children: [
      { label: 'All Content', href: '/admin/articles' },
      { label: 'Press Releases', href: '/admin/media/news' },
      { label: 'Blogs & Articles', href: '/admin/media/articles' },
      { label: 'Customer Reviews', href: '/admin/media/customer-reviews' },
    ],
  },
  {
    id: 'careers',
    label: 'Careers & Vacancies',
    href: '/admin/careers',
    icon: 'fa-user-tie',
    roles: ['super_admin', 'hr_manager'],
    isAccordion: true,
    children: [
      { label: 'Active Vacancies', href: '/admin/careers/vacancies' },
      { label: 'CV Applications', href: '/admin/careers/applications' },
    ],
  },
  {
    id: 'inquiries',
    label: 'Inquiries & Leads',
    href: '/admin/inquiries',
    icon: 'fa-inbox',
    roles: ['super_admin', 'sales_manager'],
    isAccordion: true,
    children: [
      { label: 'All Inquiries', href: '/admin/inquiries' },
      { label: 'New Leads', href: '/admin/inquiries/new' },
      { label: 'Contacted', href: '/admin/inquiries/contacted' },
      { label: 'Qualified', href: '/admin/inquiries/qualified' },
    ],
  },
  {
    id: 'navigation',
    label: 'Navigation & Footer',
    href: '/admin/navigation',
    icon: 'fa-sitemap',
    roles: ['super_admin', 'content_editor'],
    isAccordion: true,
    children: [
      { label: 'Header Navigation', href: '/admin/navigation/header' },
      { label: 'Footer Groups', href: '/admin/navigation/footer' },
      { label: 'Social Links', href: '/admin/navigation/social-links' },
    ],
  },
  {
    id: 'media_library',
    label: 'Media Library',
    href: '/admin/media',
    icon: 'fa-photo-film',
    roles: ['super_admin', 'content_editor'],
  },
  {
    id: 'settings',
    label: 'Site Settings & SEO',
    href: '/admin/settings',
    icon: 'fa-sliders',
    roles: ['super_admin'],
  },
  {
    id: 'users',
    label: 'Users & Roles',
    href: '/admin/users',
    icon: 'fa-users-gear',
    roles: ['super_admin'],
  },
  {
    id: 'audit',
    label: 'Audit Log Trail',
    href: '/admin/audit-logs',
    icon: 'fa-shield-halved',
    roles: ['super_admin'],
  },
];

export async function fetchHybridNavigationTree(role = 'super_admin') {
  const supabase = createClient();

  // Filter base domains by RBAC role
  const allowedDomains = BASE_NAV_DOMAINS.filter(
    (domain) => !domain.roles || domain.roles.includes(role) || role === 'super_admin'
  );

  // Dynamically load public pages and section children
  try {
    const { data: pagesData } = await supabase
      .from('pages')
      .select('id, slug, title')
      .order('created_at', { ascending: true });

    const { data: sectionsData } = await supabase
      .from('page_sections')
      .select('id, page_id, section_key, section_name, status, version_number')
      .order('sort_order', { ascending: true });

    const pageChildren = (pagesData || [
      { id: '1', slug: 'home', title: 'Home Page' },
      { id: '2', slug: 'about', title: 'About Page' },
      { id: '3', slug: 'projects', title: 'Projects Page' },
      { id: '4', slug: 'concern', title: 'Concerns Page' },
      { id: '5', slug: 'media-center', title: 'Media Page' },
      { id: '6', slug: 'career', title: 'Career Page' },
      { id: '7', slug: 'contact', title: 'Contact Page' },
    ]).map((p) => {
      const statusPriority = { draft: 3, published: 2, archived: 1 };
      const currentSections = new Map();
      for (const section of (sectionsData || []).filter((item) => item.page_id === p.id)) {
        const current = currentSections.get(section.section_key);
        if (
          !current
          || (statusPriority[section.status] || 0) > (statusPriority[current.status] || 0)
          || (
            section.status === current.status
            && Number(section.version_number || 0) > Number(current.version_number || 0)
          )
        ) {
          currentSections.set(section.section_key, section);
        }
      }

      const pSections = [...currentSections.values()].map((s) => ({
          label: s.section_name || s.section_key,
          href: `/admin/pages/${p.slug}/sections/${s.section_key}`,
      }));

      // Default section children fallbacks
      const defaultSectionsMap = {
        home: [
          { label: 'Overview', href: `/admin/pages/home` },
          { label: 'Hero Slider', href: `/admin/pages/home/sections/hero-slider` },
          { label: 'About Corporate Block', href: `/admin/pages/home/sections/about-corporate-home` },
          { label: 'Statistics Counter', href: `/admin/pages/home/sections/statistics-counter` },
          { label: 'Featured Projects', href: `/admin/pages/home/sections/featured-projects-home` },
          { label: 'Commitment Quote', href: `/admin/pages/home/sections/commitment-quote` },
          { label: 'Media Highlights', href: `/admin/pages/home/sections/media-highlights-home` },
          { label: 'Partners Carousel', href: `/admin/pages/home/sections/partners-carousel` },
          { label: 'Contact Section', href: `/admin/pages/home/sections/contact-section-home` },
        ],
        about: [
          { label: 'Overview', href: `/admin/pages/about` },
          { label: 'Company Introduction', href: `/admin/pages/about/sections/company-introduction` },
        ],
        projects: [
          { label: 'Overview', href: `/admin/pages/projects` },
          { label: 'Projects Page & Catalog', href: `/admin/pages/projects` },
        ],
        concern: [
          { label: 'Overview', href: `/admin/pages/concerns` },
          { label: 'Group Overview', href: `/admin/pages/concerns/sections/group-overview` },
        ],
        'media-center': [
          { label: 'Overview', href: `/admin/pages/media` },
          { label: 'Latest News', href: `/admin/pages/media/sections/latest-news-section` },
        ],
        career: [
          { label: 'Overview', href: `/admin/pages/career` },
          { label: 'Working at Dhaka Heights', href: `/admin/pages/career/sections/working-at-dhaka-heights` },
        ],
        contact: [
          { label: 'Overview', href: `/admin/pages/contact` },
          { label: 'Corporate Office Info', href: `/admin/pages/contact/sections/corporate-office-info` },
        ],
      };

      return {
        label: p.title || p.slug,
        href: `/admin/pages/${p.slug}`,
        children: pSections.length > 0
          ? [{ label: 'Overview', href: `/admin/pages/${p.slug}` }, ...pSections]
          : defaultSectionsMap[p.slug] || [{ label: 'Overview', href: `/admin/pages/${p.slug}` }],
      };
    });

    // Populate Pages Domain Children
    const pagesDomain = allowedDomains.find((d) => d.id === 'pages');
    if (pagesDomain) {
      pagesDomain.children = pageChildren;
    }

    // Dynamically load sister concerns submenu
    const { data: concernsData } = await supabase
      .from('concerns')
      .select('slug, name')
      .order('sort_order', { ascending: true })
      .limit(6);

    const concernsDomain = allowedDomains.find((d) => d.id === 'concerns');
    if (concernsDomain) {
      concernsDomain.children = [
        { label: 'All Concerns', href: '/admin/concerns' },
        ...(concernsData || []).map((c) => ({
          label: c.name,
          href: `/admin/concerns/${c.slug}`,
        })),
      ];
    }
  } catch (err) {
    console.warn('Navigation dynamic fetch fallback:', err.message);
  }

  return allowedDomains;
}
