import { NextResponse } from 'next/server';
import {
  getMediaAssets,
  MediaDeletionPendingError,
  saveMediaAsset,
} from '@/lib/mediaService';
import { adminAuthErrorResponse, requireAdmin } from '@/lib/auth/requireAdmin';
import {
  CloudinaryUploadValidationError,
  getVerifiedCloudinaryAsset,
} from '@/lib/cloudinary';

export async function GET(request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const folder = searchParams.get('folder') || '';
    const resourceType = searchParams.get('resourceType') || '';
    const tag = searchParams.get('tag') || '';
    const isArchived = searchParams.get('isArchived') === 'true';
    const requestedPage = Number.parseInt(searchParams.get('page') || '1', 10);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '24', 10);
    const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 24;

    const result = await getMediaAssets({
      search,
      folder,
      resourceType,
      tag,
      isArchived,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;

    console.error('API Error fetching media assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch media assets' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { user } = await requireAdmin();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
    }

    if (!body.public_id) {
      return NextResponse.json(
        { error: 'public_id is required' },
        { status: 400 }
      );
    }

    const verifiedAsset = await getVerifiedCloudinaryAsset(
      body.public_id,
      body.resource_type || 'image'
    );
    const savedAsset = await saveMediaAsset({
      ...body,
      ...verifiedAsset,
      uploaded_by: user.id,
    });
    return NextResponse.json(savedAsset, { status: 201 });
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof CloudinaryUploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof MediaDeletionPendingError) {
      return NextResponse.json(
        { error: error.message, code: 'MEDIA_DELETION_PENDING' },
        { status: error.status }
      );
    }

    console.error('API Error saving media asset metadata:', error);
    return NextResponse.json(
      { error: 'Failed to save media asset metadata' },
      { status: 500 }
    );
  }
}
