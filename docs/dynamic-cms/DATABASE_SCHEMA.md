# Dhaka Heights — Relational Database Schema Specification

This document details the PostgreSQL database schema, tables, relationships, indexes, Row Level Security (RLS) policies, and private storage specs for Supabase.

---

## 1. Schema Overview & ERD Concept

```
site_settings
  └── (Global phone, address, social links, logos)

pages ──1:N──> page_sections ──1:N──> section_items
                    │
                    └──1:N──> section_entity_selections ──1:N──> section_entity_selection_items
                                                                        │ (FK)
                                                                ┌───────┴────────┐
                                                                ▼                ▼
                                                             projects        concerns / media_posts

media_assets ──1:N──> media_asset_usage

inquiries (Submissions)
career_applications (Submissions + Private Storage CV reference)
job_openings

admin_profiles ──1:N──> audit_logs
```

---

## 2. Core CMS Tables

### Table: `site_settings`
Global website configurations and contact coordinates.
- `id` (UUID, Primary Key, Default: `gen_random_uuid()`)
- `site_title` (TEXT, Default: `'Dhaka Heights Properties Limited'`)
- `tagline` (TEXT, Default: `'YOUR PRESTIGIOUS LIVING'`)
- `company_name` (TEXT, Default: `'Dhaka Heights Properties Limited'`)
- `founding_year` (INT, Default: `2008`)
- `primary_phone` (TEXT)
- `secondary_phone` (TEXT)
- `primary_email` (TEXT)
- `sales_email` (TEXT)
- `hr_email` (TEXT)
- `office_address` (TEXT)
- `map_iframe_url` (TEXT)
- `logo_asset_id` (UUID, FK -> `media_assets.id`, Nullable)
- `favicon_asset_id` (UUID, FK -> `media_assets.id`, Nullable)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `pages`
Public routes metadata and SEO.
- `id` (UUID, Primary Key)
- `slug` (TEXT, Unique, e.g. `'home'`, `'about'`, `'projects'`, `'career'`, `'contact'`)
- `title` (TEXT, Page title)
- `seo_meta_title` (TEXT)
- `seo_meta_description` (TEXT)
- `seo_canonical_url` (TEXT)
- `seo_og_image_id` (UUID, FK -> `media_assets.id`, Nullable)
- `is_published` (BOOLEAN, Default: `true`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `page_sections`
Sections belonging to pages.
- `id` (UUID, Primary Key)
- `page_id` (UUID, FK -> `pages.id` ON DELETE CASCADE)
- `section_key` (TEXT, e.g. `'hero_slider'`, `'about_preview'`, `'metrics'`, `'featured_projects'`)
- `section_name` (TEXT, Human-readable name)
- `tag_text` (TEXT, Optional section tag/badge)
- `heading` (TEXT)
- `subheading` (TEXT)
- `description` (TEXT)
- `allowed_variant` (TEXT, Default: `'default'`, e.g. `'light'`, `'dark'`, `'gold-accent'`)
- `sort_order` (INT, Default: `10`)
- `is_visible` (BOOLEAN, Default: `true`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `section_items`
Generic repeated content items within a section (e.g. Hero slides, metric stats, partner logos, accreditation cards).
- `id` (UUID, Primary Key)
- `section_id` (UUID, FK -> `page_sections.id` ON DELETE CASCADE)
- `title` (TEXT)
- `subtitle` (TEXT)
- `body_text` (TEXT)
- `tag_text` (TEXT)
- `primary_cta_label` (TEXT)
- `primary_cta_url` (TEXT)
- `secondary_cta_label` (TEXT)
- `secondary_cta_url` (TEXT)
- `icon_library` (TEXT, Default: `'lucide'`)
- `icon_key` (TEXT, e.g. `'building'`, `'university'`)
- `custom_icon_asset_id` (UUID, FK -> `media_assets.id`, Nullable)
- `image_asset_id` (UUID, FK -> `media_assets.id`, Nullable)
- `accent_color` (TEXT, Hex/RGB string)
- `sort_order` (INT, Default: `10`)
- `is_visible` (BOOLEAN, Default: `true`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `navigation_items` & `footer_links`
Navigation menus and footer links.
- `id` (UUID, Primary Key)
- `parent_id` (UUID, FK -> `navigation_items.id`, Nullable for dropdowns)
- `label` (TEXT)
- `url` (TEXT)
- `target` (TEXT, Default: `'_self'`)
- `sort_order` (INT, Default: `10`)
- `is_visible` (BOOLEAN, Default: `true`)

---

## 3. Domain Entity Tables

### Table: `projects` (Canonical Project Records)
- `id` (UUID, Primary Key)
- `slug` (TEXT, Unique, e.g. `'dhaka-heights-ariana-lofts'`)
- `name` (TEXT)
- `tagline` (TEXT)
- `category` (TEXT, Enum: `'ongoing'`, `'completed'`, `'upcoming'`)
- `badge_text` (TEXT, e.g. `'Ongoing'`, `'Completed'`, `'Upcoming'`)
- `location_address` (TEXT)
- `city_zone` (TEXT, e.g. `'Bashundhara R/A'`, `'Gulshan-2'`, `'Jolshiri Abashon'`)
- `size_summary` (TEXT, e.g. `'2400 SFT Available'`)
- `project_type` (TEXT, e.g. `'Luxury Residential Lofts'`)
- `floor_structure` (TEXT, e.g. `'G + 9 Residential Floors'`)
- `parking_summary` (TEXT)
- `elevator_summary` (TEXT)
- `power_summary` (TEXT)
- `description_short` (TEXT)
- `description_full` (TEXT)
- `cover_image_id` (UUID, FK -> `media_assets.id`, Nullable)
- `map_iframe_url` (TEXT)
- `concern_id` (UUID, FK -> `concerns.id`, Nullable)
- `status` (TEXT, Default: `'published'`, Enum: `'draft'`, `'published'`, `'archived'`)
- `sort_order` (INT, Default: `10`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)
- `updated_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `project_features` & `project_amenities` & `project_floor_plans` & `project_gallery`
- `project_features`: (`project_id`, `feature_title`, `icon_key`, `sort_order`)
- `project_amenities`: (`project_id`, `amenity_title`, `icon_key`, `sort_order`)
- `project_floor_plans`: (`project_id`, `title`, `unit_size`, `image_asset_id`, `sort_order`)
- `project_gallery`: (`project_id`, `image_asset_id`, `caption`, `sort_order`)

### Table: `concerns` (Sister Subsidiaries)
- `id` (UUID, Primary Key)
- `slug` (TEXT, Unique, e.g. `'dhaka-heights-developments-limited'`)
- `name` (TEXT)
- `subtitle` (TEXT)
- `overview` (TEXT)
- `cover_image_id` (UUID, FK -> `media_assets.id`, Nullable)
- `logo_image_id` (UUID, FK -> `media_assets.id`, Nullable)
- `features_list` (JSONB, Array of feature bullet points)
- `status` (TEXT, Default: `'published'`)
- `sort_order` (INT, Default: `10`)

### Table: `media_posts` (Blogs, News & Press Releases)
- `id` (UUID, Primary Key)
- `slug` (TEXT, Unique)
- `title` (TEXT)
- `category` (TEXT, e.g. `'Latest News'`, `'Blogs & Articles'`)
- `published_date` (DATE)
- `excerpt` (TEXT)
- `content_body` (TEXT)
- `cover_image_id` (UUID, FK -> `media_assets.id`, Nullable)
- `is_featured` (BOOLEAN, Default: `false`)
- `status` (TEXT, Default: `'published'`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `job_openings` (Career Vacancies)
- `id` (UUID, Primary Key)
- `title` (TEXT)
- `department` (TEXT)
- `location` (TEXT, Default: `'Dhaka, Bangladesh'`)
- `job_type` (TEXT, Default: `'Full-Time'`)
- `experience_required` (TEXT)
- `closing_date` (DATE)
- `description` (TEXT)
- `responsibilities` (JSONB, Array of strings)
- `requirements` (JSONB, Array of strings)
- `is_active` (BOOLEAN, Default: `true`)

---

## 4. Relational Placement Tables (No Duplication)

### Table: `section_entity_selections`
Associates a page section with a list of selected domain entities.
- `id` (UUID, Primary Key)
- `section_id` (UUID, FK -> `page_sections.id` ON DELETE CASCADE)
- `entity_type` (TEXT, Enum: `'project'`, `'concern'`, `'media_post'`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `section_entity_selection_items`
Individual entity selection items within a section placement with optional display overrides.
- `id` (UUID, Primary Key)
- `selection_id` (UUID, FK -> `section_entity_selections.id` ON DELETE CASCADE)
- `project_id` (UUID, FK -> `projects.id`, Nullable)
- `concern_id` (UUID, FK -> `concerns.id`, Nullable)
- `media_post_id` (UUID, FK -> `media_posts.id`, Nullable)
- `override_title` (TEXT, Nullable — Optional display title override)
- `override_description` (TEXT, Nullable — Optional display description override)
- `override_cover_image_id` (UUID, FK -> `media_assets.id`, Nullable)
- `override_cta_label` (TEXT, Nullable)
- `sort_order` (INT, Default: `10`)
- `is_visible` (BOOLEAN, Default: `true`)

---

## 5. Submissions & Media Infrastructure

### Table: `media_assets` (Cloudinary Registry)
- `id` (UUID, Primary Key)
- `public_id` (TEXT, Unique, Cloudinary public ID, e.g. `dhaka-heights/dev/projects/ariana/cover`)
- `secure_url` (TEXT, Full HTTPS URL)
- `resource_type` (TEXT, `'image'`, `'video'`, `'raw'`)
- `format` (TEXT, e.g. `'webp'`, `'png'`, `'jpg'`)
- `width` (INT)
- `height` (INT)
- `bytes` (INT)
- `original_filename` (TEXT)
- `display_name` (TEXT)
- `folder` (TEXT, e.g. `dhaka-heights/dev/projects/ariana`)
- `alt_text` (TEXT)
- `caption` (TEXT)
- `tags` (ARRAY of TEXT)
- `uploaded_by` (UUID, FK -> `admin_profiles.id`, Nullable)
- `is_archived` (BOOLEAN, Default: `false`)
- `created_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `inquiries` (Contact & Lead Submissions)
- `id` (UUID, Primary Key)
- `submission_type` (TEXT, Enum: `'contact'`, `'project_inquiry'`, `'callback_request'`, `'layout_request'`)
- `full_name` (TEXT)
- `email` (TEXT)
- `phone` (TEXT)
- `subject` (TEXT, Nullable)
- `project_id` (UUID, FK -> `projects.id`, Nullable)
- `message` (TEXT)
- `status` (TEXT, Default: `'new'`, Enum: `'new'`, `'contacted'`, `'qualified'`, `'closed'`, `'spam'`)
- `admin_notes` (TEXT)
- `assigned_to` (UUID, FK -> `admin_profiles.id`, Nullable)
- `created_at` (TIMESTAMPTZ, Default: `now()`)

### Table: `career_applications` (Applicant Submissions)
- `id` (UUID, Primary Key)
- `job_opening_id` (UUID, FK -> `job_openings.id`, Nullable)
- `full_name` (TEXT)
- `email` (TEXT)
- `phone` (TEXT)
- `cover_letter` (TEXT)
- `resume_storage_path` (TEXT, Private Supabase Storage path in bucket `career-resumes`, e.g. `resumes/2026/07/applicant_123.pdf`)
- `resume_original_filename` (TEXT)
- `status` (TEXT, Default: `'new'`, Enum: `'new'`, `'reviewing'`, `'shortlisted'`, `'interviewed'`, `'rejected'`, `'hired'`)
- `admin_notes` (TEXT)
- `created_at` (TIMESTAMPTZ, Default: `now()`)

---

## 6. Security, RLS & Storage Specifications

### Row Level Security (RLS) Rules:
1. **Public Read-Only**: `pages`, `page_sections`, `section_items`, `projects`, `concerns`, `media_posts`, `job_openings`, `site_settings`, `navigation_items`, `footer_links` are publicly readable **ONLY IF** `is_published = true` / `status = 'published'` / `is_visible = true`.
2. **Public Submission Writes**: Anonymous public users may `INSERT` into `inquiries` and `career_applications`. Anonymous users can **NEVER** `SELECT`, `UPDATE`, or `DELETE` inquiries or applications.
3. **Private Applicant Resumes**:
   - Supabase Storage Bucket: `career-resumes` (Private, public access disabled).
   - Read/Download access restricted strictly to authenticated admin users with role `super_admin` or `hr_manager` via short-lived signed URLs (valid 60 minutes).
4. **Admin Operations**: Authenticated admins have full CRUD permissions on CMS tables governed by `admin_profiles.role` (`super_admin`, `content_editor`, `sales_manager`, `hr_manager`).

### Table: `admin_profiles` & `audit_logs`
- `admin_profiles`: (`id` [matches `auth.users.id`], `full_name`, `email`, `role` [`super_admin`, `content_editor`, `sales_manager`, `hr_manager`], `is_active`)
- `audit_logs`: (`id`, `admin_id`, `action` [`CREATE`, `UPDATE`, `DELETE`, `PUBLISH`], `table_name`, `record_id`, `old_values` [JSONB], `new_values` [JSONB], `timestamp`)
