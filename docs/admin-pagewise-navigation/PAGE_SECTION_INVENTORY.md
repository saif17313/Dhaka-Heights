# Page & Section Database Inventory

## Overview
This inventory audits all public pages, page section keys, schema field structures, and relational database dependencies currently stored in Supabase PostgreSQL tables.

---

## 1. Public Page Records (`pages` table)

| ID / Slug | Title | Route Path | Published State | Sections Count |
|---|---|---|---|---|
| `home` | Homepage | `/` | Published (`true`) | 8 |
| `about` | About Us | `/about` | Published (`true`) | 4 |
| `projects` | Real Estate Projects Portfolio | `/projects` | Published (`true`) | 3 |
| `concern` | Sister Concerns | `/concern` | Published (`true`) | 2 |
| `media-center` | Media & Articles Center | `/media-center` | Published (`true`) | 3 |
| `career` | Career Opportunities | `/career` | Published (`true`) | 3 |
| `contact` | Contact Us | `/contact` | Published (`true`) | 2 |

---

## 2. Page Sections Inventory (`page_sections` & `section_items` tables)

### Homepage (`pages.slug = 'home'`)
1. **`hero` (Hero Slider & Banners)**:
   - *Fields*: `heading`, `subheading`, `description`, `tag_text`, `image_asset_id`, `primary_cta_label`, `primary_cta_url`, `secondary_cta_label`, `secondary_cta_url`
   - *Items*: Repeater slides list (`section_items`)
2. **`overview` (Corporate Overview)**:
   - *Fields*: `heading`, `subheading`, `description`, `tag_text`
3. **`about-summary` (About Block)**:
   - *Fields*: `heading`, `description`, `image_asset_id`
4. **`featured-projects` (Featured Real Estate Portfolio)**:
   - *Entity Selection*: Relational selections from `projects` table (`section_entity_selections`)
5. **`sister-concerns-summary` (Subsidiaries Highlights)**:
   - *Entity Selection*: Relational selections from `concerns` table
6. **`metrics-stats` (Corporate Stats Banner)**:
   - *Fields*: Repeater metric items (`section_items`)
7. **`media-highlights` (Press & News Highlights)**:
   - *Entity Selection*: Relational selections from `media_posts` table
8. **`contact-cta` (Contact CTA Banner)**:
   - *Fields*: `heading`, `subheading`, `primary_cta_label`, `primary_cta_url`

---

## 3. Schema Field Types Supported
- **Text**: `title`, `heading`, `subheading`, `tag_text`, `primary_cta_label`, `primary_cta_url`
- **Textarea / Rich Text**: `description`, `body_text`, `content_body`
- **Media Reference**: `image_asset_id`, `custom_icon_asset_id`, `cover_image_id` (Cloudinary signed URL / Supabase Asset ID)
- **Entity Selection**: `project_id`, `concern_id`, `media_post_id` (Relational selection overrides without duplicating canonical records)
- **Control / Meta**: `sort_order`, `is_visible`, `status` (`draft` / `published`)
