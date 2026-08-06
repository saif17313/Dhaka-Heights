# Dhaka Heights — Route and Section Inventory Map

> **Status correction - 2026-08-02:** This file is an inventory, not proof that every route is dynamically bound. Home and its global shell, About, Projects, Concerns, Media Center, Career, and Contact are implemented, migrated, and authenticated-runtime verified.

This document details every public route, every component section on that route, its hardcoded data sources, dynamic fields to be managed, and corresponding admin menu mapping.

---

## 1. Global / Layout Components

### Component: `Navbar.js`
- **Route Scope**: Rendered on all pages
- **Source File**: `src/components/Navbar.js`
- **Hardcoded Fields**:
  - Logo (`/assets/logo.svg`, Alt text)
  - Phone number (`+88 01928 222 777`)
  - Email (`info@dhakaheights.com`)
  - Primary Navigation Links (`Home`, `About`, `Concern` [dropdown with 8 items], `Projects` [dropdown with filters], `Media`, `Career`, `Contact`)
- **Dynamic Fields**: Logo asset, contact phone/email, navigation items, dropdown menu items, CTA button text/url.
- **Admin Menu Mapping**: `Admin -> Navigation -> Header Navbar`
- **Database Mapping**: `navigation_items`, `site_settings`

### Component: `Footer.js`
- **Route Scope**: Rendered on all pages
- **Source File**: `src/components/Footer.js`
- **Hardcoded Fields**:
  - Brand summary text, corporate logo
  - Corporate Office Address (`House 14, Road 03, Block I, Bashundhara R/A, Dhaka`)
  - Phone numbers (`+880 1928-222777`, `+880 1711-000000`)
  - Email addresses (`info@dhakaheights.com`, `sales@dhakaheights.com`)
  - Quick Links list
  - Sister Concerns footer links
  - Social Links (Facebook, LinkedIn, YouTube, Instagram)
  - Copyright text (`© 2026 Dhaka Heights Properties Limited. All Rights Reserved.`)
- **Dynamic Fields**: Footer groups, link items, contact coordinates, social channels, copyright note.
- **Admin Menu Mapping**: `Admin -> Navigation -> Footer`
- **Database Mapping**: `footer_groups`, `footer_links`, `social_links`, `site_settings`

---

## 2. Route: `/` (Homepage)
- **Source File**: `src/app/page.js`

### Section 1: Preloader
- **Source Component**: Inline inside `page.js`
- **Dynamic Fields**: Logo image, title text (`DHAKA HEIGHTS PROPERTIES LIMITED`), subtitle text (`YOUR PRESTIGIOUS LIVING`).
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> Preloader`

### Section 2: Hero Banner Slider
- **Source Component**: `src/components/HeroSlider.js`
- **Dynamic Fields**: Array of slides (Tag, Title, Description, Background Image, Action Button Text, Action Link URL).
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> Hero Slider`
- **Database Mapping**: `page_sections` -> `section_items`

### Section 3: About Corporate Block
- **Source Component**: `src/components/AboutSection.js`
- **Dynamic Fields**: Section Tag, Headline, Lead Paragraph, Body Paragraph, Primary CTA Text & URL, Video Play Button Text, Top Facade Image, Bottom Interior Image.
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> About Preview`

### Section 4: Metric Stats Banner
- **Source Component**: `src/components/Metrics.js`
- **Dynamic Fields**: Array of 4 metric cards (Number/Stat, Label, Subtext/Description).
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> Metrics`

### Section 5: Properties Showcase (Featured Projects)
- **Source Component**: `src/components/ProjectsGrid.js`
- **Dynamic Fields**: Section Tag, Section Title, Filter Tabs (`all`, `ongoing`, `completed`, `upcoming`), Relational Selection of Projects to feature, items per page setting.
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> Featured Projects`
- **Database Mapping**: `section_entity_selections` -> `projects`

### Section 6: Commitment Quote
- **Source Component**: `src/components/CommitmentQuote.js`
- **Dynamic Fields**: Quote Text, Attribution, Section Visibility.
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> Commitment Quote`
- **Database Mapping**: versioned `page_sections` record with key `commitment-quote`

