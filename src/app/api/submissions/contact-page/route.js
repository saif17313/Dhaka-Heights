import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublishedContactPage } from '@/lib/contactPageRepository';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const attemptsByAddress = new Map();

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

    const fullName = clean(body?.full_name);
    const email = clean(body?.email).toLowerCase();
    const phone = clean(body?.phone);
    const subjectValue = clean(body?.subject);
    const message = clean(body?.message);
    if (!fullName || fullName.length > 120) return NextResponse.json({ error: 'Please provide a valid name.' }, { status: 400 });
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    if (phone.length < 8 || phone.length > 40 || !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(phone)) return NextResponse.json({ error: 'Please provide a valid phone number.' }, { status: 400 });
    if (!message || message.length > 2000) return NextResponse.json({ error: 'Please provide a message of 2,000 characters or fewer.' }, { status: 400 });

    const page = await getPublishedContactPage();
    const subject = page.content.subjectOptions.find((item) => item.isVisible !== false && item.value === subjectValue);
    if (!subject) return NextResponse.json({ error: 'Please select a valid inquiry subject.' }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin.from('inquiries').insert({ submission_type: 'contact', full_name: fullName, email: email || null, phone, subject: subject.label, message, status: 'new' }).select('id').single();
    if (error) {
      console.error('Database insertion error for Contact page inquiry:', error);
      return NextResponse.json({ error: 'Your message could not be recorded. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: 'Your message has been recorded.', inquiryId: data.id });
  } catch (error) {
    console.error('Contact page submission API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during submission.' }, { status: 500 });
  }
}
