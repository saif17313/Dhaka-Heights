# Fix 05 v4 — Dynamic About Team

## Scope

This exact-current-state patch completes the dynamic **Our Team** section on the public About page and its existing About admin editor.

## Public behavior

- Reads visible team members from the existing versioned About-page CMS data.
- Preserves saved `sortOrder` and displays members in that order.
- Shows responsive portrait cards using the current Dhaka Heights design system.
- Opens an accessible in-page floating profile dialog with biography and portrait.
- Supports close button, backdrop click, Escape, focus trapping, focus restoration, body-scroll locking, and reduced-motion preferences.
- Keeps the public section hidden when no visible member with a portrait exists; admin Preview displays a clear empty state.

## Admin behavior

The existing `/admin/pages/about` Team tab supports:

- Editable section label, heading, introduction, and profile-window heading.
- Add, edit, delete, show/hide, and reorder team members.
- Existing Media Library / Cloudinary portrait selection and replacement.
- Name, designation, biography, portrait alt text, visibility, and deterministic serial order.
- Draft preview, Save Draft, and Publish through the existing About CMS workflow.

## Database

Migration `20260805000020_about_team_editor_completion.sql`:

- Reuses `page_sections`, `section_items`, and `media_assets`.
- Does not create a duplicate Team table.
- Preserves existing team records.
- Allows hidden draft members without a portrait while requiring portrait, biography, and alt text for visible members.
- Keeps team member order in `section_items.sort_order`.
- Adds `teamSection.modalHeading` without overwriting existing values.

## Modified files

- `website/src/components/AboutPageClient.js`
- `website/src/components/admin/AboutPageEditor.js`
- `website/src/lib/aboutPageActions.js`
- `website/src/lib/aboutPageRepository.js`
- `website/src/app/globals.css`
- `supabase/migrations/20260805000020_about_team_editor_completion.sql`

## Intentionally unchanged

Repository structure, environment files, credentials, authentication, navbar, footer, non-Team About sections, other public pages, Cloudinary configuration, and unrelated database content.

## Suggested commit message

`fix: complete dynamic About team section and profile dialog`
