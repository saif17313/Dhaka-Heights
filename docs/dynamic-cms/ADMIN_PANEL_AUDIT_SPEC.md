# Dhaka Heights CMS — Admin Panel Audit & AI Redesign Specification

> **Document Version**: 2.0.0  
> **Target Audience**: AI Implementation Agents / UI/UX Lead Architects / Full-Stack Developers  
> **Project Context**: Dhaka Heights Properties Limited Executive CMS Control Portal  

---

## 1. Executive Summary & Purpose

This document provides a **complete, exhaustive audit and technical specification** of the Dhaka Heights Administration Portal (`/admin`). It documents every route, navigation structure, data schema, content component, interactive feature, API integration, and design guideline.

If you are an AI model or developer tasked with redesigning the admin portal, this document contains **100% of the functional, technical, and structural requirements** needed to build a modern, high-grade, visually stunning interface.

---

## 2. Technical Stack & Cloud Architecture

- **Framework**: Next.js 16.2.10 (App Router, Turbopack)
- **UI Library**: React 19.2.4 + Vanilla CSS + Tailwind CSS v4 (`@import "tailwindcss";`)
- **Database**: Supabase PostgreSQL (23 relational tables with Row Level Security policies)
- **Public Storage**: Cloudinary SDK v2 (Target Cloud Folder: `dhaka-heights/dev`)
- **Private Storage**: Supabase Private Bucket `career-resumes` (PDF/DOC/DOCX up to 10MB, restricted HR access via 60-min signed URLs)
- **Icons**: FontAwesome 6.4.0 (`fa-solid`, `fa-brands`) + Lucide React + Custom Cloudinary SVGs
- **Typography Tokens**:
  - **Headings**: `Playfair Display`, Georgia, serif
  - **Body**: `Manrope`, `Inter`, sans-serif
  - **Monospace**: `ui-monospace`, `SFMono-Regular`, monospace
- **Color Palette Tokens**:
  - **Primary Navy**: `#0B1B3D`
  - **Secondary Navy**: `#051026`
  - **Accent Gold**: `#C5A880`
  - **Secondary Gold**: `#B59410` / `#8A6D0F`
  - **Background Light**: `#F8FAFC`
  - **Card Light**: `#FFFFFF` (Shadows: `0 10px 30px rgba(11,27,61,0.06)`, Borders: `1px solid #E2E8F0`)

---

## 3. Complete Navigation & Route Inventory

The admin portal features **13 dedicated administrative routes**:

| # | Route Path | Menu Label | Icon Class | Primary Function / Scope |
|---|---|---|---|---|
| 1 | `/admin/login` | Standalone Login | `fa-building-user` | Unauthenticated login portal & Dev Mode bypass |
| 2 | `/admin` | Executive Dashboard | `fa-gauge-high` | High-level metrics, quick actions & system health |
| 3 | `/admin/pages` | Pages & Layout Sections | `fa-layer-group` | Manage page layouts, section reordering & live previews |
| 4 | `/admin/projects` | Real Estate Projects | `fa-building-user` | CRUD management for 10 properties & media picker |
| 5 | `/admin/concerns` | Sister Concerns | `fa-briefcase` | CRUD management for 8 corporate subsidiaries |
| 6 | `/admin/articles` | Media & Articles | `fa-newspaper` | News, press releases, blog posts & article editor |
| 7 | `/admin/careers` | Careers & Vacancies | `fa-user-tie` | Job openings & applicant CV signed PDF downloads |
| 8 | `/admin/inquiries` | Inquiries & Leads | `fa-inbox` | Customer contact messages & callback requests inbox |
| 9 | `/admin/navigation` | Navigation & Footer | `fa-sitemap` | Header main menu, footer groups & social channel links |
| 10 | `/admin/media` | Media Library | `fa-photo-film` | Central Cloudinary asset manager & icon picker |
| 11 | `/admin/settings` | Site Settings & SEO | `fa-sliders` | Global corporate contact info, coordinates & SEO tags |
| 12 | `/admin/users` | Users & Roles | `fa-users-gear` | RBAC role management (`super_admin`, `content_editor`, etc.) |
| 13 | `/admin/audit-logs` | Audit Log Trail | `fa-shield-halved` | System audit trail logs and historical content edits |

