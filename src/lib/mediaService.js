import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import cloudinary from '@/lib/cloudinary';

export class MediaAssetNotFoundError extends Error {
  constructor() {
    super('Media asset not found.');
    this.name = 'MediaAssetNotFoundError';
  }
}

export class MediaAssetInUseError extends Error {
  constructor(usageCount) {
    super('Media asset is referenced and cannot be archived or deleted.');
    this.name = 'MediaAssetInUseError';
    this.usageCount = usageCount;
  }
}

export class MediaDeletionPendingError extends Error {
  constructor(message, { status = 502, assetId = null, deletionId = null, cause } = {}) {
    super(message, { cause });
    this.name = 'MediaDeletionPendingError';
    this.status = status;
    this.assetId = assetId;
    this.deletionId = deletionId;
  }
}

/**
 * Save or update Cloudinary upload metadata in Supabase media_assets table
 */
export async function saveMediaAsset(assetData) {
  const supabase = createAdminClient();

  const payload = {
    public_id: assetData.public_id,
    secure_url: assetData.secure_url,
    resource_type: assetData.resource_type || 'image',
    format: assetData.format || 'webp',
    width: assetData.width || null,
    height: assetData.height || null,
    bytes: assetData.bytes || null,
    original_filename: assetData.original_filename || assetData.public_id.split('/').pop(),
    display_name: assetData.display_name || assetData.original_filename || assetData.public_id.split('/').pop(),
    folder: assetData.folder || 'dhaka-heights/dev/shared',
    alt_text: assetData.alt_text || '',
    caption: assetData.caption || '',
    tags: assetData.tags || [],
    uploaded_by: assetData.uploaded_by || null,
    updated_at: new Date().toISOString(),
  };

  const { data: result, error } = await supabase.rpc('save_media_asset_metadata', {
    p_payload: payload,
  });

  if (error) {
    console.error('Error persisting media asset metadata:', error);
    throw error;
  }

  if (!result?.ok) {
    if (result?.code === 'MEDIA_DELETION_PENDING') {
      throw new MediaDeletionPendingError(result.error, { status: 409 });
    }
    throw new Error(result?.error || 'Media metadata could not be saved.');
  }

  return result.asset;
}

/**
 * Get media assets list with search, filtering, and pagination
 */
export async function getMediaAssets({
  search = '',
  folder = '',
  resourceType = '',
  tag = '',
  isArchived = false,
  page = 1,
  limit = 24,
} = {}) {
  const supabase = createAdminClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('media_assets')
    .select('*', { count: 'exact' })
    .eq('is_archived', isArchived)
    .order('created_at', { ascending: false });

  if (search) {
    query = query.or(`display_name.ilike.%${search}%,original_filename.ilike.%${search}%,public_id.ilike.%${search}%`);
  }

  if (folder) {
    query = query.eq('folder', folder);
  }

  if (resourceType) {
    query = query.eq('resource_type', resourceType);
  }

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error('Error fetching media assets:', error);
    throw error;
  }

  return {
    assets: data || [],
    totalCount: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

export async function getMediaAssetById(id) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching media asset:', error);
    throw error;
  }

  if (!data) throw new MediaAssetNotFoundError();
  return data;
}

/**
 * Update media asset metadata (alt_text, caption, display_name, tags)
 */
export async function updateMediaAsset(id, { display_name, alt_text, caption, tags }) {
  const supabase = createAdminClient();

  const updates = {
    ...(display_name !== undefined && { display_name }),
    ...(alt_text !== undefined && { alt_text }),
    ...(caption !== undefined && { caption }),
    ...(tags !== undefined && { tags }),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('media_assets')
    .update(updates)
    .eq('id', id)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error updating media asset:', error);
    throw error;
  }

  if (!data) throw new MediaAssetNotFoundError();
  return data;
}

/**
 * Check where a media asset is currently used in the application
 */
export async function checkAssetUsage(assetId) {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('media_asset_usage')
    .select('id, media_asset_id, table_name, record_id, field_name, created_at')
    .eq('media_asset_id', assetId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error checking asset usage:', error);
    throw error;
  }

  return data || [];
}

/**
 * Archive or Delete a media asset with deletion protection
 */
export async function deleteOrArchiveAsset(
  assetId,
  { forceHardDelete = false, requestedBy = null } = {}
) {
  const supabase = createAdminClient();
  const functionName = forceHardDelete
    ? 'delete_media_asset_if_unused'
    : 'archive_media_asset_if_unused';
  let retryDeletion = null;

  if (forceHardDelete) {
    const { data, error } = await supabase
      .from('media_deletion_outbox')
      .select('id, asset_id, public_id, resource_type')
      .eq('asset_id', assetId)
      .in('status', ['pending', 'failed'])
      .maybeSingle();

    if (error) throw error;
    retryDeletion = data;
  }

  const mutation = retryDeletion
    ? {
        data: {
          ok: true,
          deletionId: retryDeletion.id,
          asset: {
            id: retryDeletion.asset_id,
            public_id: retryDeletion.public_id,
            resource_type: retryDeletion.resource_type,
          },
        },
        error: null,
      }
    : await supabase.rpc(functionName, {
        p_asset_id: assetId,
        ...(forceHardDelete ? { p_requested_by: requestedBy } : {}),
      });

  const { data: decision, error: decisionError } = mutation;

  if (decisionError) throw decisionError;

  if (!decision?.ok) {
    if (decision?.code === 'MEDIA_ASSET_NOT_FOUND') {
      throw new MediaAssetNotFoundError();
    }
    if (decision?.code === 'MEDIA_ASSET_IN_USE') {
      throw new MediaAssetInUseError(decision.usageCount || 1);
    }
    throw new Error(decision?.error || 'The media deletion decision failed.');
  }

  const asset = decision.asset;
  if (!forceHardDelete) {
    return { action: 'archived', usageCount: 0, asset };
  }

  // The database row is removed first under a row lock and only after every
  // relational reference is checked. A Cloudinary failure can leave an
  // unreferenced binary to reconcile, but can never break a live DB reference.
  const deletionId = decision.deletionId;

  try {
    const cloudinaryResult = await cloudinary.uploader.destroy(asset.public_id, {
      resource_type: asset.resource_type || 'image',
    });

    if (!['ok', 'not found'].includes(cloudinaryResult?.result)) {
      throw new Error('Cloudinary did not confirm binary deletion.');
    }

    const { error: completionError } = await supabase.rpc(
      'complete_media_asset_deletion',
      { p_deletion_id: deletionId }
    );
    if (completionError) throw completionError;
  } catch (error) {
    const { error: outboxError } = await supabase.rpc('fail_media_asset_deletion', {
      p_deletion_id: deletionId,
      p_error: error instanceof Error ? error.message : 'Cloudinary deletion failed.',
    });
    if (outboxError) {
      console.error('Failed to persist media deletion failure:', outboxError);
    }

    throw new MediaDeletionPendingError(
      'Database metadata is safe, but Cloudinary deletion is pending. Retry this force-delete action.',
      { assetId, deletionId, cause: error }
    );
  }

  return { action: 'deleted', assetId, deletionId };
}
