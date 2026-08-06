# Dhaka Heights Dynamic CMS — Verified Current State

**Last verified:** 2026-08-02
**Working branch:** `feat/admin-contact-page-dynamic-integration`
**Canonical database migrations:** top-level `supabase/migrations/`

## Public website

- The public website is still predominantly backed by local JSX literals and JavaScript arrays.
- Phases 1A through 1I refactor every page-level Home section plus the global Site Shell—metadata, branding, preloader, navigation, quick inquiry, mobile drawer, social links, and footer—to read published, versioned Supabase snapshots.
- All Home content plus the complete About, Projects, Concerns, Media Center, Career, and Contact page bodies are now dynamic end to end.
- Chairman Message and Sister Concerns are not current public Home sections and are intentionally excluded.
- Missing visible published page-level Home content is a configuration error; a deliberately disabled published section cleanly renders nothing.

## Phases 1A through 1I and Phases 2 through 7 implementation complete

- Real Supabase session and active `admin_profiles` authorization replace the unsigned development-cookie bypass.
- `/api/admin/*`, saved-draft preview, media signing, and destructive media operations have server-side role gates.
- The Hero has a dedicated controlled editor with local unsaved preview, validation, media-by-ID selection, visibility, timing, add/duplicate/remove/reorder, optimistic concurrency, Save Draft, Publish, and revision summary.
- Public and admin rendering share `HeroSlider`; the five hardcoded public slide records have been removed from the component.
- Migration `20260801000002_home_hero_versioned_cms.sql` adds versioning, workflow metadata, RLS, atomic Hero save/publish RPCs, transactional media usage, deletion locking with a durable retry outbox, audit/revision writes, and the exact five-slide seed.
- Public and admin rendering now also share `AboutSection`; the Home About copy, CTA values, and two local image sources have been removed from the public component.
- The dedicated About editor provides controlled fields, unsaved local preview, media selection by asset ID, visibility, optimistic concurrency, Save Draft, Publish, and an authenticated saved-draft preview.
- Migration `20260801000003_home_about_versioned_cms.sql` adds named About items, strict validation, atomic About draft/publish RPCs, parent-aware public RLS, transactional media usage, audit/revision writes, and the exact current About seed.
- Public and admin rendering now share `Metrics`; the four hardcoded public metric records have been removed from the component.
- The dedicated Statistics editor provides numeric value/suffix fields, labels, supporting text, Font Awesome icon keys, item and section visibility, add/duplicate/remove/reorder controls, local preview, optimistic concurrency, Save Draft, Publish, and revision history.
- Migration `20260801000004_home_statistics_versioned_cms.sql` adds explicit numeric metric semantics, strict validation, atomic Statistics draft/publish RPCs, parent-aware public RLS, audit/revision writes, and the exact four-metric seed.
- Public and admin rendering now share `ProjectsGrid`; the ten duplicated Home project records and local image URLs have been removed from the component.
- The dedicated Featured Projects editor provides canonical project selection, accessible ordering, placement and section visibility, tag/heading/page-size settings, local preview, optimistic concurrency, Save Draft, Publish, and revision history.
- Migration `20260801000005_home_featured_projects_versioned_cms.sql` adds parent-aware placement RLS, read-only direct placement access, atomic placement draft/publish RPCs, strict canonical-project validation, cover media relations/usages, and the exact ten-project placement seed.
- Public and admin rendering now share `CommitmentQuote`; the hardcoded quotation and attribution have been removed from the component.
- The dedicated Commitment Quote editor provides controlled quotation/attribution fields, visibility, unsaved local preview, optimistic concurrency, Save Draft, Publish, revision history, and an authenticated saved-draft preview.
- Migration `20260801000006_home_commitment_quote_versioned_cms.sql` adds the exact current quote seed, parent-aware published metadata access, strict validation, and atomic Quote draft/publish RPCs with audit and revision writes.
- Public and admin rendering now share `MediaGrid`; its three hardcoded Home article records and local cover URLs have been removed from the component.
- The dedicated Media Highlights editor provides canonical post selection, accessible ordering, placement and section visibility, section copy and View All settings, local preview, optimistic concurrency, Save Draft, Publish, and revision history.
- Migration `20260801000007_home_media_highlights_versioned_cms.sql` adds strict placement integrity, Home presentation overrides, canonical Cloudinary cover relations/usages, the missing current canonical article, atomic Media Highlights draft/publish RPCs, and the exact three-card seed.
- Public and admin rendering now share `PartnersCarousel`; the hardcoded eight-record public partner array has been removed, while the second animation loop remains derived presentation behavior.
- The dedicated Partners Carousel editor provides heading, name, category, Font Awesome icon, accent colour, order, item/section visibility, add/duplicate/remove controls, local preview, optimistic concurrency, Save Draft, Publish, revision history, and an authenticated saved-version preview.
- Migration `20260801000008_home_partners_carousel_versioned_cms.sql` adds the exact eight canonical partner records, strict validation, parent-aware published access, and atomic Partners Carousel draft/publish RPCs with audit and revision writes.
- Public and admin rendering now share `ContactForm`; all Home contact copy, details, map labels, validation/success text, and space options have been removed from the public component.
- The dedicated Contact Section editor provides controlled section/form/map copy, ordered contact details and space options, visibility, local preview, optimistic concurrency, Save Draft, Publish, revision history, and an authenticated saved-version preview.
- The public Home form now writes validated `layout_request` records to `inquiries` through the honeypot- and rate-limited submission endpoint instead of simulating success locally.
- Migration `20260801000009_home_contact_section_versioned_cms.sql` adds the exact current Contact seed, strict structured validation, parent-aware published access, and atomic Contact draft/publish RPCs with audit and revision writes.
- The root public layout now loads one published Site Shell snapshot for every route. `Navbar`, `QuickInquiry`, `Footer`, Home preloader, favicon, canonical metadata, Open Graph, and Twitter fields no longer use local content literals or local logo/social-image URLs.
- Published concerns are the canonical source for the eight Concern navigation entries; the Site Shell stores only the parent navigation record and derives its dropdown from `concerns` order.
- The dedicated Site Shell editor consolidates the old settings/header/footer mocks with controlled branding, metadata, media-by-ID, preloader, mobile drawer, quick inquiry, navigation, footer, social settings, local preview, optimistic concurrency, Save Draft, Publish, and protected saved preview.
- Migration `20260801000010_global_site_shell_versioned_cms.sql` versions Site Shell content and its navigation/footer/social rows, archives the two legacy duplicate settings rows, adds parent-aware RLS, strict validation, exact current-content seed, transactional media usages, audit/revision writes, and atomic draft/publish RPCs.
- The public `/about` route now loads a single published version containing the Hero, corporate overview, brand pillars, sustainability, leadership, Sister Concerns, accreditations, and page SEO. The former local arrays, JSX copy, and local About image URLs have been removed.
- The eight About concern cards are ordered relational placements backed by canonical published `concerns`, with scoped title, description, CTA, and cover overrides preserving the current design.
- The dedicated full-page About editor provides structured copy, paragraphs, named media selection by ID, pillar/accreditation management, canonical concern placement and ordering, local preview, authenticated saved preview, optimistic concurrency, Save Draft, Publish, and revision history.
- Migration `20260801000011_about_page_versioned_cms.sql` adds the exact current About seed, structured validation, parent-aware public access, transactional media usages, audit/revision writes, and atomic full-page draft/publish RPCs.
- The public `/projects` listing and `/project/[id]` detail routes now load one published Projects snapshot from Supabase. Their duplicated local project arrays, local card/detail/gallery image URLs, page copy, filter labels, specification labels, form copy, and SEO literals have been removed.
- The unified Projects Page & Catalogue editor at both `/admin/pages/projects` and `/admin/projects` manages page SEO/header/filter/detail copy, all ten stable canonical project records, listing visibility/order, covers, galleries, local listing/detail previews, saved preview, optimistic concurrency, Save Draft, Publish, and revision history.
- Publishing the Projects page transactionally synchronizes the existing stable `projects.id` records so Home placements remain relationally valid, and rebuilds the canonical `project_media` gallery relations plus media usages without exposing draft changes.
- The Project callback form now writes validated `project_inquiry` records with the canonical `project_id` through a honeypot- and rate-limited endpoint. Its intentionally optional email field is represented accurately in the database.
- Migration `20260801000012_projects_page_versioned_cms.sql` adds the exact current Projects listing/detail seed, structured project catalogue fields, parent-aware project-child RLS, direct-write removal, transactional media usage/catalogue synchronization, audit/revision writes, and atomic full-page draft/publish RPCs.
- All ten project Cloudinary covers were verified byte-for-byte against the original local card images before their canonical `projects.cover_image_id` relations were backfilled.
- All eight public `/concern/[slug]` detail pages now load one published Concerns catalogue snapshot from Supabase. The former local concern, service, feature, project, and image arrays have been removed.
- The unified Sister Concerns editor at `/admin/concerns` manages shared detail labels, all eight stable canonical concerns, services, features, visibility/order, Cloudinary overview media, relational project associations, local preview, authenticated saved preview, optimistic concurrency, Save Draft, Publish, and revision history.
- Publishing the Concerns catalogue transactionally synchronizes the stable `concerns.id` rows used by About and global navigation plus canonical `projects.concern_id` relationships.
- Migration `20260801000013_concerns_page_versioned_cms.sql` adds the exact current detail-page seed, read-only direct concern access, structured validation, transactional media usage/catalogue synchronization, audit/revision writes, and atomic draft/publish RPCs.
- The public `/media-center` listing and `/media-center/[slug]` detail routes now load one published Media Center snapshot from Supabase. The former 16-article JavaScript catalogue, three local-image video cards, shared detail copy, listing labels, page header, and SEO literals have been removed from the public route path.
- The unified Media Center editor at `/admin/articles` manages page copy and SEO, all 16 stable canonical articles, three virtual tours, Cloudinary covers/thumbnails, visibility/order, listing and article previews, optimistic concurrency, Save Draft, Publish, and revision history. Legacy Media page and article-detail editor routes now resolve to this workflow.
- Publishing transactionally synchronizes the stable `media_posts` catalogue used by Home Media Highlights, archives omitted records instead of deleting them, rebuilds media usage references, records audits/revisions, and promotes the version atomically.
- Migration `20260801000014_media_page_versioned_cms.sql` adds Media post visibility/order/alt metadata, parent-aware public access, read-only direct catalogue access, strict snapshot validation, exact current listing/detail/video seed data, and atomic draft/publish RPCs.
- The public `/career` route now loads one published Career snapshot from Supabase. Its page copy, SEO, three benefit cards, three vacancy records, two local background images, and simulated application behavior have been removed from the public route path.
- The unified Career editor at `/admin/careers` and `/admin/pages/career` manages page copy and SEO, Cloudinary page media, benefits, all canonical vacancy content, visibility/order, local preview, optimistic concurrency, Save Draft, Publish, and revision history. Legacy Career section and vacancy-management routes redirect to this workflow.
- The public Career application form now validates the selected published vacancy, uploads PDF/DOC/DOCX resumes to the private `career-resumes` bucket, and persists the canonical application relationship. `/admin/careers/applications` provides protected HR application status, notes, and signed resume downloads.
- Migration `20260802000015_career_page_versioned_cms.sql` adds the exact current Career page and three-vacancy seed, canonical vacancy synchronization, parent-aware public access, restricted application access, strict snapshot validation, transactional media usages, audit/revision writes, and atomic Career draft/publish RPCs.
- The public `/contact` route now loads one published Contact snapshot from Supabase. Its header, four information cards, form copy, four inquiry subjects, map content, map embed, SEO, and simulated submission behavior have been removed from the public route path.
- The unified Contact editor at `/admin/pages/contact` manages the full page snapshot with repeated-card and inquiry-subject controls, visibility/order, local preview, optimistic concurrency, Save Draft, Publish, and revision history. Legacy Contact section routes redirect to this workflow.
- Contact messages now pass server validation against the published subject list and persist as `contact` records through a honeypot- and rate-limited endpoint. The protected `/admin/inquiries` workflow now uses the real submission status enum, controlled internal notes, server-side role gates, and audit writes.
- Migration `20260802000016_contact_page_versioned_cms.sql` adds the exact current Contact seed, parent-aware public access, strict structured validation, atomic draft/publish RPCs, inquiry timestamp maintenance, and read/update-only sales policies that block anonymous direct insertion and administrative deletion.
- The five Cloudinary seed binaries were verified byte-for-byte against their five local Hero assets.
- All Phase 1 through Phase 7 migrations are applied to the confirmed development Supabase project; all seventeen local migration versions match the remote ledger.
- Auth user `6552bfeb-1619-4168-b4c1-967389ccdd68` is linked to the active `Abdullah Al Saif` `super_admin` profile.
- The application is running from the Phase 7 production build at `http://localhost:3000/`.

