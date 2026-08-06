import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const attemptsByAddress = new Map();

const CATEGORY_LABELS = {
  residential: 'Residential',
  commercial: 'Commercial',
  'mixed-use': 'Mixed-Use',
  other: 'Other',
};

function clean(value) { return typeof value === 'string' ? value.trim() : ''; }
function clientAddress(request) { return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown'; }
function isRateLimited(address) {
  const now = Date.now();
  const recent = (attemptsByAddress.get(address) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now); attemptsByAddress.set(address, recent); return recent.length > MAX_REQUESTS;
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (clean(body?.honeypot)) return NextResponse.json({ success: true, message: 'Inquiry received' });
    if (isRateLimited(clientAddress(request))) return NextResponse.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429 });

    const landownerName = clean(body?.landowner_name);
    const email = clean(body?.email).toLowerCase();
    const contactNumber = clean(body?.contact_number);
    const locality = clean(body?.locality);
    const address = clean(body?.address);
    const sizeOfLand = clean(body?.size_of_land);
    const roadWidth = clean(body?.road_width);
    const category = clean(body?.category);
    const facing = clean(body?.facing);
    const attractiveFeatures = clean(body?.attractive_features);

    if (!landownerName || landownerName.length > 120) return NextResponse.json({ error: "Please provide the landowner's name." }, { status: 400 });
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    if (contactNumber.length < 8 || contactNumber.length > 40 || !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(contactNumber)) return NextResponse.json({ error: 'Please provide a valid contact number.' }, { status: 400 });
    if (!address || address.length > 220) return NextResponse.json({ error: 'Please provide the land address.' }, { status: 400 });
    if (!sizeOfLand || sizeOfLand.length > 60) return NextResponse.json({ error: 'Please provide the size of the land.' }, { status: 400 });
    if (!roadWidth || roadWidth.length > 60) return NextResponse.json({ error: 'Please provide the road width in front of the land.' }, { status: 400 });
    if (!CATEGORY_LABELS[category]) return NextResponse.json({ error: 'Please select a valid property category.' }, { status: 400 });
    if (!facing || facing.length > 60) return NextResponse.json({ error: 'Please provide the facing direction of the land.' }, { status: 400 });
    if (locality.length > 160) return NextResponse.json({ error: 'Locality must be 160 characters or fewer.' }, { status: 400 });
    if (attractiveFeatures.length > 500) return NextResponse.json({ error: 'Attractive features must be 500 characters or fewer.' }, { status: 400 });

    const message = [
      locality && `Locality: ${locality}`,
      `Address: ${address}`,
      `Size of land: ${sizeOfLand} katha`,
      `Road width in front: ${roadWidth} ft`,
      `Property category: ${CATEGORY_LABELS[category]}`,
      `Facing: ${facing}`,
      attractiveFeatures && `Attractive features: ${attractiveFeatures}`,
    ].filter(Boolean).join('\n');

    const supabase = createAdminClient();
    const { data, error } = await supabase.from('inquiries').insert({
      submission_type: 'landowner_lead',
      full_name: landownerName,
      email,
      phone: contactNumber,
      subject: `Landowner Submission · ${CATEGORY_LABELS[category]} · ${address}`,
      message,
      status: 'new',
    }).select('id').single();
    if (error) {
      console.error('Database insertion error for landowner submission:', error);
      return NextResponse.json({ error: 'Your submission could not be recorded. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: 'Your land submission has been recorded.', inquiryId: data.id });
  } catch (error) {
    console.error('Landowner submission API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during submission.' }, { status: 500 });
  }
}
