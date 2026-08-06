import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local natively without external dependencies
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

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('🚀 Initializing Supabase Foundation setup...');

  // 1. Verify Private Storage Bucket 'career-resumes'
  console.log('📦 Checking storage bucket: career-resumes...');
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error('❌ Error listing storage buckets:', listError.message);
  } else {
    const existingBucket = buckets.find((b) => b.name === 'career-resumes');
    if (existingBucket) {
      console.log('✓ Storage bucket "career-resumes" already exists (Public:', existingBucket.public, ')');
    } else {
      console.log('Creating private storage bucket "career-resumes"...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('career-resumes', {
        public: false,
        fileSizeLimit: 10485760, // 10MB limit
        allowedMimeTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError.message);
      } else {
        console.log('✓ Private storage bucket "career-resumes" created successfully.');
      }
    }
  }

  // 2. Connection and Table Status Check
  console.log('🔍 Testing Supabase API connection...');
  const { data: testData, error: testError } = await supabase.from('site_settings').select('count');
  if (testError) {
    console.log('ℹ️ Table check notification:', testError.message, '(Tables can be initialized via SQL migration or Dashboard CLI)');
  } else {
    console.log('✓ Supabase connection verified successfully!');
  }

  console.log('✅ Supabase foundation setup complete.');
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
