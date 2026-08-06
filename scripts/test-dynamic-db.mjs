import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local natively
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        process.env[key] = value;
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error('❌ Supabase credentials missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey);

async function checkDynamicTables() {
  console.log('==================================================');
  console.log('🔍 CHECKING SUPABASE & CLOUDINARY DYNAMIC DATA...');
  console.log('==================================================');

  const tables = [
    'site_settings',
    'projects',
    'concerns',
    'media_posts',
    'job_openings',
    'inquiries',
    'media_assets',
    'pages',
  ];

  for (const table of tables) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' })
        .limit(3);

      if (error) {
        console.error(`❌ Table "${table}": Error - ${error.message}`);
      } else {
        console.log(`✓ Table "${table}": ${count} records found.`);
        if (data && data.length > 0) {
          const sample = data[0];
          const sampleName = sample.name || sample.title || sample.slug || sample.id;
          console.log(`   Sample Record: "${sampleName}"`);
        }
      }
    } catch (err) {
      console.error(`❌ Table "${table}": Exception - ${err.message}`);
    }
  }

  console.log('==================================================');
  console.log('✅ DYNAMIC SUPABASE DATA CHECK COMPLETED');
  console.log('==================================================');
}

checkDynamicTables();
