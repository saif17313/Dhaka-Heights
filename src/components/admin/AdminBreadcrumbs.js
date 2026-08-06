'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const PATH_LABELS = {
  admin: 'Admin Portal',
  pages: 'Website Pages',
  home: 'Home Page',
  about: 'About Page',
  projects: 'Projects',
  concerns: 'Sister Concerns',
  articles: 'Media & Articles',
  media: 'Media Library',
  careers: 'Careers & Vacancies',
  inquiries: 'Inquiries Inbox',
  navigation: 'Navigation & Footer',
  settings: 'Site Settings',
  users: 'Users & Roles',
  'audit-logs': 'Audit Trail Log',
  sections: 'Sections',
  hero: 'Hero Section',
  overview: 'Corporate Overview',
  'about-summary': 'About Summary',
  'featured-projects': 'Featured Projects',
  'contact-cta': 'Contact CTA',
  vacancies: 'Active Vacancies',
  applications: 'CV Submissions',
  header: 'Header Navigation',
  footer: 'Footer Link Groups',
};

export default function AdminBreadcrumbs() {
  const pathname = usePathname();
  if (!pathname || pathname === '/admin/login') return null;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const breadcrumbItems = [];
  let currentPath = '';

  segments.forEach((seg, idx) => {
    currentPath += `/${seg}`;
    const formattedLabel = PATH_LABELS[seg] || seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    breadcrumbItems.push({
      label: formattedLabel,
      href: currentPath,
      isLast: idx === segments.length - 1,
    });
  });

  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-500 font-medium py-1">
      {breadcrumbItems.map((item, i) => (
        <React.Fragment key={item.href}>
          {i > 0 && <i className="fa-solid fa-chevron-right text-[8px] text-gray-300 mx-0.5"></i>}
          {item.isLast ? (
            <span className="font-bold text-[#0B1B3D] truncate">{item.label}</span>
          ) : (
            <Link href={item.href} className="hover:text-[#B59410] transition truncate">
              {item.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
