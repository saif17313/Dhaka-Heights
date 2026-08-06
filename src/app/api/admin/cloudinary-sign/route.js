import { NextResponse } from 'next/server';
import {
  CloudinaryUploadValidationError,
  generateUploadSignature,
} from '@/lib/cloudinary';
import { adminAuthErrorResponse, requireAdmin } from '@/lib/auth/requireAdmin';

const ALLOWED_BODY_KEYS = new Set(['folder', 'tags', 'resourceType']);

export async function POST(request) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'A JSON object is required.' }, { status: 400 });
    }

    const unsupportedKeys = Object.keys(body).filter((key) => !ALLOWED_BODY_KEYS.has(key));
    if (unsupportedKeys.length > 0) {
      return NextResponse.json(
        { error: `Unsupported upload parameter: ${unsupportedKeys[0]}` },
        { status: 400 }
      );
    }

    const signatureData = generateUploadSignature({
      folder: body.folder,
      tags: body.tags,
      resourceType: body.resourceType,
    });

    return NextResponse.json(signatureData);
  } catch (error) {
    const authResponse = adminAuthErrorResponse(error);
    if (authResponse) return authResponse;

    if (error instanceof CloudinaryUploadValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error generating Cloudinary upload signature:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload signature' },
      { status: 500 }
    );
  }
}