### Section 7: Media Press Highlights
- **Source Component**: `src/components/MediaGrid.js`
- **Dynamic Fields**: Section Tag, Section Title, View All CTA, and ordered canonical media-post placements with Home-scoped category, summary, cover, and CTA overrides.
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> Media Highlights`
- **Database Mapping**: versioned `page_sections` -> `section_entity_selections` -> canonical `media_posts` and `media_assets`
- **Database Mapping**: `section_entity_selections` -> `media_posts`

### Section 8: Tenants & Partners Carousel
- **Source Component**: `src/components/PartnersCarousel.js`
- **Dynamic Fields**: Section Title and ordered partner records (Partner Name, Category, Font Awesome Icon Key, Accent Color, Visibility). Eight canonical records are stored; the second marquee loop is derived at render time.
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> Partners Carousel`
- **Database Mapping**: versioned `page_sections` -> `section_items`

### Section 9: Interactive Contact & Map
- **Source Component**: `src/components/ContactForm.js`
- **Dynamic Fields**: Section tag, heading, introduction, ordered contact details/icons, mock-map labels, form introduction, field labels, validation messages, ordered space options, submit/loading text, and success copy.
- **Admin Menu Mapping**: `Admin -> Website Content -> Home -> Contact Section`
- **Database Mapping**: versioned `page_sections` -> `section_items`; operational submissions -> `inquiries`

---

## 3. Route: `/about` (About Us Page)
- **Source File**: `src/app/about/page.js`

### Section 1: Hero Banner
- **Dynamic Fields**: Page Title (`ABOUT US`), Subtitle (`VALUE BREEDS VOLUME`), Background Image.
- **Admin Menu Mapping**: `Admin -> Website Content -> About -> Hero Banner`

### Section 2: Corporate Overview
- **Dynamic Fields**: Section Tag, Headline, Paragraphs (3 text blocks), Overlapping Images (Back Image, Front Image).
- **Admin Menu Mapping**: `Admin -> Website Content -> About -> Corporate Overview`

### Section 3: Brand Pillars (Mission, Promise, Vision)
- **Dynamic Fields**: Array of 3 Pillar Cards (Icon, Title, Description, Background Image).
- **Admin Menu Mapping**: `Admin -> Website Content -> About -> Brand Pillars`

### Section 4: Green Living & Sustainability
- **Dynamic Fields**: Section Tag, Headline, Paragraphs, Quote text, Quote Author, Feature Image.
- **Admin Menu Mapping**: `Admin -> Website Content -> About -> Sustainability`

### Section 5: Leadership Message
- **Dynamic Fields**: Section Tag, Quote text (2 paragraphs), Leader Name (`Md. Shahadat Hossain`), Designation.
- **Admin Menu Mapping**: `Admin -> Website Content -> About -> Leadership Message`

### Section 6: Sister Concerns Grid
- **Dynamic Fields**: Section Tag, Title, Relational Selection of Concern Subsidiaries.
- **Admin Menu Mapping**: `Admin -> Website Content -> About -> Subsidiaries Grid`
- **Database Mapping**: `section_entity_selections` -> `concerns`

### Section 7: Accreditations & Certifications
- **Dynamic Fields**: Section Tag, Title, Array of Accreditation Cards (Icon, Title).
- **Admin Menu Mapping**: `Admin -> Website Content -> About -> Accreditations`

---

## 4. Route: `/projects` (Properties Listing Page)
- **Source File**: `src/app/projects/page.js`

### Section 1: Page Hero
- **Dynamic Fields**: Title (`OUR PROJECTS`), Subtitle (`EXCLUSIVE REAL ESTATE DEVELOPMENTS`), Background Image.

### Section 2: Projects Grid & Filtering
- **Dynamic Fields**: Search query handler, Category Filter Buttons, Relational query to canonical `projects` table (sorted by `sort_order`).

---

## 5. Route: `/project/[id]` (Project Detail Page)
- **Source File**: `src/app/project/[id]/page.js`

