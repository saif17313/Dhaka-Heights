import Link from 'next/link';
import { redirect } from 'next/navigation';
import AdminShell from '@/components/admin/AdminShell';
import {
  ALL_ADMIN_ROLES,
  isAdminAuthError,
  requireAdmin,
} from '@/lib/auth/requireAdmin';

function AccessDenied() {
  return (
    <main className="min-h-screen bg-[#051026] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-red-800/60 bg-[#0D1E42] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-700 bg-red-950/70 text-red-200">
          <i className="fa-solid fa-shield-halved"></i>
        </div>
        <h1 className="font-serif text-2xl font-bold">Access denied</h1>
        <p className="mt-2 text-sm text-slate-300">
          An active administrator profile is required.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-xl bg-[#C5A880] px-4 py-2 text-xs font-bold text-[#0B1B3D]"
        >
          Return to website
        </Link>
      </div>
    </main>
  );
}

export default async function AdminLayout({ children }) {
  try {
    await requireAdmin({ allowedRoles: ALL_ADMIN_ROLES });
  } catch (error) {
    if (!isAdminAuthError(error)) throw error;

    if (error.status === 401) {
      redirect('/admin/login?redirectTo=/admin');
    }

    if (error.status === 403) {
      return <AccessDenied />;
    }

    throw error;
  }

  return <AdminShell>{children}</AdminShell>;
}
