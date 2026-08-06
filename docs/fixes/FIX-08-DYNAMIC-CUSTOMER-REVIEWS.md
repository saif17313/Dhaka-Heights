# Fix 08 — Dynamic Customer Reviews

## Architecture

- Next.js App Router application under `website/`
- Public Media Center tab state follows the existing `?cat=` query-parameter pattern
- Supabase tables use the existing admin role, RLS, audit, media library, and versioned Media Center architecture
- Review images reuse `media_assets` and the existing Cloudinary-backed Media Library

## Public routes

- Listing tab: `/media-center?cat=reviews`
- Detail page: `/media-center/customer-reviews/[slug]`

Only published reviews and media belonging to published reviews are publicly readable.

## Admin routes

- Listing: `/admin/media/customer-reviews`
- Create: `/admin/media/customer-reviews/new`
- Edit/preview: `/admin/media/customer-reviews/[id]`

The editor supports customer profile data, a separate profile photo, full review text, optional rating/date/project/category/type, publication status, featured state, serial order, multiple photos, multiple YouTube videos, media ordering, and one optional card preview.

## Database

Migration: `supabase/migrations/20260805000022_customer_reviews.sql`

Tables:

- `customer_reviews`
- `customer_review_media`

`customer_reviews.selected_preview_media_id` stores the one card preview. A deferred database trigger verifies that the selected media belongs to the same review. The foreign key clears the selection if the selected media is removed.

Review photos reference `media_assets`. YouTube media stores a normalized URL, the validated 11-character video ID, and an automatically generated thumbnail URL. Media usage triggers register profile and gallery images in `media_asset_usage`.

## YouTube handling

Supported inputs:

- `youtu.be/<id>`
- `youtube.com/watch?v=<id>`
- `youtube.com/shorts/<id>`
- `youtube.com/live/<id>`
- YouTube embed and privacy-enhanced embed URLs

Listing cards load thumbnails only. Detail pages use responsive `youtube-nocookie.com` embeds.

## Safety

- No `.env` file is included or changed.
- No Supabase or Cloudinary credential is included or changed.
- News, Blogs, and Virtual Tours remain on their existing data model.
- Deleting a review removes its relation rows but preserves shared Media Library assets.
- No commit, staging, push, merge, or pull request is performed.
