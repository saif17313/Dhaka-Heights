import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

const lintTargets = [
  'scripts/verify-customer-reviews.mjs',
  'src/app/media-center/page.js',
  'src/app/media-center/customer-reviews/[slug]/page.js',
  'src/app/admin/media/customer-reviews/page.js',
  'src/app/admin/media/customer-reviews/loading.js',
  'src/app/admin/media/customer-reviews/error.js',
  'src/app/admin/media/customer-reviews/new/page.js',
  'src/app/admin/media/customer-reviews/[id]/page.js',
  'src/components/MediaCenterClient.js',
  'src/components/YouTubeThumbnail.js',
  'src/components/CustomerReviewCard.js',
  'src/components/CustomerReviewDetail.js',
  'src/components/admin/CustomerReviewsAdminList.js',
  'src/components/admin/CustomerReviewEditor.js',
  'src/components/admin/MediaLibrary.js',
  'src/lib/adminNavRegistry.js',
  'src/lib/youtube.js',
  'src/lib/customerReviewsRepository.js',
  'src/lib/customerReviewsActions.js',
];

const known = new Set(Object.keys(process.env));
for (const filename of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (match) known.add(match[1]);
  }
}

const missing = required.filter((name) => !known.has(name));
if (missing.length) {
  console.error(`Missing required environment variable names: ${missing.join(', ')}`);
  process.exit(1);
}
console.log('Required environment variable names are present. Secret values were not printed.');

const eslintCli = resolve(process.cwd(), 'node_modules', 'eslint', 'bin', 'eslint.js');
if (!existsSync(eslintCli)) {
  console.error(`Local ESLint JavaScript CLI was not found at ${eslintCli}. Run npm install first.`);
  process.exit(1);
}

console.log(`\n> ${process.execPath} ${eslintCli} ${lintTargets.join(' ')}`);
let result = spawnSync(process.execPath, [eslintCli, ...lintTargets], { stdio: 'inherit', shell: false });
if (result.error || result.status !== 0) {
  if (result.error) console.error(result.error.message);
  process.exit(result.status || 1);
}

function resolveNpmCli() {
  const nodeDirectory = dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    join(nodeDirectory, 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    resolve(nodeDirectory, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    resolve(nodeDirectory, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean);
  return candidates.find((candidate) => candidate.endsWith('npm-cli.js') && existsSync(candidate)) || null;
}

const npmCli = resolveNpmCli();
if (npmCli) {
  console.log(`\n> ${process.execPath} ${npmCli} run build`);
  result = spawnSync(process.execPath, [npmCli, 'run', 'build'], { stdio: 'inherit', shell: false });
} else if (process.platform === 'win32') {
  const commandProcessor = process.env.ComSpec || 'cmd.exe';
  console.log('\n> npm.cmd run build');
  result = spawnSync(commandProcessor, ['/d', '/s', '/c', 'npm.cmd run build'], { stdio: 'inherit', shell: false });
} else {
  console.log('\n> npm run build');
  result = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: false });
}
if (result.error || result.status !== 0) {
  if (result.error) console.error(result.error.message);
  process.exit(result.status || 1);
}

console.log('\nCustomer Reviews verification completed successfully.');
