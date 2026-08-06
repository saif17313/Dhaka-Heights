# Dhaka Heights — Decision Log

This log records major architectural, design, and implementation decisions made during the project lifecycle.

---

## Decision 001: Hybrid Database Architecture (Generic Sections + Relational Domain Entities)
- **Date**: 2026-07-31
- **Context**: The website contains both generic page content sections (hero sliders, metrics banners, commitment quotes) and rich relational business entities (Projects, Sister Concerns, Articles, Job Openings).
- **Decision**: Adopt a hybrid CMS schema:
  1. `page_sections` and `section_items` for generic page content.
  2. Dedicated structured domain tables (`projects`, `concerns`, `media_posts`, `job_openings`).
  3. Relational placement tables (`section_entity_selections` & `section_entity_selection_items`) allowing administrators to pick canonical entities for homepage/section displays without data duplication.
- **Consequences**: Ensures canonical data integrity across the site while maintaining flexibility for section-specific display overrides.

---

## Decision 002: Cloudinary for Public Media & Private Supabase Storage for Resumes
- **Date**: 2026-07-31
- **Context**: Public website images need high-speed global CDN delivery and dynamic webp transformations, whereas applicant CV files contain sensitive personal information that must remain private.
- **Decision**:
  1. Use Cloudinary for all public visual assets (Hero images, project covers, galleries, logos, custom SVG icons) using server-signed uploads under `dhaka-heights/dev`.
  2. Use a private Supabase Storage bucket (`career-resumes`) with strict RLS policies and short-lived signed URLs for career CV uploads.
- **Consequences**: Guarantees fast public page loads while maintaining high security compliance for applicant data.

---

## Decision 003: Preserving Baseline Output While Flagging Content Conflicts
- **Date**: 2026-07-31
- **Context**: Audit revealed conflicting project details (e.g. BD Palace location listed as Gulshan-2 in grid vs Bashundhara R/A in concern page).
- **Decision**: Do not silently guess business data. Preserve existing visible output on respective pages via placement-specific overrides, document all conflicts in `CONTENT_CONFLICTS.md`, and display a conflict indicator in the Admin panel.
- **Consequences**: Prevents unauthorized business data changes while highlighting conflicts for user review.

---

## Decision 004: Strict Branch & Push Policy Compliance
- **Date**: 2026-07-31
- **Context**: Project requires working on `feat/dynamic-cms-admin` without modifying `main` or pushing without explicit user permission.
- **Decision**: Maintain all Phase work on local branch `feat/dynamic-cms-admin`, create atomic local commits per verified unit of work, and never run `git push` or merge into `main` without explicit chat authorization.
- **Consequences**: Guarantees repository safety and provides recoverable local checkpoints.
