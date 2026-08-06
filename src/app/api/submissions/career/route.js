import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPublishedCareerPage } from '@/lib/careerPageRepository';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const attemptsByAddress = new Map();
const ALLOWED_TYPES = new Set(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value) { return typeof value === 'string' ? value.trim() : ''; }
function clientAddress(request) { return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown'; }
function isRateLimited(address) {
  const now = Date.now();
  const recent = (attemptsByAddress.get(address) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  recent.push(now); attemptsByAddress.set(address, recent); return recent.length > MAX_REQUESTS;
}

export async function POST(request) {
  let uploadedPath = null;
  try {
    const formData = await request.formData();
    if (clean(formData.get('honeypot'))) return NextResponse.json({ success: true, message: 'Application submitted successfully.' });
    if (isRateLimited(clientAddress(request))) return NextResponse.json({ error: 'Too many applications. Please wait a few minutes and try again.' }, { status: 429 });

    const fullName = clean(formData.get('applicant_name'));
    const email = clean(formData.get('email')).toLowerCase();
    const phone = clean(formData.get('phone'));
    const coverLetter = clean(formData.get('cover_letter'));
    const jobId = clean(formData.get('job_id'));
    const file = formData.get('resume');
    if (!fullName || fullName.length > 120) return NextResponse.json({ error: 'Please provide a valid candidate name.' }, { status: 400 });
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    if (phone.length < 8 || phone.length > 40 || !/^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-\s./0-9]*$/.test(phone)) return NextResponse.json({ error: 'Please provide a valid phone number.' }, { status: 400 });
    if (coverLetter.length > 3000) return NextResponse.json({ error: 'Cover letter must be 3,000 characters or fewer.' }, { status: 400 });
    if (!(file instanceof File) || !file.name || file.size < 1) return NextResponse.json({ error: 'Please attach a PDF, DOC, or DOCX resume.' }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'Resume file size must not exceed 5MB.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: 'Only PDF, DOC, and DOCX resume documents are accepted.' }, { status: 400 });

    const careerPage = await getPublishedCareerPage();
    const selectedJob = jobId && UUID.test(jobId) ? careerPage.content.jobs.find((job) => job.jobId === jobId && job.isVisible !== false) : null;
    if (jobId && !selectedJob) return NextResponse.json({ error: 'The selected vacancy is not currently accepting applications.' }, { status: 400 });

    const supabase = createAdminClient();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(-180);
    uploadedPath = `resumes/${crypto.randomUUID()}_${safeName}`;
    const { error: uploadError } = await supabase.storage.from('career-resumes').upload(uploadedPath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error('Career resume upload failed:', uploadError.message);
      return NextResponse.json({ error: 'The resume could not be uploaded. Please try again.' }, { status: 500 });
    }
    const { data, error } = await supabase.from('career_applications').insert({
      job_opening_id: selectedJob?.jobId || null,
      full_name: fullName,
      email,
      phone,
      cover_letter: coverLetter || null,
      resume_storage_path: uploadedPath,
      resume_original_filename: file.name,
      status: 'new',
    }).select('id').single();
    if (error) {
      await supabase.storage.from('career-resumes').remove([uploadedPath]);
      console.error('Career application insert failed:', error.message);
      return NextResponse.json({ error: 'The application could not be recorded. Please try again.' }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: careerPage.content.form.successMessage, applicationId: data.id });
  } catch (error) {
    if (uploadedPath) await createAdminClient().storage.from('career-resumes').remove([uploadedPath]).catch(() => null);
    console.error('Career application submission error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred during CV submission.' }, { status: 500 });
  }
}
