# Fix 03 — Team Seed, Image Lightbox, Location and Scroll-to-Top Refinement

## Purpose

This patch completes the requested refinements without changing the existing project structure, visual system, API configuration, Supabase credentials, Cloudinary credentials, routes, or unrelated functionality.

## Changes

### 1. Scroll-to-top button

- Forces a transparent, glass-like circular appearance so the previous navy background cannot override it.
- Preserves the existing bottom-left placement and smooth-scroll behavior.
- Adds a subtle periodic halo and upward arrow nudge after the button appears.
- Respects `prefers-reduced-motion`.

### 2. Initial dynamic About team data

- Seeds one initial visible team record only when the About section has no team members.
- Uses the name already present in the published leadership message: **Md. Shahadat Hossain**.
- Uses the non-title designation **Leadership** because the existing site content does not state a formal corporate title.
- Adds a branded monogram placeholder portrait at `/assets/team/md-shahadat-hossain.svg`.
- The portrait, name, designation, biography, visibility, order and record itself remain editable from the existing About Team admin editor.
- Existing team records are never overwritten or duplicated.

### 3. Dynamic ordering

The Fix 02 About Team editor already includes Move Up, Move Down, Add, Edit, Delete and Show/Hide controls. This patch keeps that implementation and supplies initial database content so the section appears immediately after migration.

### 4. Global static-image lightbox

- Adds one reusable client component at the root layout.
- Static public-page images inside `<main>` can be clicked or tapped to open a full-screen floating preview.
- Click the enlarged image, click outside it, use the close control, or press Escape to close.
- Images already used as links or buttons are excluded so project cards, team cards, thumbnails and navigation behavior are not intercepted.
- Admin and admin-preview routes are excluded.

### 5. Corporate location

The provided Google Maps link resolves to Dhaka Heights Properties Ltd. at coordinates:

- Latitude: `23.8137067`
- Longitude: `90.428437`

The migration updates current draft and published data to:

- Address: `142, Road-5, Block-B, Bashundhara R/A, Dhaka-1229, Bangladesh.`
- Embed URL: `https://www.google.com/maps?q=23.8137067,90.428437&z=17&output=embed`

Updated database content:

- Contact page map
- Contact page Corporate Office card
- Contact admin preview and public view through the shared Contact data
- Global footer address
- Mobile drawer address
- `site_settings.office_address`
- `site_settings.map_iframe_url`

## Files modified

- `website/src/app/layout.js`
- `website/src/components/ScrollToTop.js`
- `website/src/app/globals.css` — scoped Fix 03 block appended

## Files added

- `website/src/components/GlobalImageLightbox.js`
- `website/public/assets/team/md-shahadat-hossain.svg`
- `supabase/migrations/20260805000019_team_seed_location_update.sql`
- `docs/fixes/FIX-03-TEAM-LIGHTBOX-LOCATION-SCROLL-TOP.md`

## Intentionally unchanged

- Existing page structure and nested `website/` directory
- Navbar, footer and About layouts outside the requested changes
- Existing Team CRUD and ordering implementation
- Supabase/Cloudinary environment variables and secrets
- Project data, project filters and unrelated database records
- Existing routes and API handlers

## Suggested commit message

`fix: refine scroll button, seed team, add image lightbox and update location`
