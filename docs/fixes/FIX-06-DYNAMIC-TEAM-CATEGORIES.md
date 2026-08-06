# Fix 06 — Dynamic About Team Categories

## Purpose
Extend the existing dynamic About-page Team section so administrators can create multiple ordered categories, such as **Leadership and Management**, and manage ordered team members inside each category.

## Public behavior
- The About page keeps the existing Team section design.
- Visible categories are rendered in saved order.
- Each category has an editable heading and optional short overview.
- Visible members are grouped under their assigned category and rendered in saved order.
- Clicking a member opens the existing floating profile panel.
- The floating profile heading uses the member's category title.
- Hidden categories and their members are not rendered publicly.

## Admin behavior
The About editor Team tab now supports:
- Add, edit, hide/show, reorder, and delete Team categories.
- Add members directly inside a category.
- Reassign a member to another category.
- Reorder members inside their category.
- Existing member CRUD, portrait selection, biography, preview, draft, and publish workflows.
- Deleting a category reassigns its members to the first remaining category after confirmation.

## Data model
No new table is introduced.
- Category records use `section_items` keys prefixed with `team-category-`.
- Category title is stored in `title`.
- Category overview is stored in `body_text`.
- Category order uses `sort_order`.
- Member-to-category linkage uses the existing `section_items.tag_text` column.

## Migration
`20260805000021_about_team_categories.sql`:
- Creates a default `Leadership and Management` category for each existing About draft/published version when missing.
- Assigns existing Team members to that category without deleting or rewriting their profile content.
- Updates the About snapshot, validation, and child-replacement database functions.

## Modified files
- `website/src/components/AboutPageClient.js`
- `website/src/components/admin/AboutPageEditor.js`
- `website/src/lib/aboutPageRepository.js`
- `website/src/lib/aboutPageActions.js`
- `website/src/app/globals.css`
- `supabase/migrations/20260805000021_about_team_categories.sql`

## Intentionally unchanged
- Existing Team card and modal visual design
- About-page section order
- Navbar and footer
- Authentication
- Media Library and Cloudinary upload flow
- Supabase credentials and environment files
- Unrelated pages and CMS modules

## Suggested commit message
`feat: add dynamic categories to about team section`
