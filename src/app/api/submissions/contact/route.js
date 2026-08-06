import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const attemptsByAddress = new Map();

function clientAddress(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function isRateLimited(address) {
  const now = Date.now();
  const recent = (attemptsByAddress.get(address) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now);
  attemptsByAddress.set(address, recent);
  return recent.length > MAX_REQUESTS;
}

function clean(value) { return typeof value === 'string' ? value.trim() : ''; }

export async function POST(request) {
  try {
    const body = await request.json();
    const honeypot = clean(body?.honeypot);
    if (honeypot) return NextResponse.json({ success: true, message: 'Inquiry received' });

    if (isRateLimited(clientAddress(request))) {
      return NextResponse.json({ error: 'Too many requests. Please wait a few minutes and try again.' }, { status: 429 });
    }

    const fullName = clean(body?.full_name);
    const email = clean(body?.email).toLowerCase();
    const phone = clean(body?.phone);
    const spaceRequirement = clean(body?.space_requirement);
    const spaceRequirementLabel = clean(body?.space_requirement_label);
    const requirements = clean(body?.requirements);

    if (!fullName || fullName.length > 120) return NextResponse.json({ error: 'Please provide a valid name.' }, { status: 400 });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    if (phone.length < 8 || phone.length > 40 || !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(phone)) return NextResponse.json({ error: 'Please provide a valid phone number.' }, { status: 400 });
    if (!/^[a-zA-Z0-9_-]{1,60}$/.test(spaceRequirement) || !spaceRequirementLabel || spaceRequirementLabel.length > 100) return NextResponse.json({ error: 'Please select a valid space requirement.' }, { status: 400 });
    if (requirements.length > 2000) return NextResponse.json({ error: 'Requirements must be 2,000 characters or fewer.' }, { status: 400 });

    const message = `Required space: ${spaceRequirementLabel}.${requirements ? `\n\nCorporate requirements: ${requirements}` : ''}`;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('inquiries').insert({
      submission_type: 'layout_request',
      full_name: fullName,
      email,
      phone,
      subject: 'Home Property Layout Request',
      message,
      status: 'new',
    }).select('id').single();

    if (error) {
      console.error('Database insertion error for Home layout request:', error);
      return NextResponse.json({ error: 'Your request could not be recorded. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: 'Your request has been recorded.', inquiryId: data.id });
  } catch (error) {
    console.error('Home Contact submission API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during submission.' }, { status: 500 });
  }
}
