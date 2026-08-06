import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

/**
 * Record a snapshot revision before updating entity content
 */
export async function recordRevision({
  table_name,
  record_id,
  entity_type,
  entity_id,
  snapshot_data,
  change_summary = 'Updated content',
  created_by = null,
}) {
  const tableName = table_name || entity_type;
  const recordId = record_id || entity_id;

  if (!tableName || !recordId || snapshot_data === undefined) {
    throw new Error('Revision table name, record ID, and snapshot are required.');
  }

  const supabase = createAdminClient();
  const { data: latestRevision, error: latestError } = await supabase
    .from('content_revisions')
    .select('version_number')
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('version_number', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (latestError) throw latestError;

  const versionNumber = (latestRevision?.version_number || 0) + 1;
  const { data, error } = await supabase
    .from('content_revisions')
    .insert({
      table_name: tableName,
      record_id: recordId,
      version_number: versionNumber,
      revision_data: snapshot_data,
      change_summary,
      created_by,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Trigger Next.js route revalidation for instant public updates
 */
export function revalidatePublicRoute(targetPath = '/') {
  try {
    revalidatePath(targetPath);
    console.log(`✓ Revalidated public route path: ${targetPath}`);
    return true;
  } catch (err) {
    console.warn(`Route revalidation warning for path ${targetPath}:`, err.message);
    return false;
  }
}
