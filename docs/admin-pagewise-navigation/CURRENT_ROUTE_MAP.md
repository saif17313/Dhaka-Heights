# Current Admin Route Map

## Overview
This document maps all existing administration routes in the Dhaka Heights Next.js application prior to the page-wise and section-wise navigation restructuring.

---

## Route Inventory

| Route | Type | Description | State / Access |
|---|---|---|---|
| `/admin` | Dashboard | Executive Dashboard overview with dynamic summary cards, activity feed, system health, and quick module links. | Authenticated |
| `/admin/login` | Auth | Standalone administrator login screen with email/password authentication. | Public / Auth |
| `/admin/pages` | CMS | Overview directory listing configured public website pages and live preview triggers. | Authenticated (Content Editor / Admin) |
| `/admin/projects` | Operational | Real estate property portfolio CRUD (Ongoing, Upcoming, Completed). | Authenticated (Sales / Content / Admin) |
| `/admin/concerns` | Operational | Sister concerns and subsidiary company overviews CRUD. | Authenticated (Content Editor / Admin) |
| `/admin/articles` | Operational | Media posts, press releases, and editorial articles CRUD. | Authenticated (Content Editor / Admin) |
| `/admin/careers` | Operational | Job vacancies posting and private applicant CV download management. | Authenticated (HR Manager / Admin) |
| `/admin/inquiries` | Operational | Customer leads inbox, project slot requests, and contact submissions management. | Authenticated (Sales Manager / Admin) |
| `/admin/navigation` | Operational / CMS | Global header navigation menus and footer link groups manager. | Authenticated (Content Editor / Admin) |
| `/admin/media` | Media | Central Cloudinary media asset library, image uploader, and asset selector. | Authenticated (Content Editor / Admin) |
| `/admin/settings` | System | Corporate coordinates, hotline numbers, head office address, and global site configuration. | Authenticated (Super Admin) |
| `/admin/users` | System | Admin user profiles, role assignments, and RBAC privileges. | Authenticated (Super Admin) |
| `/admin/audit-logs` | System | RLS-protected audit log trail of administrative actions and content revisions. | Authenticated (Super Admin) |

---

## Existing Route Limitations
1. **Lack of Deep Section Routing**: `pages` overview does not provide dedicated sub-routes for editing individual sections like `/admin/pages/home/sections/hero`.
2. **Flat Sidebar Menu**: The current sidebar is a flat list of top-level modules without expandable nested accordions.
3. **Selector Duplication**: Page selection is duplicated inside main workspace cards rather than driven cleanly through the sidebar navigation.
