# Dhaka Heights — Admin Dynamic Content Audit

Audit date: 2026-08-05  
Audit type: source code and migration review of the uploaded project ZIP  
Runtime limitation: no authenticated live Supabase, Cloudinary, Vercel, or production-admin session was used. Therefore this report verifies implementation paths, not the current live database contents or deployment state.

## Executive result

The main public website content system is substantially dynamic and versioned. The uploaded project contains working draft/publish workflows for the principal public pages and Home sections. It is not accurate, however, to describe every admin feature as fully dynamic: several administrative screens are placeholders, some legacy routes coexist with the canonical editors, and image-based icon upload was not consistently available across every icon-bearing field.

Fix 01 resolves the two requested gaps:

- Projects Status, Category, Location, and Size vocabularies are now dynamic CMS data.
- Home Tenants & Partners now supports Font Awesome or uploaded icons/logos.

## Public content matrix

| Area | Source-level status | Notes |
|---|---|---|
| Global navbar/footer/site shell | Dynamic | Versioned settings/editor workflow; logo and public contact/navigation content are data-backed. |
| Home Hero | Dynamic | Slides, text, order, visibility, desktop/mobile images, draft and publish workflow. |
| Home About | Dynamic | Text/media content is editable and versioned. |
| Home Statistics | Dynamic with icon limitation | Metrics are editable; icons are Font Awesome keys only. Uploaded icon selection is not implemented here. |
| Home Featured Projects | Dynamic | Canonical project placements are data-backed. Fix 01 also derives status tabs from actual project statuses rather than a fixed three-value list. |
| Home Commitment Quote | Dynamic | Versioned content workflow. |
| Home Media Highlights | Dynamic | Data-backed article/media selection. |
| Home Tenants & Partners | Dynamic after Fix 01 | Text, order, visibility, colour, Font Awesome, and uploaded image/logo source. |
| Home Contact | Dynamic with icon limitation | Content and contact details are editable; detail icons remain Font Awesome keys only. |
| About page | Dynamic with icon limitation | Main content/media is editable; pillar/accreditation icons remain code-key fields. |
| Projects listing/detail | Dynamic after Fix 01 | Page copy, projects, media, gallery, visibility, and four filter vocabularies are data-backed. |
| Concerns | Mostly dynamic | Concern records, media, services, related projects, order and visibility are editable. Service icons remain Font Awesome-only; the editor explicitly notes that shared header media remains fixed in the current phase. |
| Media/Articles | Dynamic in canonical editor | The `/admin/articles` and versioned Media page workflow are the canonical paths. A legacy category route remains. |
| Career | Dynamic | Vacancies, public career content, and applications are data-backed. |
| Contact page | Dynamic | Public content and submission workflow are data-backed. |
| Media Library | Dynamic | Signed Cloudinary upload, Supabase metadata, search/filter, archive/delete and usage checks are implemented. |

## Admin-only gaps that remain outside Fix 01

### Static placeholder screens

- `website/src/app/admin/audit-logs/page.js` uses a hardcoded `LOGS` array.
- `website/src/app/admin/users/page.js` uses a hardcoded `USERS` array.

These screens are not connected to live audit/user management data in the uploaded source.

### Legacy or transitional routes

- `website/src/app/admin/pages/home/sections/[sectionKey]/page.js` is a generic legacy editor path with fallback/mock-oriented state. Dedicated Home section routes are the authoritative editors.
- `website/src/app/admin/media/[categoryKey]/page.js` is a legacy direct-table workflow. The versioned Media page and `/admin/articles` are the safer canonical workflows.
- `/admin/navigation` is primarily an overview. Header/footer child routes redirect to the dynamic site settings editor.

### Project catalogue deletion

The Projects editor permits removal of newly created unsaved draft projects. Existing canonical projects do not currently expose a delete/archive control in that editor. This appears intentional to protect stable project IDs referenced by Home placements and inquiries, but it means complete project lifecycle management is not yet exposed in the UI.

### Icon upload is not universal

After Fix 01, uploaded icons/logos are available for Tenants & Partners. Other icon-bearing modules still use text icon keys, including:

- Home Statistics
- Home Contact details
- About pillars and accreditations
- Concern service cards
- Footer social links

The project already contains a reusable `IconPicker` with custom-icon support, but these canonical editors are not consistently wired to it. This should be handled as a separate fix because it affects several payload schemas, public components, validation functions, and migrations.

### Dashboard labels

Dashboard counts/activity are data-driven, but the module cards, labels, route catalogue and explanatory copy are application configuration rather than CMS content. That is normal for an admin application and is not necessarily a defect.

## Fix 01 safety conclusions

- No project folder restructuring is included.
- No `.env.local`, API key, database URL, Cloudinary credential, or Vercel setting is included or replaced.
- Existing routes and visual class names are retained.
- Existing project filter labels remain available; only option vocabularies become structured dynamic arrays.
- Existing three project statuses retain their exact CSS colours.
- Existing Font Awesome partner icons remain valid without migration of their values.
- Uploaded partner icons use the existing Media Library and Cloudinary delivery pipeline rather than introducing a second upload service.

## Recommended later fixes

1. Connect Audit Logs and Users screens to live Supabase tables and role-safe RPCs.
2. Consolidate or clearly deprecate legacy generic editor routes.
3. Add archive/restore lifecycle controls for canonical projects rather than destructive deletion.
4. Standardize the existing custom `IconPicker` across remaining icon-bearing modules.
5. Add an automated admin smoke-test suite for draft/save/preview/publish and media usage integrity.
