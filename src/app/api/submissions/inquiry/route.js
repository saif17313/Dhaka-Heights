import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublishedProject } from '@/lib/projectsPageRepository';

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
    const phone = clean(body?.phone);
    const email = clean(body?.email).toLowerCase();
    const message = clean(body?.message);
    const projectSlug = clean(body?.project_slug);
    if (!fullName || fullName.length > 120) return NextResponse.json({ error: 'Please provide a valid name.' }, { status: 400 });
    if (phone.length < 8 || phone.length > 40 || !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(phone)) return NextResponse.json({ error: 'Please provide a valid phone number.' }, { status: 400 });
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    if (message.length > 2000) return NextResponse.json({ error: 'Message must be 2,000 characters or fewer.' }, { status: 400 });
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug)) return NextResponse.json({ error: 'Please select a valid project.' }, { status: 400 });

    const published = await getPublishedProject(projectSlug);
    if (!published) return NextResponse.json({ error: 'The selected project is not currently available.' }, { status: 400 });
    const { project } = published;
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('inquiries').insert({
      submission_type: 'project_inquiry', full_name: fullName, email: email || null, phone,
      subject: `Project Inquiry: ${project.name}`, project_id: project.projectId,
      message: message || `Callback request for ${project.name}.`, status: 'new',
    }).select('id').single();
    if (error) {
      console.error('Database insertion error for project inquiry:', error);
      return NextResponse.json({ error: 'Your inquiry could not be recorded. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: 'Your inquiry has been registered.', inquiryId: data.id });
  } catch (error) {
    console.error('Project inquiry submission API error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during submission.' }, { status: 500 });
  }
}