## Verification completed

- Production Next.js build passes.
- Targeted ESLint passes apart from documented raw-image optimization warnings.
- Migration parses successfully as PostgreSQL SQL.
- A pre-migration schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1a-20260801-132826`.
- Anonymous admin/API requests and the legacy `sb-dev-session` cookie fail closed. The confirmed active administrator can access the protected admin shell and media/signing APIs.
- The exact five-slide published Hero renders from Supabase and Cloudinary; the public route no longer uses the local Hero array or local Hero image URLs.
- The exact published About content and its two Cloudinary images render from Supabase; the public Home route no longer contains the two local About image URLs.
- Authenticated workflow verification passed for draft isolation, public RLS, stale-save 409, atomic publish, audit/revision writes, and restoration of the exact original content. Version 3 is published, versions 1 and 2 are archived, and no draft remains.
- Referenced media deletion returns 409 and leaves the asset active.
- About draft isolation, public RLS, stale-save 409, atomic publish, revision/audit writes, and exact-content restoration were runtime-verified. About version 3 is published, versions 1 and 2 are archived, and no About draft remains.
- Both About Cloudinary seed binaries were verified byte-for-byte against the original local images, and referenced deletion returns 409.
- The exact four published Statistics metrics render from Supabase with their numeric values, suffixes, labels, supporting copy, icons, visibility, and order.
- Statistics draft isolation, public RLS, stale-save 409, atomic publish, revision/audit writes, and exact-content restoration were runtime-verified. Statistics version 3 is published, versions 1 and 2 are archived, and no Statistics draft remains.
- The exact ten Featured Projects placements render canonical published project fields and Cloudinary covers; no local Home project image URL remains.
- Featured Projects draft/placement isolation, public RLS, stale-save 409, atomic publish, revision/audit writes, and exact-order restoration were runtime-verified. Featured Projects version 3 is published, versions 1 and 2 are archived, and no placement draft remains.
- The exact Commitment Quote text and attribution render from Supabase; the component no longer contains those public content literals.
- Commitment Quote draft isolation, anonymous published-only reads, stale-save 409, atomic publish, revision/audit writes, and exact-content restoration were runtime-verified. Commitment Quote version 3 is published, versions 1 and 2 are archived, and no Quote draft remains.
- The exact three Media Highlight cards render canonical media-post data plus scoped Home overrides and Cloudinary covers; no local Home media image URL remains.
- Media Highlights draft/placement isolation, public RLS, stale-save 409, atomic publish, revision/audit writes, and exact-placement restoration were runtime-verified. Media Highlights version 3 is published, versions 1 and 2 are archived, and no Media Highlights draft remains.
- The exact eight published partner records render from Supabase as 16 cards, with only the eight canonical rows stored and the second loop generated by the shared component.
- Partners Carousel draft isolation, public RLS, anonymous mutation rejection, stale-save 409, atomic publish, revision/audit writes, and exact-content restoration were runtime-verified. Partners Carousel version 3 is published, versions 1 and 2 are archived, and no Partners Carousel draft remains.
- The exact published Contact copy, three contact details, four space options, map labels, form labels, validation messages, and success text render from Supabase.
- Contact draft isolation, public RLS, anonymous mutation rejection, stale-save 409, atomic publish, revision/audit writes, and exact-content restoration were runtime-verified. Contact version 3 is published, versions 1 and 2 are archived, and no Contact draft remains.
- Site Shell draft isolation, anonymous published-only reads, anonymous mutation rejection, stale-save 409, atomic publish, revision/audit writes, and exact-content restoration were runtime-verified. Site Shell version 5 is published, versions 1–4 are archived, and no Site Shell draft remains.
- Full About page draft isolation, anonymous published-only reads, anonymous mutation rejection, stale-save 409, atomic publish, revision/audit writes, and exact-content restoration were runtime-verified. About page version 3 is published, versions 1 and 2 are archived, and no About page draft remains.
- Full Projects page draft isolation, anonymous published-only reads, anonymous mutation rejection, stale-save 409, atomic catalogue/gallery synchronization, revision/audit writes, and exact-content restoration were runtime-verified. Projects page version 3 is published, versions 1 and 2 are archived, and no Projects page draft remains.
- Full Concerns catalogue draft isolation, anonymous published-only reads, stale-save 409, atomic canonical concern/project synchronization, revision/audit writes, and exact-content restoration were runtime-verified. Concerns version 4 is published, versions 1–3 are archived, and no Concerns draft remains.
- Full Media Center draft isolation, anonymous published-only reads, anonymous mutation rejection, stale-save 409, atomic canonical article synchronization, revision/audit writes, and exact-content restoration were runtime-verified. Media Center version 3 is published, versions 1 and 2 are archived, and no Media Center draft remains.
- Full Career draft isolation, anonymous published-only reads, anonymous mutation rejection, stale-save 409, atomic canonical vacancy synchronization, revision/audit writes, and exact-content restoration were runtime-verified. Career version 3 is published, versions 1 and 2 are archived, and no Career draft remains.
- The published Career snapshot contains three ordered benefits, three visible canonical vacancies, and two version-scoped Cloudinary media usages. Six pre-existing duplicate seed vacancies remain safely archived.
- Career application runtime checks passed: invalid and unavailable-job submissions returned 400, the honeypot created no row, a valid multipart submission persisted the expected canonical vacancy and private resume object, signed download returned the uploaded bytes, and all isolated test rows/files were removed.
- Full Contact draft isolation, anonymous published-only reads, stale-save 409, atomic publish, revision/audit writes, and exact-content restoration were runtime-verified. Contact version 3 is published, versions 1 and 2 are archived, and no Contact draft remains.
- The published Contact snapshot contains four ordered information cards and four ordered inquiry subjects. Anonymous direct inquiry inserts are blocked, while the public server endpoint persisted the exact selected subject and contact submission type.
- Contact submission runtime checks passed: invalid input and unpublished subjects returned 400, the honeypot created no row, a valid request persisted correctly, and the isolated test row was removed. The pre-existing inquiry count remained unchanged.
- Authenticated inquiry status/notes updates succeeded; authenticated deletion remained blocked and the isolated policy-test row was removed with the service-role cleanup path.
- The published Media Center snapshot contains 16 ordered articles, three ordered virtual tours, and 20 version-scoped Cloudinary media usages. The canonical catalogue contains 16 visible published `media_posts` records.
- The published Concerns snapshot contains eight ordered concerns, eight Cloudinary overview relations plus the shared Cloudinary header, 32 services, 32 features, ten relational project assignments, and nine version-scoped media usages.
- All eight canonical concern routes, the legacy `dhaka-heights-realty` alias, and the not-found state return HTTP 200. Public HTML uses Cloudinary media and emits no local concern overview image URLs.
- The published Projects snapshot contains ten ordered project records, ten Cloudinary covers, 23 ordered Cloudinary gallery relations, and 34 version-scoped media usages. All ten stable canonical project IDs remain published and keep their Home placement relationships.
- `/projects`, `/project/dhaka-heights-ariana-lofts`, and `/` return HTTP 200. Listing/detail HTML uses Cloudinary media and emits no local `/assets/proj_*` or Hero gallery URLs.
- Project inquiry runtime checks passed: invalid input returned 400, the honeypot created no row, a valid request persisted the expected canonical project relationship, and the isolated test inquiry was deleted after verification.
- The published About page contains 12 structured items, eight relational concern placements, and 15 tracked media usages. `/about` returns HTTP 200 with Cloudinary media and no local Hero/overview/pillar/sustainability asset URL.
- The published Site Shell has 13 stored navigation records, two footer groups, ten footer links, four social links, three tracked media usages, and a derived eight-record canonical concern dropdown.
- `/`, `/about`, `/projects`, `/contact`, `/career`, and `/media-center` return HTTP 200 with the Cloudinary logo and database metadata; none emits `/assets/logo.svg`. Anonymous `/api/admin/media` returns 401 and anonymous `/admin/settings` redirects to login.
- A real public test submission persisted the expected `layout_request`; invalid input returned 400, the honeypot created no row, and the isolated test inquiry was deleted after verification.
- Referenced canonical/override media deletion returns 409 and leaves the shared asset active.
- Referenced canonical project-cover archival returns 409 and leaves the shared asset active.
- A temporary signed Cloudinary upload was constrained to `dhaka-heights/dev/phase1a-verification`, persisted through the authenticated API, force-deleted while unreferenced, and fully cleaned from Cloudinary, `media_assets`, and the deletion outbox.
- Responsive Home screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\phase1a-screenshots-20260801-133440`.
- Responsive About screenshots were captured at the same seven widths under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\phase1b-screenshots-20260801-142300`.
- A pre-Phase-1B schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1b-20260801-140630`.
- Responsive Statistics screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\phase1c-screenshots-20260801-151701`.
- A pre-Phase-1C schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1c-20260801-150314`.
- Responsive Featured Projects screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\phase1d-screenshots-20260801-160000`.
- A pre-Phase-1D schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1d-20260801-154041`.
- Responsive Commitment Quote screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\phase1e-screenshots-20260801-161732`.
- A pre-Phase-1E schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1e-20260801-160620`.
- Responsive Media Highlights screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\phase1f-screenshots-20260801-164412`.
- A pre-Phase-1F schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1f-20260801-162759`.
- Responsive Partners Carousel screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\phase1g-screenshots-20260801-172359`.
- A pre-Phase-1G schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1g-20260801-171120`.
- Responsive Contact Section screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\phase1h-screenshots-20260801-174746`.
- A pre-Phase-1H schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1h-20260801-173344`.
- Responsive Site Shell screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1i-20260801-182529\visual-regression`.
- A pre-Phase-1I schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase1i-20260801-182529`.
- Responsive full About page screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase2-20260801-191937\visual-regression`.
- A pre-Phase-2 schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase2-20260801-191937` (the successful data stream is `data-retry.sql`; the first partial stream is not part of the checksum manifest).
- Responsive Projects listing and Ariana Lofts detail screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase3-20260801-203646\visual-regression`.
- A pre-Phase-3 schema, data, and roles backup was captured and SHA-256 verified under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase3-20260801-203646`.
- Responsive Concerns detail screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase4-20260801-225911`.
- A pre-Phase-4 database backup and visual baseline were captured under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase4-20260801-225911`.
- A pre-Phase-5 database backup and Media Center visual baseline were captured under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase5-20260801-234918`.
- Responsive Media Center listing and article-detail screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase5-20260801-234918\visual-regression`. The 1600px listing capture is byte-for-byte identical to its pre-migration baseline.
- A pre-Phase-6 database backup and Career visual baseline were captured under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase6-20260802-002523`.
- Responsive Career screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase6-20260802-002523\visual-regression`. Visual inspection confirmed parity; the 1600px files are not byte-for-byte identical.
- A pre-Phase-7 linked database backup and Contact visual baseline were captured under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase7-20260802-011500`.
- Responsive Contact screenshots were captured at 1600, 1440, 1280, 1024, 768, 390, and 360 pixels under `C:\Users\Asus\Documents\Dhaka-Heights-Backups\pre-phase7-20260802-011500\visual-regression`. The 1600px result is byte-for-byte identical to the pre-integration baseline.
- The shared Media header asset returned 409 while referenced and remained active after the deletion-safety check.
- The pre-existing narrow-mobile map-tooltip clipping remains visual debt and was preserved rather than redesigned in this CMS phase.
- The Projects listing and detail responsive captures preserve the current visual design; no public CSS redesign was introduced.
- The pre-existing repository-wide lint debt remains outside this work; targeted Phase 1A/1B/1C/1D/1E/1F/1G/1H/1I/2/3/4 checks and the production build are the acceptance gates.

## User inspection and handoff

- Sign in at `/admin/login` with the confirmed Supabase Auth account and inspect `/admin/pages/home/sections/hero-slider`.
- Inspect the new About editor at `/admin/pages/home/sections/about-corporate-home` and its protected saved-draft preview.
- Inspect the Statistics editor at `/admin/pages/home/sections/statistics-counter` and its protected saved-draft preview.
- Inspect the Featured Projects editor at `/admin/pages/home/sections/featured-projects-home` and its protected saved-draft preview.
- Inspect the Commitment Quote editor at `/admin/pages/home/sections/commitment-quote` and its protected saved-draft preview.
- Inspect the Media Highlights editor at `/admin/pages/home/sections/media-highlights-home` and its protected saved-draft preview.
- Inspect the Partners Carousel editor at `/admin/pages/home/sections/partners-carousel` and its protected saved-version preview.
- Inspect the Contact Section editor at `/admin/pages/home/sections/contact-section-home` and its protected saved-version preview.
- Inspect the global Site Shell editor at `/admin/settings`; the old header/footer editor routes now redirect there. Its saved-version preview is `/admin-preview/site-shell`.
- Inspect the full About page editor at `/admin/pages/about`; legacy About section editor routes redirect there. Its saved-version preview is `/admin-preview/about-page`.
- Inspect the unified Projects editor at `/admin/pages/projects` or `/admin/projects`; legacy Projects section/status routes redirect to it. Its saved-version preview is `/admin-preview/projects-page`.
- Inspect the unified Sister Concerns editor at `/admin/concerns`; legacy Concerns page/section routes redirect to it. Its saved-version preview is `/admin-preview/concerns-page`.
- Inspect the unified Media Center editor at `/admin/articles`; legacy Media page/section and article-detail editor routes use the same workflow. Its saved-version preview is `/admin-preview/media-page`.
- Inspect the unified Career editor at `/admin/careers` or `/admin/pages/career`; legacy Career section and vacancy routes redirect to it. Its saved-version preview is `/admin-preview/career-page`, and applications are managed at `/admin/careers/applications`.
- Inspect the unified Contact editor at `/admin/pages/contact`; legacy Contact section routes redirect there. Its saved-version preview is `/admin-preview/contact-page`, and persisted messages are managed at `/admin/inquiries`.
- Verify one manual edit/save/preview/publish cycle if desired; automated database and protected-route workflow checks have already passed.
- No push, merge, pull request, or deployment is authorized.

## Remaining scope

- Every page-level Home section is dynamic end to end, including real Home layout-request submission.
- Home, its global shell, About, Projects, Concerns, Media Center, Career, and Contact are complete. Every audited public content surface now has a database -> admin -> draft/publish -> public path, and all audited public forms persist through validated server endpoints.
- Chairman Message and Sister Concerns remain excluded from Home because they are not present on the current public Home page.

The duplicated documents under `website/docs/` are historical mirrors. This top-level document is the current source of truth through Phase 7.
