# GitHub and Vercel Deployment

## 1. Extract to a new folder

Do not overwrite the old working folder. Example:

```powershell
New-Item -ItemType Directory -Force "E:\projects\Dhaka-Heights-Deployment-Ready"
```

Extract this package into that directory. The extracted directory itself must contain `package.json`, `src`, and `public`.

## 2. Restore local environment values

The package intentionally excludes `.env.local`.

Copy the existing local file only on your computer:

```powershell
Copy-Item -LiteralPath "E:\projects\Backup 2\Dhaka-Heights\website\.env.local" `
  -Destination "E:\projects\Dhaka-Heights-Deployment-Ready\.env.local"
```

Confirm it remains ignored:

```powershell
git check-ignore .env.local
```

Expected output: `.env.local`.

## 3. Clean local verification

From the new project root:

```powershell
Set-Location "E:\projects\Dhaka-Heights-Deployment-Ready"
Remove-Item -Recurse -Force node_modules,.next -ErrorAction SilentlyContinue
npm ci
npm run lint
npm run build
```

Do not continue to deployment if lint or build fails.

Optional application-specific checks:

```powershell
npm run verify:customer-reviews
node scripts/audit-security.mjs
```

## 4. Start a new Git history

This package contains no old `.git` directory and no previous branch history.

```powershell
git init
git branch -M main
git add .
git status
```

Before committing, verify that these are absent from `git status`:

```text
.env.local
node_modules
.next
supabase/.temp
old fix-package folders
old backup folders
```

Commit:

```powershell
git commit -m "Initial deployment-ready Dhaka Heights application"
```

## 5. Push to a new GitHub repository

Create an empty GitHub repository without adding a README, `.gitignore`, or license. Then run:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

Verify the GitHub root directly shows:

```text
package.json
src/
public/
supabase/
```

There must not be another required `website/` level.

## 6. Import into Vercel

- Import the new GitHub repository.
- Framework preset: Next.js.
- Root directory: repository root (`./`).
- Install command: `npm ci`.
- Build command: `npm run build`.
- Output directory: leave unset for Next.js.

Add every variable from `.env.example` under the Vercel project environment settings. Use the real values from your local `.env.local`; do not upload the file itself.

Set `NEXT_PUBLIC_SITE_URL` to the final production domain after the domain is known, then redeploy.

## 7. Backend continuity

The application remains connected to the same Supabase and Cloudinary environments when the same environment-variable values are configured.

Do not create a second database or re-run all migrations blindly. The canonical migration directory contains 23 ordered migrations through:

```text
20260805000022_customer_reviews.sql
```

Apply only migrations that are genuinely missing from the target Supabase project. Keep `supabase/.temp` local and untracked.

## 8. Post-deployment checks

Verify at minimum:

1. Public home, About, Projects, Concerns, Media Center, Career, and Contact pages.
2. Admin login and authorization redirects.
3. Admin media listing and Cloudinary signed upload.
4. Contact and quick-inquiry submissions.
5. Customer-review list, create/edit, preview selection, publish, detail page, YouTube thumbnail, and image lightbox.
6. Mobile navigation and responsive layouts.
7. No secret values or `.env.local` in the GitHub repository.
