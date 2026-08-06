# Target Admin Route Map

## Overview
This document specifies the target page-wise, section-wise, and operational route structure for the Dhaka Heights Next.js administration portal.

---

## 1. Public Website Page CMS Routes

| Target Route Pattern | Entity Scope | Purpose / Functionality |
|---|---|---|
| `/admin/pages` | Overview Directory | Public website pages listing, overall section counts, and publication status overview. |
| `/admin/pages/[pageSlug]` | Page Overview | Single page overview (e.g. `/admin/pages/home`), section order list, page metadata, full page preview trigger. |
| `/admin/pages/[pageSlug]/sections/[sectionKey]` | Section Editor | Schema-aware section content editor (e.g. `/admin/pages/home/sections/hero`, `/admin/pages/about/sections/company-intro`). |

### Standard Public Page Routes & Sub-sections:
- **Homepage (`/admin/pages/home`)**:
  - `/admin/pages/home/sections/hero` (Hero Slider & Banners)
  - `/admin/pages/home/sections/overview` (Corporate Overview Summary)
  - `/admin/pages/home/sections/about-summary` (About Summary Block)
  - `/admin/pages/home/sections/featured-projects` (Featured Real Estate Properties Selector)
  - `/admin/pages/home/sections/sister-concerns-summary` (Subsidiary Highlights)
  - `/admin/pages/home/sections/metrics-stats` (Corporate Metrics Stats Banner)
  - `/admin/pages/home/sections/media-highlights` (News & Press Highlights)
  - `/admin/pages/home/sections/contact-cta` (Contact & Inquiry CTA Banner)
- **About Page (`/admin/pages/about`)**:
  - `/admin/pages/about/sections/company-introduction` (Company Story)
  - `/admin/pages/about/sections/leadership-message` (Chairman & MD Statement)
  - `/admin/pages/about/sections/core-values` (Corporate Values & Philosophy)
  - `/admin/pages/about/sections/milestones-timeline` (History & Milestones)
- **Projects Page (`/admin/pages/projects`)**:
  - `/admin/pages/projects/sections/portfolio-hero` (Projects Page Hero Banner)
  - `/admin/pages/projects/sections/project-filters` (Category Filter Layout)
  - `/admin/pages/projects/sections/download-brochure-cta` (Brochure Request CTA)
- **Concerns Page (`/admin/pages/concerns`)**:
  - `/admin/pages/concerns/sections/concerns-hero` (Subsidiaries Page Hero Banner)
  - `/admin/pages/concerns/sections/subsidiary-group-overview` (Group Overview)
- **Media Page (`/admin/pages/media`)**:
  - `/admin/pages/media/sections/media-hero` (Media Center Hero Banner)
  - `/admin/pages/media/sections/latest-news-section` (Latest News & Press Releases)
  - `/admin/pages/media/sections/blog-articles-section` (Articles & Blogs)
- **Career Page (`/admin/pages/career`)**:
  - `/admin/pages/career/sections/career-hero` (Career Page Hero Banner)
  - `/admin/pages/career/sections/working-at-dhaka-heights` (Culture & Perks)
- **Contact Page (`/admin/pages/contact`)**:
  - `/admin/pages/contact/sections/contact-hero` (Contact Page Hero Banner)
  - `/admin/pages/contact/sections/corporate-office-info` (Headquarters Info)

---

## 2. Dedicated Operational Module Routes

| Operational Domain | Target Route Pattern | Purpose |
|---|---|---|
| **Real Estate Projects** | `/admin/projects` | All property records grid/table |
| | `/admin/projects/status/ongoing` | Filtered ongoing projects view |
| | `/admin/projects/status/completed` | Filtered completed projects view |
| | `/admin/projects/status/upcoming` | Filtered upcoming projects view |
| | `/admin/projects/[projectSlug]` | Dedicated canonical project editor |
| **Sister Concerns** | `/admin/concerns` | All subsidiary records list |
| | `/admin/concerns/[concernSlug]` | Dedicated subsidiary editor |
| **Media & Articles** | `/admin/media` | Media assets & published posts |
| | `/admin/media/news` | Filtered press releases & news |
| | `/admin/media/articles` | Filtered editorial blog articles |
| | `/admin/media/[contentSlug]` | Dedicated article editor |
| **Careers & Vacancies** | `/admin/careers/vacancies` | Job openings management |
| | `/admin/careers/applications` | Applicant CV submissions & private downloads |
| **Inquiries & Leads** | `/admin/inquiries` | All customer inquiries inbox |
| | `/admin/inquiries/status/[status]` | Filtered inquiries by workflow status (`new`, `in_progress`, `responded`) |
| **Global Navigation & Footer** | `/admin/navigation` | Header & Footer overview |
| | `/admin/navigation/header` | Header navigation menus manager |
| | `/admin/navigation/footer` | Footer groups & links manager |
| | `/admin/navigation/social-links` | Social channels manager |

---

## 3. Backward Compatibility & Redirect Strategy
- Existing route `/admin/pages` remains supported as the top-level Page Directory overview.
- Existing operational routes `/admin/projects`, `/admin/concerns`, `/admin/articles`, `/admin/careers`, `/admin/inquiries`, `/admin/navigation`, `/admin/media`, `/admin/settings` remain 100% active as canonical entity editors.
