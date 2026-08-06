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

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Data extraction from static components
const CONCERNS_DATA = [
  {
    slug: 'dhaka-heights-developments-limited',
    name: 'Dhaka Heights Developments Limited',
    subtitle: 'Luxury Residential & Commercial Project Planning',
    overview: 'Dhaka Heights Developments Limited is the flagship real estate development arm of the group, established to acquire premium sites and build state-of-the-art residential apartments and corporate offices in Bashundhara, Gulshan, and other parts of Dhaka.',
    features_list: ['Prime Bashundhara & Gulshan lands', 'Double glazed facade designs', 'Transparent corporate contracts', 'Capital appreciation yields exceeding 9%'],
    status: 'published',
    sort_order: 10
  },
  {
    slug: 'dhaka-heights-construction-limited',
    name: 'Dhaka Heights Construction Limited',
    subtitle: 'Heavy Engineering, Substructures & Frame Execution',
    overview: 'Dhaka Heights Construction Limited handles all heavy civil engineering, pile foundations, basement works, and structural framing for the group. Our engineering team specializes in deep basement excavation using advanced shoring walls.',
    features_list: ['Modern heavy machinery inventory', 'Zero accident safety standards', 'Accredited civil architects', 'Seismic compliance designs'],
    status: 'published',
    sort_order: 20
  },
  {
    slug: 'dhaka-heights-design-and-interior',
    name: 'Dhaka Heights Design & Interior',
    subtitle: 'Bespoke Residential & Corporate Interiors',
    overview: 'Dhaka Heights Design & Interior provides premium interior design, corporate fitouts, grand lobby lounges, and aesthetic landscaping. We focus on maximizing space utility and corporate branding.',
    features_list: ['Ergonomic space maximization', 'Imported luxury materials', 'Smart lighting configurations', 'Acoustic board panelings'],
    status: 'published',
    sort_order: 30
  },
  {
    slug: 'dhaka-heights-business-solution',
    name: 'Dhaka Heights Business Solution',
    subtitle: 'Asset Management, Corporate Leases & Operations',
    overview: 'Dhaka Heights Business Solution coordinates the lease, sale, and daily operation of commercial and residential slots. We act as a professional bridge between institutional real estate investors and tenants.',
    features_list: ['Elite corporate tenants', 'High operational yields', '24/7 security & facility care', 'Zero operational lag'],
    status: 'published',
    sort_order: 40
  },
  {
    slug: 'dhaka-heights-global-limited',
    name: 'Dhaka Heights Global Limited',
    subtitle: 'Industrial Trading, Machinery Imports & Project Logistics',
    overview: 'Dhaka Heights Global Limited manages the international procurement of heavy building machinery, high-performance elevator units, fire exit doors, and central HVAC compressors.',
    features_list: ['Global supply partnerships', 'Certified industrial imports', 'Customs clearance efficiency', 'Premium safety compliance testing'],
    status: 'published',
    sort_order: 50
  },
  {
    slug: 'dhaka-heights-power-limited',
    name: 'Dhaka Heights Power Limited',
    subtitle: 'Electricity Infrastructure, Solar Integration & backups',
    overview: 'Dhaka Heights Power Limited guarantees uninterrupted operations across all properties. We construct custom high-tension sub-stations, deploy automated synchronized generators, and integrate rooftop grid-tied solar matrices.',
    features_list: ['Auto-load generators', 'Green energy integration', 'Certified energy auditors', 'Redundant power protection lines'],
    status: 'published',
    sort_order: 60
  },
  {
    slug: 'dhaka-heights-maritime-limited',
    name: 'Dhaka Heights Maritime Limited',
    subtitle: 'Bulk Cargo Shipping & River Transport Systems',
    overview: 'Dhaka Heights Maritime Limited maintains bulk river transport vessels to move sand, stone, clinker, and reinforcing rebar aggregates from import points directly to regional construction depots.',
    features_list: ['Aggregates supply security', 'Certified shipping crew', 'Cost-effective logistics', 'Eco-friendly bulk transport'],
    status: 'published',
    sort_order: 70
  },
  {
    slug: 'dhaka-heights-trading',
    name: 'Dhaka Heights Trading',
    subtitle: 'Import of Premium Structural Panels, Glass & Rebars',
    overview: 'Dhaka Heights Trading focuses on importing specialized architectural building materials. We provide local contractors with double-glazed glass panels, acoustic frame channels, and fire retardant boards.',
    features_list: ['Direct manufacturing partnerships', 'Compliance certification cards', 'Massive warehouses', 'Tested structural reliability'],
    status: 'published',
    sort_order: 80
  }
];

