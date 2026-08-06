# Restructure Manifest

## Source package reviewed

`Dhaka-Heights(2).zip`

## Structural decisions

- Flattened `website/` into the repository root.
- Removed the old `.git` directory and all previous branch/history metadata.
- Removed both copies of `.env.local` from the deliverable.
- Kept one sanitized root `.env.example`.
- Selected top-level `supabase/` as canonical because it contains the complete 23-migration sequence; excluded `supabase/.temp` linked-project state.
- Merged `website/docs/` with the newer top-level documentation and all Fix 01–08 records.
- Selected `website/scripts/` as the complete script set, overlaid the matching top-level scripts, and removed three temporary `_tmp_audit` scripts.
- Removed the unused top-level `website/assets/` duplicate directory. Runtime assets remain under `public/assets/`; source and scripts reference that public directory.
- Excluded generated output, dependencies, backups, extracted fix packages, and archives through `.gitignore`.

## Runtime continuity

No application route, component, repository, migration, public asset path, package dependency, or environment-variable name was intentionally changed by the restructure.

## Validation performed in the packaging environment

- Confirmed `package.json`, `src/`, `public/`, `scripts/`, `docs/`, and the full canonical `supabase/` tree exist at repository root.
- Confirmed no `.git`, `.env.local`, `node_modules`, `.next`, `supabase/.temp`, `_static_backup`, or temporary audit scripts are included.
- Confirmed runtime source contains no hard-coded Windows project path or dependency on the former outer `website/` directory.
- Confirmed JavaScript/JSX/MJS files are syntactically parseable using the TypeScript parser.

A full `npm ci`/ESLint/Next.js production build could not be completed inside the packaging sandbox because its internal npm mirror returned HTTP 404 for a transitive package (`zod-validation-error@4.0.2`). This is an environment registry failure, not a confirmed application failure. Run the exact local verification commands in `DEPLOYMENT.md` before pushing.
