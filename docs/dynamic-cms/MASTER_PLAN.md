# Dhaka Heights Dynamic CMS & Admin Panel — Master Plan

## 1. Executive Summary & Objective

The primary objective of this project is to convert the existing static Dhaka Heights website into a fully dynamic, database-driven website powered by Supabase and Cloudinary, complete with a modern, high-performance administration panel under `/admin`.

### Core Requirements & Guardrails
- **Zero Visual Redesign on Public Site**: The public-facing website must preserve its existing visual design, typography, color palette (Navy `#0B1B3D`, Gold `#C5A880`, Ivory/Cream), component structures, 3D visual character, responsive behavior, CSS architecture, and route structure.
- **Content Management**: All text, images, icons, links, card collections, section headers, repeated lists, and site configurations will be manageable via the `/admin` portal.
- **Relational Entity Selections**: Canonical records (e.g., Projects, Concerns, Media Posts) exist in dedicated tables and can be relationally selected and reordered on section placements (e.g. Featured Projects on Homepage) without record duplication.
- **Security & RBAC**: Supabase Row Level Security (RLS) policies enforce public read-only access for published content, role-based access for admins (`super_admin`, `content_editor`, `sales_manager`, `hr_manager`), and server-side validation.
- **Private Submissions & Storage**: Contact inquiries and career applications persist in Supabase. Applicant CV files are stored in private Supabase Storage buckets with short-lived signed URLs.
- **Cloudinary Integration**: Server-signed image and video uploads target `dhaka-heights/dev` with metadata tracking in `media_assets`.

---

## 2. Phase-by-Phase Roadmap

### Phase 0: Baseline Audit & Safety (Current Phase)
- Codebase inspection, package validation, and baseline environment setup.
- Verification of Git branch safety (`feat/dynamic-cms-admin`) and baseline backup (`backup/static-website-baseline`).
- Production build & lint execution.
- Capture baseline screenshots at 1440px, 1024px, 768px, and 390px viewports.
- Route, section, and hardcoded content inventory mapping.
- Documentation of content conflicts and existing code issues in `docs/dynamic-cms/`.

### Phase 1: CMS & Database Architecture
- Design relational hybrid CMS database schema in `DATABASE_SCHEMA.md`.
- Define core tables (`site_settings`, `pages`, `page_sections`, `section_items`), domain tables (`projects`, `concerns`, `media_posts`, `job_openings`), relational selections (`section_entity_selections`), and submissions (`inquiries`, `career_applications`).
- Define RLS policies, audit logs, and trigger functions.

### Phase 2: Supabase Foundation
- Setup SSR Supabase clients (`@supabase/ssr` / `@supabase/supabase-js`).
- Implement database migrations under `supabase/migrations/`.
- Implement RLS policies for public vs admin permissions.
- Setup private storage bucket `career-resumes` for CV uploads.
- Create seed data script for initial roles and admin setup.

### Phase 3: Cloudinary Media Infrastructure
- Implement server-side signed Cloudinary upload endpoint.
- Build Cloudinary folder hierarchy under `dhaka-heights/dev/`.
- Build central Media Library module in `/admin` with metadata tracking (`media_assets`).
- Build Icon Picker supporting Lucide allowlist and custom Cloudinary SVGs.

### Phase 4: Current Content Migration
- Create automated, idempotent migration script to extract hardcoded data, upload assets to Cloudinary, populate Supabase tables, and preserve route slugs.

### Phase 5: Read-Only Dynamic Public Website
- Replace hardcoded data on all public routes with Supabase queries.
- Retain exact styling, animation, layout, and responsive properties.
- Verify against Phase 0 baseline screenshots.

### Phase 6: Real Form Submissions
- Wire up Contact Form, Project Inquiry, Callback Request, Layout PDF Request, and Career Application forms to write directly to Supabase.
- Store CV files in private Supabase storage.

### Phase 7: Admin Panel Design System & Shell
- Implement `/admin` shell with Navy/Gold glassmorphism aesthetics, responsive sidebar, breadcrumbs, search, user menu, toast notifications, and dashboard widgets.

### Phase 8: Admin CRUD Modules
- Build comprehensive management modules: Dashboard, Page Editors, Projects, Concerns, Media Posts, Job Openings, Inquiries, Applications, Media Library, Site Settings, SEO, Admin Users, Audit Logs.

### Phase 9: Preview System
- Implement draft/publish workflow with live responsive preview frames for sections and full pages.

### Phase 10: Draft, Publish, & Revision Workflow
- Implement draft vs published state handling, atomic publishing, route revalidation, and revision history.

### Phase 11: Responsiveness, Accessibility & Polish
- Ensure mobile drawer, touch targets, keyboard navigation, trap focus in modals, and prefers-reduced-motion support.

### Phase 12: Security Hardening & Audit
- Enforce strict RLS policies, SVG sanitization, rate limiting, and secret scanning.

### Phase 13: Data Integrity & Bug Fixes
- Fix broken concern route (`/concern/dhaka-heights-realty`), fix hero CTA navigation, resolve duplicate data sources, and unify company contact info.

### Phase 14: Verification, Testing & Handoff
- Execute full test matrix, verify production build, confirm visual regression compliance against baseline screenshots, and update `HANDOFF.md`.

---

## 3. Architecture Decisions Overview

1. **Next.js App Router & Server Components**: Server components perform data fetching from Supabase with proper caching/revalidation. Client components handle interactive state (sliders, modals, filters).
2. **Hybrid CMS Model**: Domain entities (Projects, Concerns, Articles, Jobs) have dedicated structured relational tables. Generic sections use `page_sections` and `section_items`.
3. **No Unsanitized HTML/CSS**: Admins edit structured fields only (headers, descriptions, images, links). Custom styling is constrained to predefined CSS variant classes.
4. **Relational Placement Overrides**: Placement cards reference canonical entity IDs and support optional display overrides (custom short title, alternate cover image, CTA text).

---

## 4. Phase 0 Completion Criteria
- [x] All routes mapped & cataloged
- [x] All sections mapped & cataloged
- [x] Baseline build & lint status recorded
- [x] Baseline visual screenshots captured across 1440, 1024, 768, and 390 viewports
- [x] Content conflicts & codebase defects documented
- [x] 13 context files initialized in `docs/dynamic-cms/`
- [x] Git branch `feat/dynamic-cms-admin` clean and untracked secret files verified