---

## 4. In-Depth Module Specifications & Feature Inventory

### Module 1: Standalone Login Portal (`/admin/login`)
- **Route**: `/admin/login`
- **Purpose**: Authenticate administrative users before granting access to `/admin`.
- **UI Components**:
  - Standalone layout (bypasses main `AdminSidebar` and `AdminHeader`).
  - Brand identity card with Playfair Display typography and gold accent badge.
  - Email & Password input form.
  - **"Sign In to Dashboard"** primary button.
  - **"⚡ Enter Admin Panel (Dev Mode)"** instant bypass button (sets `sb-dev-session` cookie).
- **Backend API / Auth**: Supabase Auth `signInWithPassword` + fallback dev cookie (`sb-dev-session=true`).

---

### Module 2: Executive Dashboard (`/admin`)
- **Route**: `/admin`
- **Purpose**: Executive overview of business metrics, cloud status, and quick module actions.
- **UI Components**:
  - **Hero Welcome Banner**: Live system date, welcome text, "+ Add New Project" CTA, and "Inquiries Inbox" CTA.
  - **3D Stat Cards Grid** (4-columns):
    1. *Real Estate Projects*: Total count `10` (`4 Ongoing`, `2 Upcoming`, `4 Completed`).
    2. *Customer Inquiries Inbox*: Total lead count `0` with real-time status.
    3. *Active Career Vacancies*: Active job count `2` (`Civil Engineering & Corporate Sales`).
    4. *Cloudinary Media Assets*: Total count `26` (`Folder: dhaka-heights/dev`).
  - **Management Control Modules Grid** (6 quick jump cards to Projects, Pages, Concerns, Careers, Inquiries, Media).
  - **Cloud Infrastructure Status Card**: Live status of Supabase Engine, Cloudinary SDK, and Private CV Bucket.
  - **Recent Activity Stream**: Log trail feed of recent database migrations, uploads, and publish events.

---

### Module 3: Website Pages & Layout Sections Editor (`/admin/pages`)
- **Route**: `/admin/pages`
- **Purpose**: Manage page-level layout configurations, section reordering, variants, and live preview.
- **Configured Public Pages**:
  1. *Homepage* (`/`) — 7 dynamic sections (Hero Slider, About Summary, Featured Projects, Concerns Grid, Why Choose Us, News Highlights, Contact CTA).
  2. *About Us* (`/about`) — 5 dynamic sections.
  3. *Projects Portfolio* (`/projects`) — 3 dynamic sections.
  4. *Sister Concerns* (`/concern/[slug]`) — 4 dynamic sections.
  5. *Media Center* (`/media-center`) — 4 dynamic sections.
  6. *Career Opportunities* (`/career`) — 4 dynamic sections.
  7. *Contact Us* (`/contact`) — 3 dynamic sections.
- **Interactive Features**:
  - **"Live Preview" Modal Trigger**: Opens `LivePreview.js` component with real-time viewport toggles (`Desktop 1440px`, `Tablet 1024px`, `Mobile 390px`) and Draft Preview overlay.
  - **"Edit Sections" Button**: Section title, subtitle, and layout variant editor.

---

### Module 4: Real Estate Projects CRUD (`/admin/projects`)
- **Route**: `/admin/projects`
- **Purpose**: Complete management of the company's real estate property portfolio.
- **Data Attributes Managed**:
  - Property Name (e.g. *Dhaka Heights Ariana Lofts*)
  - URL Slug (e.g. `dhaka-heights-ariana-lofts`)
  - Category (`ongoing`, `upcoming`, `completed`)
  - Badge Text (e.g. *Ongoing*, *Handed Over*, *Upcoming Launch*)
  - Project Type (e.g. *Luxury Residential Lofts*, *Elite Corporate Tower*)
  - Available Unit Size (e.g. *2400 SFT Available*, *4200 SFT Ready*)
  - Location Address (e.g. *Block-I, Road-15, Bashundhara R/A, Dhaka*)
  - Cover Image Asset (Integrated Media Library Modal picker)
  - Features & Specs List (e.g. *Double-height lobby*, *Auto-load generators*, *Earthquake resistant*)
