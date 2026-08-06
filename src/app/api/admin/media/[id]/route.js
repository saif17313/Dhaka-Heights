import { NextResponse } from 'next/server';
import {
  MediaAssetInUseError,
  MediaAssetNotFoundError,
  MediaDeletionPendingError,
  checkAssetUsage,
  deleteOrArchiveAsset,
  getMediaAssetById,
  updateMediaAsset,
} from '@/lib/mediaService';
import { adminAuthErrorResponse, requireAdmin } from '@/lib/auth/requireAdmin';

function mediaServiceErrorResponse(error) {
  if (error instanceof MediaAssetNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof MediaAssetInUseError) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'MEDIA_ASSET_IN_USE',
        usageCount: error.usageCount,
      },
      { status: 409 }
    );
  }

  if (error instanceof MediaDeletionPendingError) {
    return NextResponse.json(
      {
        error: error.message,
        code: 'MEDIA_DELETION_PENDING',
        assetId: error.assetId,
        deletionId: error.deletionId,
      },
      { status: error.status }
    );
  }

  return null;
}

export async function GET(_request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const asset = await getMediaAssetById(id);
    const usage = await checkAssetUsage(id);
    return NextResponse.json({ asset, usage });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const serviceResponse = mediaServiceErrorResponse(error);
    if (serviceResponse) return serviceResponse;

    console.error('API Error fetching media asset usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media asset usage' },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
    }

    const updated = await updateMediaAsset(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const serviceResponse = mediaServiceErrorResponse(error);
    if (serviceResponse) return serviceResponse;

    console.error('API Error updating media asset:', error);
    return NextResponse.json(
      { error: 'Failed to update media asset' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const forceHardDelete = searchParams.get('force') === 'true';
    const { user } = await requireAdmin({
      allowedRoles: forceHardDelete
        ? ['super_admin']
        : ['super_admin', 'content_editor'],
    });
    const { id } = await params;

    const result = await deleteOrArchiveAsset(id, {
      forceHardDelete,
      requestedBy: user.id,
    });
    return NextResponse.json(result);
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;

    const serviceResponse = mediaServiceErrorResponse(error);
    if (serviceResponse) return serviceResponse;

    console.error('API Error deleting media asset:', error);
    return NextResponse.json(
      { error: 'Failed to delete or archive media asset' },
      { status: 500 }
    );
  }
}
