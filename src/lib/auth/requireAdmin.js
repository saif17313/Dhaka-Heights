import 'server-only';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const CONTENT_ADMIN_ROLES = Object.freeze(['super_admin', 'content_editor']);
export const ALL_ADMIN_ROLES = Object.freeze([
  'super_admin',
  'content_editor',
  'sales_manager',
  'hr_manager',
]);

export class AdminAuthError extends Error {
  constructor(message, { status, code, cause } = {}) {
    super(message, { cause });
    this.name = 'AdminAuthError';
    this.status = status || 500;
    this.code = code || 'ADMIN_AUTH_ERROR';
  }
}

export function isAdminAuthError(error) {
  return error instanceof AdminAuthError;
}

/**
 * Verify the Supabase session and its matching active admin profile.
 * Proxy only performs an optimistic session redirect and is not authorization.
 */
export async function requireAdmin({ allowedRoles = CONTENT_ADMIN_ROLES } = {}) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AdminAuthError('Authentication is required.', {
      status: 401,
      code: 'ADMIN_AUTH_REQUIRED',
      cause: userError,
    });
  }

  const adminSupabase = createAdminClient();
  const { data: profile, error: profileError } = await adminSupabase
    .from('admin_profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Admin authorization profile lookup failed:', profileError.message);
    throw new AdminAuthError('Admin authorization could not be verified.', {
      status: 500,
      code: 'ADMIN_AUTH_CHECK_FAILED',
      cause: profileError,
    });
  }

  if (!profile) {
    throw new AdminAuthError('An administrator profile is required.', {
      status: 403,
      code: 'ADMIN_PROFILE_REQUIRED',
    });
  }

  if (!profile.is_active) {
    throw new AdminAuthError('This administrator profile is inactive.', {
      status: 403,
      code: 'ADMIN_PROFILE_INACTIVE',
    });
  }

  if (!allowedRoles.includes(profile.role)) {
    throw new AdminAuthError('You do not have permission to access this resource.', {
      status: 403,
      code: 'ADMIN_ROLE_FORBIDDEN',
    });
  }

  return {
    user: { id: user.id, email: user.email || null },
    profile: {
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      isActive: profile.is_active,
    },
  };
}

export function adminAuthErrorResponse(error) {
  if (!isAdminAuthError(error)) return null;

  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.status }
  );
}