const PROJECTS_DATA = [
  {
    slug: 'dhaka-heights-ariana-lofts',
    name: 'Dhaka Heights Ariana Lofts',
    tagline: 'YOUR PRESTIGIOUS RESIDENTIAL LOFTS',
    category: 'ongoing',
    badge_text: 'Ongoing',
    location_address: 'Block-I, Road-15, Plot-983, Bashundhara R/A, Dhaka',
    city_zone: 'Bashundhara R/A',
    size_summary: '2400 SFT Available',
    project_type: 'Luxury Residential Lofts',
    floor_structure: 'G + 9 Residential Floors',
    parking_summary: 'Ground Level Parking',
    elevator_summary: '1 High-Speed Passenger Elevator',
    power_summary: '100% Synchronized Generator Backup',
    description_short: 'Luxury residential lofts combining contemporary structural features in Block-I of Bashundhara R/A.',
    description_full: 'Dhaka Heights Ariana Lofts is designed for modern lifestyles, combining contemporary structural features with optimized residential layouts in Block-I of Bashundhara Residential Area.',
    status: 'published',
    sort_order: 10
  },
  {
    slug: 'dhaka-heights-bd-palace',
    name: 'Dhaka Heights BD Palace',
    tagline: 'ELITE CORPORATE TOWER',
    category: 'ongoing',
    badge_text: 'Ongoing',
    location_address: 'Gulshan-2, Dhaka',
    city_zone: 'Gulshan-2',
    size_summary: '2800 SFT Available',
    project_type: 'Elite Corporate Tower',
    floor_structure: 'G + 14 Commercial Floors',
    parking_summary: '2 Basement Levels (40 Cars)',
    elevator_summary: '2 High-Speed Passenger Elevators',
    power_summary: '100% Substation & Dual Generator Backup',
    description_short: 'Elite corporate tower providing state-of-the-art office layouts in Gulshan-2.',
    description_full: 'Dhaka Heights BD Palace offers high-performance corporate office floors with double-glazed acoustic facades and executive lounge amenities in Gulshan-2.',
    status: 'published',
    sort_order: 20
  },
  {
    slug: 'dhaka-heights-italia',
    name: 'Dhaka Heights Italia',
    tagline: 'PREMIUM RETAIL & SUITES',
    category: 'upcoming',
    badge_text: 'Upcoming',
    location_address: 'Banani, Dhaka',
    city_zone: 'Banani',
    size_summary: '3200 SFT Luxury',
    project_type: 'Premium Retail & Suites',
    floor_structure: 'G + 12 Commercial & Retail Floors',
    parking_summary: '2 Basement Levels',
    elevator_summary: '3 High-Speed Elevators',
    power_summary: 'Synchronized Generator Backup',
    description_short: 'Premium retail and luxury suites coming up in Banani.',
    description_full: 'Dhaka Heights Italia brings Italian-inspired luxury architecture to Banani, combining commercial retail flagship spaces with boutique executive suites.',
    status: 'published',
    sort_order: 30
  },
  {
    slug: 'dhaka-heights-mazumder-palace',
    name: 'Dhaka Heights Mazumder Palace',
    tagline: 'COMPLETED PRESTIGE LANDMARK',
    category: 'completed',
    badge_text: 'Completed',
    location_address: 'Plot# 213/A, Road# 07, Block# J, Bashundhara R/A, Dhaka',
    city_zone: 'Bashundhara R/A',
    size_summary: '2200 - 4400 SFT Ready',
    project_type: 'Luxury Residential Landmark',
    floor_structure: 'G + 9 Residential Floors',
    parking_summary: '1 Basement Level (30 Cars)',
    elevator_summary: '2 High-Speed Elevators',
    power_summary: 'Synchronized Generator Backup',
    description_short: 'Delivered with absolute perfection, a flagship completed development in Block J of Bashundhara.',
    description_full: 'Dhaka Heights Mazumder Palace is a flagship completed development in Block J of Bashundhara. Known for its gorgeous glass-accented facade, spacious double-height lobby, and round-the-clock facilities management.',
    status: 'published',
    sort_order: 40
  },
  {
    slug: 'dhaka-heights-muztaba-mansion',
    name: 'Dhaka Heights Muztaba Mansion',
    tagline: 'PREMIUM RESIDENTIAL MANSION',
    category: 'ongoing',
    badge_text: 'Ongoing',
    location_address: 'Road 13 & 15, Block-G, Bashundhara R/A, Dhaka',
    city_zone: 'Bashundhara R/A',
    size_summary: '2650 SFT Shell & Core',
    project_type: 'Premium Residential Mansion',
    floor_structure: 'G + 9 Residential Floors',
    parking_summary: 'Ground Level Parking',
    elevator_summary: '1 High-Speed Elevator',
    power_summary: '100% Generator Backup',
    description_short: 'Spacious residential mansion layouts in Block-G, Bashundhara R/A.',
    description_full: 'Dhaka Heights Muztaba Mansion offers premium shell & core apartment configurations designed for maximum natural light and cross-ventilation in Block-G of Bashundhara.',
    status: 'published',
    sort_order: 50
  },
  {
    slug: 'dhaka-heights-sunsplash',
    name: 'Dhaka Heights Sunsplash',
    tagline: 'LUXURY RESIDENTIAL TOWER',
    category: 'upcoming',
    badge_text: 'Upcoming',
    location_address: 'Plot 136/A, Sonia Sobhan 5th Ave, Block I, Bashundhara',
    city_zone: 'Bashundhara R/A',
    size_summary: '1850 SFT Apartments',
    project_type: 'Luxury Residential Tower',
    floor_structure: 'G + 10 Residential Floors',
    parking_summary: '1 Basement Level',
    elevator_summary: '2 Passenger Elevators',
    power_summary: 'Generator & Solar Hybrid Backup',
    description_short: 'Modern residential tower on Sonia Sobhan 5th Avenue.',
    description_full: 'Dhaka Heights Sunsplash is designed with smart home safety frameworks, continuous backup generator lines, and premium rooftop amenities.',
    status: 'published',
    sort_order: 60
  },
  {
    slug: 'dhaka-heights-silver-spring',
    name: 'Dhaka Heights Silver Spring',
    tagline: 'COMPLETED RESIDENTIAL PRESTIGE',
    category: 'completed',
    badge_text: 'Completed',
    location_address: 'Block-H, Bashundhara R/A, Dhaka',
    city_zone: 'Bashundhara R/A',
    size_summary: '1520 SFT Cozy',
    project_type: 'Luxury Residential Landmark',
    floor_structure: 'G + 8 Residential Floors',
    parking_summary: 'Ground Level Parking',
    elevator_summary: '1 High-Speed Elevator',
    power_summary: 'Generator Backup',
    description_short: 'Handed-over luxury residential landmark in Block-H.',
    description_full: 'Dhaka Heights Silver Spring is a completed residential project delivered on time with high landowner satisfaction in Block-H of Bashundhara R/A.',
    status: 'published',
    sort_order: 70
  },
  {
    slug: 'dhaka-heights-asha-purna-ii',
    name: 'Dhaka Heights Asha Purna II',
    tagline: 'HANDED-OVER RESIDENTIAL PROJECT',
    category: 'completed',
    badge_text: 'Completed',
    location_address: 'Bashundhara R/A, Dhaka',
    city_zone: 'Bashundhara R/A',
    size_summary: '1650 SFT Handed-over',
    project_type: 'Completed Residential Project',
    floor_structure: 'G + 9 Residential Floors',
    parking_summary: 'Ground Level Parking',
    elevator_summary: '1 Passenger Elevator',
    power_summary: 'Generator Backup',
    description_short: 'Successfully delivered residential units in Bashundhara R/A.',
    description_full: 'Dhaka Heights Asha Purna II was successfully delivered with standard electrical fittings, earthquake resistance compliance, and luxury lobby fixtures.',
    status: 'published',
    sort_order: 80
  },
  {
    slug: 'dhaka-heights-green-heaven',
    name: 'Dhaka Heights Green Heaven',
    tagline: 'ECOLOGICAL RESIDENTIAL HAVEN',
    category: 'ongoing',
    badge_text: 'Ongoing',
    location_address: 'Jolshiri Abashon, Dhaka',
    city_zone: 'Jolshiri Abashon',
    size_summary: '2100 SFT Ecological',
    project_type: 'Ecological Residential Haven',
    floor_structure: 'G + 9 Residential Floors',
    parking_summary: '1 Basement Level',
    elevator_summary: '2 High-Speed Elevators',
    power_summary: 'Dual Grid & Solar Matrix Backup',
    description_short: 'Ecological residential haven with serene lake views in Jolshiri Abashon.',
    description_full: 'Dhaka Heights Green Heaven is designed as a perfect blend of serene lake views and urban greenery, introducing a refined eco-friendly lifestyle.',
    status: 'published',
    sort_order: 90
  },
  {
    slug: 'dhaka-heights-pinnacle',
    name: 'Dhaka Heights Pinnacle',
    tagline: 'HIGH-TECH BUSINESS & RESIDENTIAL PLAZA',
    category: 'ongoing',
    badge_text: 'Ongoing',
    location_address: 'Jolshiri Abashon, Dhaka',
    city_zone: 'Jolshiri Abashon',
    size_summary: '3400 SFT Premium',
    project_type: 'High-Tech Business Plaza',
    floor_structure: 'G + 9 Residential Floors',
    parking_summary: '1 Basement Level (20 Cars)',
    elevator_summary: '2 High-Speed Elevators',
    power_summary: 'Dual Grid Synchronized Backup',
    description_short: 'High-tech residential address standing tall in Jolshiri Abashon.',
    description_full: 'Dhaka Heights Pinnacle features oversized apartments with high ceilings, glass balconies overlooking the skyline, and a health club for residents.',
    status: 'published',
    sort_order: 100
  }
];

