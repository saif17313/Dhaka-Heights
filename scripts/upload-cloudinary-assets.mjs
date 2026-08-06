import { v2 as cloudinary } from 'cloudinary';
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

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseSecretKey);

const assetsDir = path.resolve(__dirname, '../public/assets');
const rootFolder = process.env.CLOUDINARY_ROOT_FOLDER || 'dhaka-heights/dev';

async function main() {
  console.log('🚀 Batch uploading local /assets/ to Cloudinary folder:', rootFolder);

  if (!fs.existsSync(assetsDir)) {
    console.error('❌ Assets directory not found:', assetsDir);
    return;
  }

  const files = fs.readdirSync(assetsDir);
  let uploadedCount = 0;

  for (const file of files) {
    if (file.match(/\.(png|jpg|jpeg|webp|svg)$/i)) {
      const filePath = path.join(assetsDir, file);
      console.log(`📤 Uploading: ${file}...`);

      try {
        const result = await cloudinary.uploader.upload(filePath, {
          folder: rootFolder,
          use_filename: true,
          unique_filename: false,
          overwrite: true,
        });

        console.log(`✓ Cloudinary Uploaded: ${result.public_id} (${result.secure_url})`);

        // Record in Supabase media_assets table
        await supabase.from('media_assets').upsert(
          {
            public_id: result.public_id,
            secure_url: result.secure_url,
            resource_type: result.resource_type,
            format: result.format,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            original_filename: file,
            display_name: file,
            folder: rootFolder,
          },
          { onConflict: 'public_id' }
        );

        uploadedCount++;
      } catch (err) {
        console.warn(`⚠️ Warning uploading ${file}:`, err.message);
      }
    }
  }

  console.log('==================================================');
  console.log(`🎉 CLOUDINARY ASSETS BATCH UPLOAD COMPLETED!`);
  console.log(`• Total Assets Uploaded to Cloudinary (${rootFolder}): ${uploadedCount}`);
  console.log('==================================================');
}

main().catch((err) => {
  console.error('Batch upload error:', err);
});
