# Fix 01 — Dynamic Project Filters and Partner Icon Uploads

Date: 2026-08-05  
Target structure: current nested Next.js application under `website/`

## Purpose

This fix changes only two requested CMS areas:

1. Projects page filter options become editable data instead of fixed source-code lists.
2. Home “Tenants & Partners” records can use either a Font Awesome icon key or an uploaded image/logo.

No environment file, API credential, Supabase project URL, Cloudinary credential, route structure, page layout, typography, colour system, or unrelated public component is changed.

## Implemented changes

### Projects filters

The Projects editor now supports add, edit, delete, and project linkage for:

- Status
- Category
- Location
- Size

Rules:

- Each group must contain 1–30 options.
- Keys are lowercase URL-safe identifiers, for example `luxury-hotel`.
- `all` is reserved and cannot be used as an option key.
- Key edits are applied explicitly and atomically; applying a valid unique key updates all draft projects linked to the previous key.
- Deleting an option asks for confirmation. Linked projects are reassigned to the first remaining option before deletion.
- Database validation rejects a project whose status/category/location/size does not exist in the same saved filter vocabulary.
- Unknown custom statuses retain the existing badge layout and use the existing navy colour as a safe visual fallback.

Default category options now include:

- Commercial Hub
- Residential Suites
- Mixed-Use
- Hotel
- Resorts

### Tenants & Partners icon source

Each partner now supports:

- `Font Awesome code`, preserving the existing behaviour; or
- `Uploaded icon / logo`, selected from the existing Cloudinary-backed Media Library.

Upload guidance shown in the editor:

- Square SVG or transparent PNG
- At least 96 × 96 pixels
- Public delivery is automatically transformed to `f_auto,q_auto,c_fit,w_96,h_96`
- The image is rendered inside the existing 34 × 34 icon area

The original uploaded asset remains in Cloudinary. Compression and resizing are applied at delivery time, which avoids destructive reprocessing and preserves the current media workflow.

### Carousel count correction

The carousel animation previously assumed exactly eight partner records. It now derives the animation distance from the actual visible record count while retaining the current card width, animation style, and duplicate-loop behaviour.

## Database migration

Migration:

`supabase/migrations/20260805000017_dynamic_project_filters_partner_icons.sql`

It:

- Backfills filter option data into all existing Projects page versions.
- Removes fixed project classification CHECK constraints.
- Replaces Projects payload validation with vocabulary-based validation.
- Extends Partners snapshot/save/publish RPCs for uploaded image icons.
- Verifies that custom icons reference active image records.
- Records custom icon usage in `media_asset_usage`.
- Preserves existing Font Awesome partner records without data conversion.

## Modified files

- `website/src/app/globals.css`
- `website/src/components/PartnersCarousel.js`
- `website/src/components/ProjectsGrid.js`
- `website/src/components/ProjectsPageClient.js`
- `website/src/components/admin/HomePartnersCarouselEditor.js`
- `website/src/components/admin/MediaLibrary.js`
- `website/src/components/admin/ProjectsPageEditor.js`
- `website/src/lib/homePartnersCarouselActions.js`
- `website/src/lib/homePartnersCarouselRepository.js`
- `website/src/lib/projectsPageActions.js`

## New files

- `website/src/lib/projectFilterOptions.js`
- `supabase/migrations/20260805000017_dynamic_project_filters_partner_icons.sql`
- `docs/fixes/FIX-01-DYNAMIC-PROJECT-FILTERS-PARTNER-ICONS.md`
- `docs/fixes/ADMIN-DYNAMIC-AUDIT-2026-08-05.md`

## Validation completed before packaging

- All changed JavaScript/JSX files passed TypeScript parser syntax validation.
- `globals.css` passed PostCSS parser validation.
- The apply/rollback PowerShell scripts were statically reviewed; PowerShell was not installed in the packaging environment, so they were not executed there.
- The patch was checked against the uploaded project baseline and contains no `.env` files or credentials.
- A complete Next.js build was not run in the packaging environment because project dependencies were not installed and the available package mirror did not provide all locked packages. The apply script runs the project build on the local machine unless `-SkipBuild` is supplied.

## Manual verification checklist

1. Open `/admin/pages/projects`.
2. Confirm Hotel and Resorts appear under Category options.
3. Add a temporary Category option and assign it to a project.
4. Rename its key and confirm the linked project remains assigned.
5. Delete it and confirm the reassignment warning appears.
6. Save Draft, open Saved Preview, and test all four filters.
7. Publish only after the preview is correct.
8. Open `/admin/pages/home/sections/partners-carousel`.
9. Keep one partner on Font Awesome and confirm its preview is unchanged.
10. Switch another partner to Uploaded icon / logo.
11. Upload/select a square image, save the draft, and verify the local preview.
12. Publish and verify the public Home carousel at desktop and mobile widths.
13. Confirm existing Supabase, Cloudinary, inquiry, navigation, and project detail behaviour remains operational.

## Rollback behaviour

`rollback-fix.ps1` restores only source/documentation files from the latest Fix 01 backup. It does not reverse the applied database migration automatically. The migration is backward-compatible with the previous source because existing fields remain and Font Awesome records continue to work.

## Suggested commit message

`feat(admin): add dynamic project filters and partner icon uploads`