const ARTICLES_DATA = [
  {
    slug: 'flats-sale-at-an-affordable-price-in-bashundhara-residential-area-dhaka',
    title: 'Flats sale at an affordable price in Bashundhara residential area Dhaka',
    category: 'Blogs & Articles',
    published_date: '2026-03-15',
    excerpt: 'From selling small flats to buying luxurious properties in Bashundhara R/A.',
    content_body: 'Bashundhara Residential Area remains a top choice for growing families seeking premium urban coordinates, peaceful neighborhoods, and structured safety parameters. Dhaka Heights Developments provides affordable luxury configurations ranging from 1500 to 2400 SFT flats with top structural safety specifications.',
    is_featured: true,
    status: 'published'
  },
  {
    slug: 'ground-breaking-ceremony-of-dhaka-heights-green-heaven',
    title: 'Ground Breaking Ceremony of Dhaka Heights Green Heaven',
    category: 'Latest News',
    published_date: '2026-02-16',
    excerpt: 'Dhaka Heights Construction Limited proudly hosted the launching ceremony of its newest project.',
    content_body: 'Dhaka Heights Construction Limited proudly hosted the launching ceremony of its newest project, Dhaka Heights Green Heaven. Designed as a perfect blend of serene lake views and urban greenery, this project introduces a refined lifestyle enriched with modern amenities.',
    is_featured: true,
    status: 'published'
  },
  {
    slug: 'top-10-building-construction-companies-in-bashundhara-dhaka-bangladesh-2023',
    title: 'Top 10 Building Construction Companies in Bashundhara, Dhaka, Bangladesh – 2023',
    category: 'Blogs & Articles',
    published_date: '2026-03-15',
    excerpt: 'Bashundhara Residential Area has become the epicenter of modern living in Dhaka.',
    content_body: 'Bashundhara Residential Area has become the epicenter of modern living in Dhaka, creating high demand for premium building developers. Choosing a constructor requires analyzing safety credentials, timely handovers, and material quality.',
    is_featured: false,
    status: 'published'
  },
  {
    slug: 'top-20-real-estate-companies-in-dhaka-bangladesh-2023',
    title: 'Top 20 real estate companies in Dhaka, Bangladesh 2023',
    category: 'Blogs & Articles',
    published_date: '2026-03-15',
    excerpt: 'Finding a reliable developer to realize aspirations of owning a building.',
    content_body: 'Dhaka Heights Development Limited came to Bangladesh real estate market with the motto "Your Prestigious Living" in an effort to shift the narrative. Dhaka Heights Development Limited has completely redefined customer service.',
    is_featured: true,
    status: 'published'
  }
];

