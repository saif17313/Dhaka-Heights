# Dhaka Heights

Deployment-ready repository for the Dhaka Heights public website and admin panel.

## Repository layout

- `src/` — Next.js App Router application, admin panel, server actions, repositories, APIs, and shared components.
- `public/` — runtime static assets served from `/`.
- `supabase/migrations/` — canonical ordered database migrations.
- `supabase/seed.sql` — project seed data.
- `scripts/` — migration, audit, Cloudinary, database, and customer-review verification utilities.
- `docs/` — architecture, CMS, validation, and fix documentation.

The former outer `website/` wrapper has been removed. `package.json`, `src/`, `public/`, and `supabase/` now live at the repository root so GitHub and Vercel can detect the Next.js application directly.

## Local setup

Requirements:

- Node.js 22 LTS recommended.
- npm 10 or newer.
- Access to the existing Supabase and Cloudinary environments.

```powershell
Copy-Item .env.example .env.local
# Fill .env.local locally; never commit it.
npm ci
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000`.

## Required environment variables

```text
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
CLOUDINARY_UPLOAD_PRESET
CLOUDINARY_ROOT_FOLDER
```

`SUPABASE_SECRET_KEY` and `CLOUDINARY_API_SECRET` are server-only credentials. They must never use the `NEXT_PUBLIC_` prefix.

## Verification commands

```powershell
npm ci
npm run lint
npm run build
npm run verify:customer-reviews
node scripts/audit-security.mjs
```

The database verification/migration scripts can contact live services. Run them only against the intended development or deployment environment.

## Deployment

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the exact clean GitHub and Vercel workflow.
