import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordRevision, revalidatePublicRoute } from '@/lib/revisionService';
import { adminAuthErrorResponse, requireAdmin } from '@/lib/auth/requireAdmin';

const ENTITY_CONFIG = {
  project: { tableName: 'projects', statusMode: 'status' },
  concern: { tableName: 'concerns', statusMode: 'status' },
  media_post: { tableName: 'media_posts', statusMode: 'status' },
  job_opening: { tableName: 'job_openings', statusMode: 'active' },
  page: { tableName: 'pages', statusMode: 'published' },
};

const ALLOWED_STATUSES = new Set(['draft', 'published', 'archived']);

function statusUpdate(statusMode, status) {
  if (statusMode === 'status') return { status };
  if (statusMode === 'active') return { is_active: status === 'published' };
  return { is_published: status === 'published' };
}

export async function POST(request) {
  try {
    const { user } = await requireAdmin();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
    }

    const { entity_type, entity_id, status, target_path = '/' } = body;

    if (!entity_type || !entity_id || !status) {
      return NextResponse.json(
        { error: 'entity_type, entity_id, and status are required' },
        { status: 400 }
      );
    }

    const entityConfig = ENTITY_CONFIG[entity_type];
    if (!entityConfig) {
      return NextResponse.json(
        { error: `Invalid entity_type: ${entity_type}` },
        { status: 400 }
      );
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid publish status.' }, { status: 400 });
    }

    if (typeof target_path !== 'string' || !target_path.startsWith('/') || target_path.startsWith('//')) {
      return NextResponse.json({ error: 'target_path must be an internal route.' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { tableName, statusMode } = entityConfig;

    // 1. Fetch current data for snapshot
    const { data: currentData, error: fetchErr } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', entity_id)
      .single();

    if (fetchErr || !currentData) {
      return NextResponse.json(
        { error: 'Entity record not found' },
        { status: 404 }
      );
    }

    // 2. Record revision snapshot
    await recordRevision({
      table_name: tableName,
      record_id: entity_id,
      snapshot_data: currentData,
      change_summary: `Publication state changed to ${status}`,
      created_by: user.id,
    });

    // 3. Update status in database
    const { data: updated, error: updateErr } = await supabase
      .from(tableName)
      .update({
        ...statusUpdate(statusMode, status),
        updated_at: new Date().toISOString(),
      })
      .eq('id', entity_id)
      .select()
      .single();

    if (updateErr) {
      console.error('Error updating publish status:', updateErr);
      return NextResponse.json(
        { error: 'Failed to update publish status' },
        { status: 500 }
      );
    }

    const { error: auditError } = await supabase.from('audit_logs').insert({
      admin_id: user.id,
      action: `set_${status}`,
      table_name: tableName,
      record_id: entity_id,
      old_values: currentData,
      new_values: updated,
    });

    if (auditError) {
      console.error('Error recording publish audit:', auditError);
      return NextResponse.json(
        { error: 'Publication changed but its audit record could not be written.' },
        { status: 500 }
      );
    }

    // 4. Revalidate public route
    revalidatePublicRoute(target_path);

    return NextResponse.json({
      success: true,
      message: `Successfully set ${entity_type} status to ${status}`,
      record: updated,
    });
  } catch (err) {
    const authResponse = adminAuthErrorResponse(err);
    if (authResponse) return authResponse;

    console.error('Publish API error:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