- **Interactive Features**:
  - Filter by category (`All`, `Ongoing`, `Upcoming`, `Completed`).
  - Search by project name or location.
  - Add / Edit Project modal with image media selector.
  - Delete project action.
  - Status toggle (`Draft` / `Published`).

---

### Module 5: Sister Concerns Management (`/admin/concerns`)
- **Route**: `/admin/concerns`
- **Purpose**: Manage the 8 corporate subsidiary companies.
- **Subsidiaries Managed**:
  1. *Dhaka Heights Developments Limited* (`dhaka-heights-developments-limited`)
  2. *Dhaka Heights Construction Limited* (`dhaka-heights-construction-limited`)
  3. *Dhaka Heights Design & Interior* (`dhaka-heights-design-and-interior`)
  4. *Dhaka Heights Business Solution* (`dhaka-heights-business-solution`)
  5. *Dhaka Heights Global Limited* (`dhaka-heights-global-limited`)
  6. *Dhaka Heights Power Limited* (`dhaka-heights-power-limited`)
  7. *Dhaka Heights Maritime Limited* (`dhaka-heights-maritime-limited`)
  8. *Dhaka Heights Trading* (`dhaka-heights-trading`)
- **Data Attributes Managed**:
  - Subsidiary Name & Subtitle
  - Corporate Overview Paragraph
  - Key Service Capabilities (Icon, Title, Description)
  - Cover Image & Feature Highlights List

---

### Module 6: Media Posts & Articles (`/admin/articles`)
- **Route**: `/admin/articles`
- **Purpose**: Manage press releases, news highlights, and corporate blog posts.
- **Data Attributes Managed**:
  - Post Title & Slug
  - Category (`Press Release`, `Event`, `Award`, `Project Milestone`)
  - Featured Cover Image
  - Publication Date & Read Time
  - Full Article Body (Rich text / Markdown)
  - Status (`Draft` / `Published`)

---

### Module 7: Careers & Applicant CVs (`/admin/careers`)
- **Route**: `/admin/careers`
- **Purpose**: Manage active job vacancies and review incoming candidate applications.
- **Features**:
  - **Job Vacancies Manager**: Create/edit job openings (e.g. *Senior Structural Engineer*, *Corporate Sales Executive*).
  - **Applicant Applications Table**:
    - Candidate Name, Email, Phone, Position Applied For, Experience, Portfolio URL.
    - Application Status (`new`, `reviewing`, `shortlisted`, `rejected`).
    - **"Download CV (PDF)" Button**: Calls `/api/admin/career/resume-link` to generate a secure 60-minute signed URL to download private PDF resumes from Supabase bucket `career-resumes`.

---

### Module 8: Customer Inquiries Inbox (`/admin/inquiries`)
- **Route**: `/admin/inquiries`
- **Purpose**: Customer relationship lead inbox for website contact form entries and project callback requests.
- **Features**:
  - Lead Type Filter (`All`, `Contact Form`, `Project Callback`).
  - Inquiry Details: Name, Email, Phone, Selected Project, Message, Submission Timestamp.
  - Workflow Status Selector (`new`, `contacted`, `qualified`, `closed`, `spam`).

---

### Module 9: Navigation & Footer Editor (`/admin/navigation`)
- **Route**: `/admin/navigation`
- **Purpose**: Reorder header main menu links, footer link groups, and social media channels.
- **Features**:
  - Header Navigation Links Reordering.
  - Footer Column Groups (*Quick Links*, *Sister Concerns*, *Legal & Privacy*).
  - Social Media Links (*Facebook*, *LinkedIn*, *Instagram*, *YouTube*).

---

### Module 10: Central Media Library (`/admin/media`)
- **Route**: `/admin/media`
- **Purpose**: Central asset management interface connected to Cloudinary and Supabase `media_assets` table.
- **Features**:
  - Direct Cloudinary file upload (`dhaka-heights/dev` folder).
  - Asset Search & Tag Filtering (`images`, `logos`, `documents`).
  - Metadata Editor (Alt text, Caption, Tags).
  - **Deletion Safeguard**: Prevents deleting an asset if it is actively referenced in any project or section.
  - **Icon Picker Component**: Select from Lucide React icons or custom Cloudinary SVGs.

