# Dhaka Heights — Project Changelog

All notable changes to the Dhaka Heights website conversion and administration panel will be documented in this file.

---

## [Phase 14] - 2026-07-31 — Verification, Testing & Final Handoff

### Completed
- Verified production build compilation (`npm run build`) in 3.5s with zero warnings or errors.
- Verified automated security scanner (`node scripts/audit-security.mjs`) reporting ZERO secret leaks.
- Verified zero visual regression against Phase 0 baseline screenshots across Desktop (1440px), Laptop (1024px), Tablet (768px), and Mobile (390px) viewports.
- All 14 implementation phases completed on branch `feat/dynamic-cms-admin`.

---

## [Phase 13] - 2026-07-31 — Data Integrity & Known Defects

### Fixed
- Fixed broken concern route `/concern/dhaka-heights-realty` by mapping/aliasing slug to `dhaka-heights-business-solution`.
- Fixed Hero Slider CTA destination scroll handler defect in `HeroSlider.js`.

---

## [Phase 12] - 2026-07-31 — Security Hardening & Audit

### Added
- Created automated security audit script [`scripts/audit-security.mjs`](file:///d:/Projects/Dhaka-Heights/Dhaka-Heights/scripts/audit-security.mjs).
- Verified ZERO client secret leaks (`SUPABASE_SECRET_KEY`, `CLOUDINARY_API_SECRET`).

---

## [Phase 11] - 2026-07-31 — Responsiveness & Accessibility

### Added
- Added `:focus-visible` outline ring rules, `.sr-only` utility, and `@media (prefers-reduced-motion: reduce)` rules.

---

## [Phase 10] - 2026-07-31 — Draft, Publish, & Revision Workflow

### Added
- Built Revision & Revalidation service and Publish API endpoint.

---

## [Phase 9] - 2026-07-31 — Preview System

### Added
- Built Live Preview Component with real-time viewport toggles.

---

## [Phase 8] - 2026-07-31 — Admin CRUD Modules

### Added
- Built Projects Management Module, Sister Concerns Module, Media Posts & Articles Module, Careers & CV Download Links Module, Customer Inquiries Inbox, Pages & Sections Editor, Navigation Editor, Site Settings & SEO Editor, Users & Roles Module, and Audit Log Viewer.

---

## [Phase 7] - 2026-07-31 — Admin Panel Design System & Shell

### Added
- Built Admin Layout Shell, Responsive Sidebar, Topbar Header, and Executive Dashboard.

---

## [Phase 6] - 2026-07-31 — Real Form Submissions

### Added
- Built Contact Inquiry submission handler, Project Callback handler, and Career Application handler with private PDF CV upload to `career-resumes` bucket.

---

## [Phase 5] - 2026-07-31 — Read-Only Dynamic Public Website

### Added
- Converted public website routes to read dynamic data from Supabase in read-only mode.

---

## [Phase 4] - 2026-07-31 — Current Content Migration

### Added
- Created automated, idempotent migration script `scripts/migrate-static-content.mjs`.

---

## [Phase 3] - 2026-07-31 — Cloudinary Media Infrastructure

### Added
- Built server-side Cloudinary configuration utility, signed upload route, metadata service, REST media API, Media Library UI, and Icon Picker.

---

## [Phase 2] - 2026-07-31 — Supabase Foundation

### Added
- Built Browser, SSR Server, and Admin Supabase client helpers and auth middleware.

---

## [Phase 1] - 2026-07-31 — CMS & Database Architecture

### Added
- Created SQL DDL migration, RLS policies, and database seed script.

---

## [Phase 0] - 2026-07-31 — Baseline Audit & Environment Configuration

### Added
- Created environment configuration `.env.local` and safe template `.env.example`.
- Created safe setup status document `docs/cloud-setup-status.md`.
- Initialized complete `docs/dynamic-cms/` context documentation directory.
