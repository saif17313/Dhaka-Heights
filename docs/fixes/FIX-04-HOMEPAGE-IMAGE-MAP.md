# Fix 04 — Homepage Parallax Image Fill and Live Google Map

## Scope

This package changes only the homepage overlapping-image animation and Google Maps rendering used by the homepage Contact section and Contact-page preview.

## Root causes

1. The two animated homepage images were exactly the same height as their clipped containers. The animation translated them by up to 200 px while the scale could return to `1`, exposing the white wrapper during reverse or fast scrolling.
2. The homepage Contact section was intentionally rendering a static dark map mockup. A Google Maps share/short URL also cannot be used directly as an iframe source.

## Changes

- Adds responsive image overscan and clamps parallax travel to a safe percentage of each image frame.
- Preserves the existing overlap, scroll animation, cards, radius, shadow, copy, and responsive layout.
- Uses `translate3d` and a safe minimum scale to prevent repaint gaps.
- Replaces only the homepage fake map graphic with a real responsive Google Maps iframe.
- Reuses the dynamic published Contact-page map configuration.
- Adds a small URL normalizer that accepts valid Google embed URLs and coordinate-based Google URLs.
- Rejects arbitrary iframe hosts and falls back to the approved Dhaka Heights coordinates:
  - Latitude: `23.8137067`
  - Longitude: `90.428437`
- The Contact public page and its existing admin preview now use the same normalization logic.

## Modified files

- `website/src/app/page.js`
- `website/src/components/HomePageClient.js`
- `website/src/components/AboutSection.js`
- `website/src/components/ContactForm.js`
- `website/src/components/ContactPageClient.js`
- `website/src/lib/googleMaps.js` (new)

## Intentionally unchanged

- Database schema and records
- Supabase credentials and configuration
- Cloudinary configuration
- `.env` files
- Project structure
- Navbar, footer, forms, routes, and unrelated sections
- Existing map data and admin Save Draft / Publish workflow

## Validation

- All changed JavaScript/JSX files were syntax-parsed with the TypeScript compiler parser.
- Google Maps URL normalization was tested with an empty value, coordinates, valid embed URL, regular Google Maps coordinate URL, short `maps.app.goo.gl` link, and a non-Google URL.
- The installer runs `npm.cmd run build` on Windows and restores only Fix 04 files if the build fails.

## Suggested commit message

`fix: prevent homepage image gaps and render live Google map`
