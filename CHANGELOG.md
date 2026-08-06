# Changelog

Session log of feature/fix branches. Each item was implemented, built, linted, committed, and pushed to its own branch as an open PR — **none of these are merged into `main`**.

## 2026-08-06

### `feature/project-video-showcase`
YouTube video demo section on project detail pages, next to the image gallery. Admin can set a per-project YouTube URL in the project editor (`videoUrl` field, validated via `src/lib/youtube.js`). New migration adds `projects.video_url` and updates `validate_projects_page_payload` / `sync_projects_catalog`.

### `feature/scroll-to-top-progress-button`
Scroll-to-top button moved from bottom-left to bottom-right, with a circular gold progress ring (`src/components/ScrollToTop.js`) that fills proportionally to scroll position. Opaque navy/gold styling so it stays visible on dark page backgrounds.

### `feature/concern-dynamic-audit`
Audited and confirmed the Concern (sister companies) dropdown + detail pages are fully CMS-driven — admin can add/edit/delete concerns and changes reflect in the nav menu. Fixed a real bug: deleting and re-adding a concern with the same slug could hit a UNIQUE constraint violation because archived rows weren't cleared (`sync_concerns_catalog` migration). Replaced the plain browser `confirm()` on delete with a two-step confirmation modal (`DeleteConcernModal` in `ConcernsPageEditor.js`) requiring the admin to type the concern's exact name.

### `fix/about-pillars-text-alignment`
Fixed the About page's three pillar cards (Our Mission / Brand Promise / Our Vision) rendering with misaligned icon/title/paragraph start when card text lengths differ. Solved structurally via `justify-content: flex-start` + fixed `padding-top` on `.pillar-card-premium` (content-length-independent), not a `min-height` approximation.

### `fix/navbar-logo-first-paint-stretch`
Fixed the "DHAKA HEIGHTS PROPERTIES LTD" navbar wordmark appearing stretched/distorted on true first page load (looked fine only after a responsive-mode toggle). Root-caused to unreliable JS-based width measurement; resolved with a static, zero-JS CSS fix (`letter-spacing` + `white-space: nowrap` on `.nav-brand-title` / `.nav-brand-subtitle`).

### `feature/buyer-landowner-contact-forms`
Split the single `/contact` page's buyer/landowner flows into two dedicated pages: `/contact/buyer` and `/contact/landowner`, each with its own form (`BuyerEnquiryForm.js`, `LandownerEnquiryForm.js`). Both reuse the same info-cards + Google Map sections as `/contact` — only the form itself differs. Submissions POST to `/api/submissions/buyer` and `/api/submissions/landowner`, land in the existing `inquiries` table (new `buyer_lead` / `landowner_lead` submission types), and are visible from the single existing **Admin → Inquiries** inbox (`/admin/inquiries`), tagged "Buyer Enquiry" / "Landowner Submission" — no new admin section was built.

## Working notes for this repo

- Every change goes on its own branch off `main`; nothing gets merged without explicit sign-off — always leave a PR link, never merge.
- `gh pr create` fails with `HTTP 401` in this environment (unauthenticated `gh` CLI) — always fall back to the manual PR URL: `https://github.com/saif17313/Dhaka-Heights/pull/new/<branch>`.
- `local/all-features-preview` is a local-only branch (never pushed) that merges all the feature branches together purely so the local `next dev` server can preview everything at once.
