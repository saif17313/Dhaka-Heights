# Backend & Database Binding Map

## Overview
This document details how admin navigation, CMS sections, operational modules, and media management bind to the Supabase PostgreSQL database and Cloudinary storage services.

---

## 1. Supabase Database Tables Binding

| Admin Feature / Domain | Primary Supabase Table | Relational Foreign Keys / Joins | Client Helper |
|---|---|---|---|
| Public Pages Directory | `pages` | `seo_og_image_id` ➔ `media_assets(id)` | `@/lib/supabase/client` |
| Page Sections Editor | `page_sections` | `page_id` ➔ `pages(id)` | `@/lib/supabase/client` |
| Section Item Repeaters | `section_items` | `section_id` ➔ `page_sections(id)`, `image_asset_id` ➔ `media_assets(id)` | `@/lib/supabase/client` |
| Relational Selections | `section_entity_selections` & `items` | `project_id`, `concern_id`, `media_post_id` | `@/lib/supabase/client` |
| Real Estate Projects | `projects` | `cover_image_id` ➔ `media_assets(id)` | `@/lib/supabase/client` |
| Sister Concerns | `concerns` | `cover_image_id`, `logo_image_id` | `@/lib/supabase/client` |
| Media & Articles | `media_posts` | `cover_image_id` ➔ `media_assets(id)` | `@/lib/supabase/client` |
| Careers & Applications | `job_openings` & `career_applications` | `job_opening_id` ➔ `job_openings(id)` | `@/lib/supabase/client` & `/api/admin/career/resume-link` |
| Customer Inquiries | `inquiries` | `project_id` ➔ `projects(id)` | `@/lib/supabase/client` & `/api/submissions/*` |
| Site Settings | `site_settings` | `logo_asset_id`, `favicon_asset_id` | `@/lib/supabase/client` |
| Audit Trail Logs | `audit_logs` | RLS Protected system log | `@/lib/supabase/client` |

---

## 2. Cloudinary Media Storage Binding
- **Upload Endpoint**: `/api/admin/cloudinary-sign` (Generates signed SHA-256 upload signature for secure direct browser-to-Cloudinary upload).
- **Media Asset Registry**: `/api/admin/media` inserts uploaded image metadata (public_id, url, format, width, height, bytes) into Supabase `media_assets` table.
- **Media Selector Component**: [`src/components/admin/MediaLibrary.js`](file:///d:/Projects/Dhaka-Heights/Dhaka-Heights/website/src/components/admin/MediaLibrary.js) provides an inline picker modal for picking Cloudinary assets in any section or project form.

---

## 3. Private CV Storage Bucket
- **Storage Bucket**: `career-resumes` (Supabase Storage, `public = false`).
- **Download Link Endpoint**: `/api/admin/career/resume-link` (Generates a 60-second signed URL for authorized HR Manager / Super Admin preview).