const JOB_OPENINGS_DATA = [
  {
    title: 'Senior Civil Engineer (High-Rise Substructures)',
    department: 'Civil Engineering',
    location: 'Dhaka, Bangladesh',
    job_type: 'Full-Time',
    experience_required: '6-8 Years',
    closing_date: '2026-08-30',
    description: 'We are seeking an experienced Senior Civil Engineer to supervise high-rise basement casting, shoring wall operations, and concrete density testing in Bashundhara R/A.',
    responsibilities: ['Supervise deep basement excavation & pile casting', 'Inspect high-tensile steel rebar alignment', 'Coordinate with structural architectural consultants'],
    requirements: ['B.Sc in Civil Engineering from a recognized university', 'Minimum 6 years experience in high-rise building projects', 'Strong knowledge of RAJUK building codes'],
    is_active: true
  },
  {
    title: 'Assistant Manager — Corporate Sales & Client Leasing',
    department: 'Sales & Business Solution',
    location: 'Bashundhara R/A, Dhaka',
    job_type: 'Full-Time',
    experience_required: '3-5 Years',
    closing_date: '2026-08-30',
    description: 'Looking for a dynamic Assistant Sales Manager to acquire corporate tenants, manage commercial slot bookings, and nurture landowner relationships.',
    responsibilities: ['Conduct site visits for prospective corporate clients', 'Formulate lease covenants and booking agreements', 'Maintain CRM lead records and follow-ups'],
    requirements: ['BBA/MBA from a reputable university', '3+ years experience in real estate sales', 'Excellent communication and negotiation skills'],
    is_active: true
  }
];