### Sections:
1. **Project Hero & Header**: Name, Category Badge, Location, Tagline, Cover Image.
2. **Key Specs Bar**: Size, Floor Structure, Units, Elevator count, Generator backup.
3. **Overview & Narrative**: Detailed project description, vision, architectural highlights.
4. **Project Features**: Array of Feature Icons & Labels (e.g. Smart Security, Earthquake Resistance, Double Glazing).
5. **Project Amenities**: Array of Amenities (Gym, Rooftop Garden, Swimming Pool, Community Hall).
6. **Gallery Grid**: Array of high-resolution project images (Cloudinary assets).
7. **Floor Plans**: Array of floor plan images with unit sizes and titles.
8. **Project Location & Map**: Location description, Google Map embed URL.
9. **Inquiry CTA & Form**: Direct layout PDF request button & Project Inquiry form.
10. **Related Projects**: Relational recommendation of 3 other projects.

---

## 6. Route: `/concern/[slug]` (Sister Concern Detail Page)
- **Source File**: `src/app/concern/[slug]/page.js`

### Sections:
1. **Page Header**: Concern Name, Subtitle, Breadcrumbs, Cover Image.
2. **Overview Section**: Profile text, Key Highlights list, Interactive 3D Overview Image.
3. **Specialized Services Grid**: Array of Services (Icon, Title, Description).
4. **Featured Portfolio**: Relational list of projects developed under this concern.

---

## 7. Route: `/media-center` & `/media-center/[slug]`
- **Source Files**: `src/app/media-center/page.js`, `src/app/media-center/[slug]/page.js`
- **Verified Phase 5 source**: published versioned `page_sections.settings` (`section_key = media-page`) with stable canonical `media_posts` synchronization and relational Cloudinary assets.
- **Admin workflow**: `/admin/articles`; saved-version preview at `/admin-preview/media-page`.

### Sections:
1. **Media Center Hero**: Title, Subtitle, Background.
2. **Featured Post Banner**: Featured article cover image, title, date, excerpt, link.
3. **Articles Grid**: Filter tabs (`All`, `Latest News`, `Blogs & Articles`), Paginated Cards.
4. **Article Detail Page**: Title, Category, Date, Cover Image, Rich Content paragraphs, Share Buttons, Related Posts.

---

## 8. Route: `/career` (Career Page)
- **Source File**: `src/app/career/page.js`
- **Verified Phase 6 source**: published versioned `page_sections.settings` (`section_key = career-page`) with canonical `job_openings`, relational Cloudinary media, and private `career_applications`/resume storage.
- **Admin workflow**: `/admin/careers` and `/admin/pages/career`; protected saved preview at `/admin-preview/career-page`; HR application workflow at `/admin/careers/applications`.

### Sections:
1. **Career Hero**: Title (`JOIN OUR TEAM`), Subtitle, Background Image.
2. **Work Culture / Why Join Us**: 3 Benefit cards (Icon, Title, Text).
3. **Open Vacancies List**: Job Cards (Job Title, Department, Location, Job Type, Experience Required, Deadline, Job Description, Responsibilities, Requirements).
4. **Application Form**: Name, Email, Phone, Applying For (Position select), Covered Letter text, Resume PDF file upload.

---

## 9. Route: `/contact` (Contact Us Page)
- **Source File**: `src/app/contact/page.js`
- **Verified Phase 7 source**: published versioned `page_sections.settings` (`section_key = contact-page`) with server-validated persistence to `inquiries`.
- **Admin workflow**: `/admin/pages/contact`; protected saved preview at `/admin-preview/contact-page`; private sales workflow at `/admin/inquiries`.

### Sections:
1. **Contact Hero**: Title (`CONTACT US`), Subtitle, Background Image.
2. **Contact Info Cards**: Office Address, Call Center numbers, Email coordinates, Working Hours.
3. **Interactive Form**: Full Name, Email, Phone, Subject, Interested Project/Concern, Message.
4. **Map Embed**: Interactive Google Map iFrame.
