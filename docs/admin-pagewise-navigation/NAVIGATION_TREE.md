# Sidebar Navigation Tree Specification

## Overview
This document defines the hybrid code-controlled and database-driven nested accordion sidebar hierarchy for the Dhaka Heights administration portal.

---

## Navigation Hierarchy

```text
ADMINISTRATION PORTAL
├── Executive Dashboard (/admin)
│
├── Website Pages & Layout Sections (/admin/pages) [EXPANDABLE ACCORDION]
│   ├── Home Page (/admin/pages/home)
│   │   ├── Overview (/admin/pages/home)
│   │   ├── Hero Section (/admin/pages/home/sections/hero)
│   │   ├── Corporate Overview (/admin/pages/home/sections/overview)
│   │   ├── About Summary (/admin/pages/home/sections/about-summary)
│   │   ├── Featured Projects (/admin/pages/home/sections/featured-projects)
│   │   ├── Sister Concerns Summary (/admin/pages/home/sections/sister-concerns-summary)
│   │   ├── Metrics Stats (/admin/pages/home/sections/metrics-stats)
│   │   └── Contact CTA (/admin/pages/home/sections/contact-cta)
│   │
│   ├── About Page (/admin/pages/about)
│   │   ├── Overview (/admin/pages/about)
│   │   ├── Company Introduction (/admin/pages/about/sections/company-introduction)
│   │   ├── Leadership Message (/admin/pages/about/sections/leadership-message)
│   │   └── Core Values (/admin/pages/about/sections/core-values)
│   │
│   ├── Projects Page (/admin/pages/projects)
│   │   ├── Overview (/admin/pages/projects)
│   │   ├── Portfolio Hero (/admin/pages/projects/sections/portfolio-hero)
│   │   └── Project Filters (/admin/pages/projects/sections/project-filters)
│   │
│   ├── Concerns Page (/admin/pages/concerns)
│   │   ├── Overview (/admin/pages/concerns)
│   │   └── Group Overview (/admin/pages/concerns/sections/subsidiary-group-overview)
│   │
│   ├── Media Page (/admin/pages/media)
│   │   ├── Overview (/admin/pages/media)
│   │   ├── Latest News (/admin/pages/media/sections/latest-news-section)
│   │   └── Blog Articles (/admin/pages/media/sections/blog-articles-section)
│   │
│   ├── Career Page (/admin/pages/career)
│   │   ├── Overview (/admin/pages/career)
│   │   └── Working at Dhaka Heights (/admin/pages/career/sections/working-at-dhaka-heights)
│   │
│   └── Contact Page (/admin/pages/contact)
│       ├── Overview (/admin/pages/contact)
│       └── Corporate Office Info (/admin/pages/contact/sections/corporate-office-info)
│
├── Real Estate Projects (/admin/projects) [EXPANDABLE ACCORDION]
│   ├── All Projects (/admin/projects)
│   ├── Ongoing Projects (/admin/projects/status/ongoing)
│   ├── Completed Projects (/admin/projects/status/completed)
│   └── Upcoming Projects (/admin/projects/status/upcoming)
│
├── Sister Concerns (/admin/concerns) [EXPANDABLE ACCORDION]
│   ├── All Subsidiaries (/admin/concerns)
│   └── [Dynamic Top Concerns List from Supabase]
│
├── Media & Articles (/admin/media) [EXPANDABLE ACCORDION]
│   ├── All Media Posts (/admin/media)
│   ├── Press Releases (/admin/media/news)
│   └── Blog Articles (/admin/media/articles)
│
├── Careers & Vacancies (/admin/careers) [EXPANDABLE ACCORDION]
│   ├── Active Vacancies (/admin/careers/vacancies)
│   └── CV Applications (/admin/careers/applications)
│
├── Inquiries & Leads (/admin/inquiries) [EXPANDABLE ACCORDION]
│   ├── All Inquiries (/admin/inquiries)
│   ├── New Leads (/admin/inquiries/status/new)
│   ├── In Progress (/admin/inquiries/status/in_progress)
│   └── Responded (/admin/inquiries/status/responded)
│
├── Navigation & Footer (/admin/navigation) [EXPANDABLE ACCORDION]
│   ├── Header Menus (/admin/navigation/header)
│   ├── Footer Groups (/admin/navigation/footer)
│   └── Social Links (/admin/navigation/social-links)
│
├── Media Library (/admin/media)
├── Site Settings & SEO (/admin/settings)
├── Users & Roles (/admin/users)
└── Audit Log Trail (/admin/audit-logs)
```

---

## Accordion Behavior Rules
1. **Single Group Expansion**: Expanding a new primary group automatically collapses other non-active groups.
2. **Current Route Auto-Expansion**: Navigating to or refreshing a deep URL (e.g. `/admin/pages/home/sections/hero`) automatically opens its parent accordion group (`Website Pages & Layout Sections` -> `Home Page`).
3. **Active Path Highlighting**: Parent accordion items render active visual indicators (gold border, dark navy text) whenever a descendant child route is active.