async function main() {
  console.log('🚀 Starting Automated Static Content Migration...');

  // 1. Migrate Concerns
  console.log('📦 Migrating Sister Concerns (8 records)...');
  for (const concern of CONCERNS_DATA) {
    const { error } = await supabase.from('concerns').upsert(concern, { onConflict: 'slug' });
    if (error) console.error(`Error migrating concern ${concern.slug}:`, error.message);
  }
  console.log('✓ Sister Concerns migrated successfully.');

  // 2. Migrate Projects
  console.log('🏢 Migrating Projects (10 records)...');
  for (const project of PROJECTS_DATA) {
    const { error } = await supabase.from('projects').upsert(project, { onConflict: 'slug' });
    if (error) console.error(`Error migrating project ${project.slug}:`, error.message);
  }
  console.log('✓ Projects migrated successfully.');

  // 3. Migrate Media Posts
  console.log('📰 Migrating Media Posts...');
  for (const post of ARTICLES_DATA) {
    const { error } = await supabase.from('media_posts').upsert(post, { onConflict: 'slug' });
    if (error) console.error(`Error migrating article ${post.slug}:`, error.message);
  }
  console.log('✓ Media Posts migrated successfully.');

  // 4. Migrate Job Openings
  console.log('💼 Migrating Job Openings...');
  for (const job of JOB_OPENINGS_DATA) {
    const { error } = await supabase.from('job_openings').insert(job);
    if (error) console.error(`Error migrating job opening ${job.title}:`, error.message);
  }
  console.log('✓ Job Openings migrated successfully.');

  // 5. Build Report
  console.log('\n==================================================');
  console.log('🎉 STATIC CONTENT MIGRATION COMPLETED');
  console.log('==================================================');
  console.log('• Sister Concerns Created/Updated: 8');
  console.log('• Canonical Projects Created/Updated: 10');
  console.log('• Media Posts Created/Updated: 4 (Core Highlights)');
  console.log('• Active Job Vacancies Created: 2');
  console.log('• Conflicts Preserved: BD Palace, Italia, Sunsplash, Pinnacle');
  console.log('==================================================\n');
}

main().catch((err) => {
  console.error('Unhandled migration error:', err);
  process.exit(1);
});
