import 'server-only';

import { createClient as createBrowserClient } from '@/lib/supabase/client';
import { createAdminClient } from '@/lib/supabase/admin';

// Static fallbacks matching existing components
const FALLBACK_SITE_SETTINGS = {
  site_title: 'Dhaka Heights Properties Limited',
  tagline: 'YOUR PRESTIGIOUS LIVING',
  company_name: 'Dhaka Heights Properties Limited',
  founding_year: 2008,
  primary_phone: '+880 1928 222777',
  secondary_phone: '+880 1711 000000',
  primary_email: 'info@dhakaheights.com',
  sales_email: 'sales@dhakaheights.com',
  office_address: 'House 14, Road 03, Block I, Bashundhara R/A, Dhaka-1229',
};

const FALLBACK_PROJECTS = [
  {
    id: 'dhaka-heights-ariana-lofts',
    slug: 'dhaka-heights-ariana-lofts',
    category: 'ongoing',
    badgeText: 'Ongoing',
    image: '/assets/proj_ariana_lofts.png',
    location: 'Block-I, Road-15, Bashundhara R/A, Dhaka',
    name: 'Dhaka Heights Ariana Lofts',
    size: '2400 SFT Available',
    type: 'Luxury Residential Lofts',
  },
  {
    id: 'dhaka-heights-bd-palace',
    slug: 'dhaka-heights-bd-palace',
    category: 'ongoing',
    badgeText: 'Ongoing',
    image: '/assets/proj_bd_palace.png',
    location: 'Gulshan-2, Dhaka',
    name: 'Dhaka Heights BD Palace',
    size: '2800 SFT Available',
    type: 'Elite Corporate Tower',
  },
  {
    id: 'dhaka-heights-italia',
    slug: 'dhaka-heights-italia',
    category: 'upcoming',
    badgeText: 'Upcoming',
    image: '/assets/proj_italia.png',
    location: 'Banani, Dhaka',
    name: 'Dhaka Heights Italia',
    size: '3200 SFT Luxury',
    type: 'Premium Retail & Suites',
  },
  {
    id: 'dhaka-heights-mazumder-palace',
    slug: 'dhaka-heights-mazumder-palace',
    category: 'completed',
    badgeText: 'Completed',
    image: '/assets/proj_mazumder_palace.png',
    location: 'Plot# 213/A, Block# J, Bashundhara R/A',
    name: 'Dhaka Heights Mazumder Palace',
    size: '4200 SFT Ready',
    type: 'Luxury Residential Landmark',
  },
  {
    id: 'dhaka-heights-muztaba-mansion',
    slug: 'dhaka-heights-muztaba-mansion',
    category: 'ongoing',
    badgeText: 'Ongoing',
    image: '/assets/proj_muztaba_mansion.png',
    location: 'Block-G, Bashundhara R/A, Dhaka',
    name: 'Dhaka Heights Muztaba Mansion',
    size: '2650 SFT Shell & Core',
    type: 'Premium Residential Mansion',
  },
  {
    id: 'dhaka-heights-sunsplash',
    slug: 'dhaka-heights-sunsplash',
    category: 'upcoming',
    badgeText: 'Upcoming',
    image: '/assets/proj_sunsplash.png',
    location: 'Block-I, Sonia Sobhan 5th Ave, Bashundhara',
    name: 'Dhaka Heights Sunsplash',
    size: '1850 SFT Apartments',
    type: 'Luxury Residential Tower',
  },
  {
    id: 'dhaka-heights-silver-spring',
    slug: 'dhaka-heights-silver-spring',
    category: 'completed',
    badgeText: 'Completed',
    image: '/assets/proj_silver_spring.png',
    location: 'Block-H, Bashundhara R/A, Dhaka',
    name: 'Dhaka Heights Silver Spring',
    size: '1520 SFT Cozy',
    type: 'Luxury Residential Landmark',
  },
  {
    id: 'dhaka-heights-asha-purna-ii',
    slug: 'dhaka-heights-asha-purna-ii',
    category: 'completed',
    badgeText: 'Completed',
    image: '/assets/proj_asha_purna.png',
    location: 'Bashundhara R/A, Dhaka',
    name: 'Dhaka Heights Asha Purna II',
    size: '1650 SFT Handed-over',
    type: 'Completed Residential Project',
  },
  {
    id: 'dhaka-heights-green-heaven',
    slug: 'dhaka-heights-green-heaven',
    category: 'ongoing',
    badgeText: 'Ongoing',
    image: '/assets/proj_green_heaven.png',
    location: 'Jolshiri Abashon, Dhaka',
    name: 'Dhaka Heights Green Heaven',
    size: '2100 SFT Ecological',
    type: 'Ecological Residential Haven',
  },
  {
    id: 'dhaka-heights-pinnacle',
    slug: 'dhaka-heights-pinnacle',
    category: 'ongoing',
    badgeText: 'Ongoing',
    image: '/assets/proj_pinnacle.png',
    location: 'Jolshiri Abashon, Dhaka',
    name: 'Dhaka Heights Pinnacle',
    size: '3400 SFT Premium',
    type: 'High-Tech Business Plaza',
  },
];

export async function getPublicSiteSettings() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase.from('site_settings').select('*').limit(1).maybeSingle();
    return data || FALLBACK_SITE_SETTINGS;
  } catch (err) {
    return FALLBACK_SITE_SETTINGS;
  }
}

export async function getPublicProjects(category = 'all') {
  try {
    const supabase = createAdminClient();
    let query = supabase.from('projects').select('*').eq('status', 'published').order('sort_order', { ascending: true });

    if (category !== 'all') {
      query = query.eq('category', category);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      return data.map((p) => ({
        id: p.slug,
        slug: p.slug,
        category: p.category,
        badgeText: p.badge_text || p.category,
        image: p.cover_image_id ? p.cover_image_id : '/assets/proj_ariana_lofts.png',
        location: p.location_address,
        name: p.name,
        size: p.size_summary,
        type: p.project_type,
      }));
    }
  } catch (err) {
    // Return fallback if table not yet queried
  }

  return category === 'all'
    ? FALLBACK_PROJECTS
    : FALLBACK_PROJECTS.filter((p) => p.category === category);
}
