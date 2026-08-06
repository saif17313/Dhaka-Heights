# Fix 02 — Navbar Alignment, Dynamic About Team, and Scroll-to-Top Styling

## Purpose

This scoped fix makes three changes without restructuring the repository or changing unrelated public/admin behavior:

1. Visually aligns the two-line navbar brand lockup so **Dhaka Heights** and **Properties LTD** occupy the same displayed width while retaining the existing font, size, letter spacing, colors, and logo treatment.
2. Adds a database-backed **Team** section to the About page, including profile cards and a modal detail view.
3. Restyles the existing bottom-left scroll-to-top control as a subtle transparent circular button while retaining its current position, visibility threshold, and smooth-scroll behavior.

The Edison Real Estate reference was used only for the information architecture: a team-card listing that opens a detailed member view. The implementation uses the existing Dhaka Heights design system.

## Scope

### Public website

- Desktop navbar brand lockup
- Mobile drawer brand lockup
- About page Team section
- Team profile modal
- Existing scroll-to-top button styling

### Admin panel

- Adds a **Team** tab to `/admin/pages/about`
- Add a member by selecting or uploading a portrait through the existing Media Library
- Edit name, designation, biography, image alternative text, and visibility
- Replace member portrait
- Reorder and delete members
- Configure the Team section tag, heading, and introduction from the Content tab
- Preview the section before publishing

### Database

The migration extends the existing versioned About-page CMS. It does not introduce an unrelated table.

Team members are stored in the existing `section_items` table:

- `item_key`: `team-*`
- `title`: member name
- `subtitle`: designation
- `body_text`: biography
- `image_asset_id`: existing `media_assets` record
- `image_alt`: accessible portrait description
- `sort_order`: display order
- `is_visible`: public visibility

The migration updates the existing About snapshot, validation, and child-replacement functions so Team data participates in the same draft/publish workflow and media-usage tracking as the rest of the About page.

## Deliberate Safety Decisions

- No fake team member is inserted.
- The public Team section remains absent until at least one visible member with a valid image is published.
- Existing Media Library and Cloudinary upload/delivery behavior is reused.
- No `.env` file, credential, Supabase project URL/key, Cloudinary credential, API endpoint, route structure, package dependency, or global layout component is replaced.
- `globals.css` is not overwritten. The installer appends one marker-delimited, scoped CSS fragment so earlier fixes and local styling remain intact.
- No Git commit, stage, push, merge, or deployment is performed.

## Modified Files

- `website/src/components/Navbar.js`
- `website/src/components/AboutPageClient.js`
- `website/src/components/admin/AboutPageEditor.js`
- `website/src/lib/aboutPageActions.js`
- `website/src/lib/aboutPageRepository.js`
- `website/src/app/globals.css` — scoped fragment appended only
- `supabase/migrations/20260805000018_about_team_section.sql` — new migration
- `docs/fixes/FIX-02-NAVBAR-ABOUT-TEAM-SCROLL-TOP.md` — this implementation note

## Migration Requirement

The source code can be reviewed and built without changing the remote database. However, saving or publishing Team data requires the migration to be applied to the intended Supabase environment.

Only run `supabase db push` after verifying that the linked project is the correct development or staging project. Do not apply it to an unverified live/customer database.

## Verification Checklist

- Navbar text aligns on desktop, scrolled header, and mobile drawer.
- Existing typography, colors, logo, navigation links, and responsiveness remain unchanged.
- About page is unchanged when no team member exists.
- Admin can add, edit, replace image, hide/show, reorder, and delete Team members.
- Team cards open the correct member modal.
- Modal closes through the close button, Escape key, and backdrop click.
- Body scrolling is restored after closing the modal.
- Scroll-to-top button remains bottom-left and still scrolls smoothly to the top.
- Production build succeeds before any optional database push.

## Suggested Commit Message

```text
feat(about): add dynamic team profiles and refine global navigation controls
```
