import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { adminAuthErrorResponse, requireAdmin } from '@/lib/auth/requireAdmin';

export async function GET(request) {
  try {
    await requireAdmin({ allowedRoles: ['super_admin', 'hr_manager'] });

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'Resume storage path parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Create a 60-minute signed URL for private resume access
    const { data, error } = await supabase.storage
      .from('career-resumes')
      .createSignedUrl(path, 3600);

    if (error || !data) {
      console.error('Error generating signed resume download URL:', error);
      return NextResponse.json(
        { error: 'Failed to generate secure download link' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      signedUrl: data.signedUrl,
      expiresIn: 3600,
    });
  } catch (err) {
    const authResponse = adminAuthErrorResponse(err);
    if (authResponse) return authResponse;

    console.error('Resume link generator API error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