---

### Module 11: Site Settings & SEO Editor (`/admin/settings`)
- **Route**: `/admin/settings`
- **Purpose**: Update corporate contact coordinates, head office address, hotline numbers, and default meta tags.
- **Fields**:
  - Company Name, Brand Tagline, Founding Year
  - Primary Hotline, Sales Phone, Primary Email, Sales Email
  - Head Office Address & Google Maps Embed URL
  - Default OpenGraph Image URL & Meta Keywords

---

### Module 12: Admin Users & Roles (`/admin/users`)
- **Route**: `/admin/users`
- **Purpose**: Manage authorized administrative personnel and access roles.
- **Role Hierarchy (RBAC)**:
  - `super_admin`: Full system access, settings, role creation, and audit trail.
  - `content_editor`: Manage projects, concerns, pages, articles, and media.
  - `sales_manager`: Manage inquiries inbox and callback requests.
  - `hr_manager`: Manage career vacancies and applicant CV downloads.

---

### Module 13: System Audit Log Viewer (`/admin/audit-logs`)
- **Route**: `/admin/audit-logs`
- **Purpose**: Track administrative actions, content updates, status transitions, and private file downloads.
- **Fields**:
  - Action Type (e.g. `UPDATE_PROJECT`, `PUBLISH_PAGE`, `DOWNLOAD_RESUME`).
  - Entity Target ID & Table.
  - Performing Admin Email & Timestamp.

---

## 5. API Endpoints & Server Services Architecture

| Endpoint Path | Method | Function / Security Scope |
|---|---|---|
| `/api/admin/cloudinary-sign` | `POST` | Generates server-signed upload parameters for Cloudinary direct uploads |
| `/api/admin/media` | `GET`, `POST` | Fetches registered media assets / saves uploaded asset metadata |
| `/api/admin/media/[id]` | `PUT`, `DELETE` | Updates metadata / deletes asset with usage check safeguard |
| `/api/admin/publish` | `POST` | Atomic status update, revision snapshot & Next.js `revalidatePath` trigger |
| `/api/admin/career/resume-link` | `POST` | Generates 60-minute signed URL for HR CV download from `career-resumes` bucket |
| `/api/submissions/contact` | `POST` | Public contact form handler -> Supabase `inquiries` table |
| `/api/submissions/inquiry` | `POST` | Public project callback handler -> Supabase `inquiries` table |
| `/api/submissions/career` | `POST` | Public career application handler -> private PDF upload & `career_applications` table |

---

## 6. Database Schema Summary (23 Tables)

```
admin_profiles
media_assets ──< media_asset_usage
custom_icons
site_settings
pages ──< page_sections ──< section_items
navigation_items
footer_groups ──< footer_links
social_links
concerns
projects ──< project_features
         ├──< project_amenities
         ├──< project_floor_plans
         ├──< project_media
         └──< project_documents
media_posts
job_openings ──< career_applications
inquiries
section_entity_selections ──< section_entity_selection_items
audit_logs
content_revisions
```

---

## 7. Guidelines for AI Redesign Execution

If you are an AI model redesigned with building a new UI/UX for this admin portal:
1. **Preserve All Routes & Data Schemas**: Do not remove any of the 13 route endpoints, API interfaces, or database fields documented above.
2. **Follow Visual Aesthetics**:
   - Primary Theme: Crisp Light Executive Mode (`#F8FAFC` background, `#FFFFFF` cards, `#0B1B3D` typography).
   - Accents: Gold gradients (`#C5A880` to `#B59410`), soft borders (`#E2E8F0`), and emerald status badges.
   - Typography: Use `Playfair Display` for section titles/metric numbers and `Manrope` for UI text.
3. **Avoid Element Overlap**:
   - Ensure the left sidebar (`w-64`) is offset with `lg:pl-64`.
   - Maintain clear padding, clean grid breakpoints (`sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`), and smooth card hover states.
