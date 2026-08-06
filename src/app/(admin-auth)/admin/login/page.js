'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function getSafeAdminRedirect(value) {
  const isAllowedPath =
    value === '/admin' ||
    value?.startsWith('/admin/') ||
    value === '/admin-preview' ||
    value?.startsWith('/admin-preview/');

  if (!value || !isAllowedPath || value.startsWith('//')) {
    return '/admin';
  }

  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = getSafeAdminRedirect(searchParams.get('redirectTo'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setErrorMsg(error.message || 'Invalid email address or password.');
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      setErrorMsg(error.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-[#0D1E42] border border-[#C5A880]/30 rounded-2xl shadow-2xl p-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-900 border border-[#C5A880] rounded-2xl text-[#C5A880]">
          <i className="fa-solid fa-building-user text-2xl"></i>
        </div>
        <h1 className="text-2xl font-bold font-serif tracking-wider text-white">Dhaka Heights</h1>
        <p className="text-xs text-[#C5A880] uppercase tracking-widest font-semibold">Admin Authentication Portal</p>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-950/80 border border-red-800 rounded-xl text-red-200 text-xs text-center" role="alert">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Email Address</label>
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white focus:border-[#C5A880] outline-none"
            placeholder="admin@dhakaheights.com"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-300 mb-1">Password</label>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full px-4 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-xs text-white focus:border-[#C5A880] outline-none"
            placeholder="••••••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#C5A880] hover:bg-[#D4AF37] text-black font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#051026] text-white flex items-center justify-center p-4">
      <Suspense fallback={<div className="text-xs text-gray-400">Loading Portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
