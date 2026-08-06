# Fix 07 — Team Heading Deduplication

## Purpose
Prevent the About page from rendering the same Team heading twice when the editable Team section heading and a category heading represent the same wording.

## Behaviour
- `Leadership & Management` and `Leadership and Management` are treated as the same heading.
- The main Team section heading is rendered once.
- The duplicate category heading is omitted and member cards begin directly below the main heading area.
- Category descriptions remain visible when configured.
- Additional categories with different headings continue to render normally in their saved order.
- Admin Preview uses the same public renderer, so it reflects the same result.

## Modified files
- `website/src/components/AboutPageClient.js`
- `website/src/components/admin/AboutPageEditor.js`

## Intentionally unchanged
- Team data and Supabase schema
- Category/member CRUD
- Category and member serialization
- Media Library and Cloudinary portrait workflow
- Modal profile behaviour
- Existing page design, colors, typography, spacing, navbar, footer and unrelated sections

## Suggested commit message
`fix: prevent duplicate team category heading`
