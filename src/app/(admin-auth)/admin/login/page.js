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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgotHint, setShowForgotHint] = useState(false);

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
    <div className="admin-login-card">
      <div className="admin-login-badge"><i className="fa-solid fa-building-columns" aria-hidden="true"></i></div>
      <h1 className="admin-login-title">Dhaka Heights</h1>
      <p className="admin-login-subtitle">Admin Authentication Portal</p>
      <div className="admin-login-divider" aria-hidden="true"><span></span><i className="fa-solid fa-diamond"></i><span></span></div>

      {errorMsg && (
        <div className="admin-login-error" role="alert">
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleLogin} className="admin-login-form">
        <label className="admin-login-field">
          <span>Email Address</span>
          <div className="admin-login-input-wrap">
            <i className="fa-solid fa-envelope" aria-hidden="true"></i>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@dhakaheights.com"
            />
          </div>
        </label>

        <label className="admin-login-field">
          <span>Password</span>
          <div className="admin-login-input-wrap">
            <i className="fa-solid fa-lock" aria-hidden="true"></i>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••••••"
            />
            <button
              type="button"
              className="admin-login-toggle-visibility"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
            </button>
          </div>
        </label>

        <div className="admin-login-row">
          <label className="admin-login-remember">
            <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
            Remember me
          </label>
          <button type="button" className="admin-login-forgot" onClick={() => setShowForgotHint((current) => !current)}>
            Forgot password?
          </button>
        </div>
        {showForgotHint && (
          <p className="admin-login-forgot-hint">Please contact a Super Admin to reset your password.</p>
        )}

        <button type="submit" disabled={loading} className="admin-login-submit">
          <i className="fa-solid fa-right-to-bracket" aria-hidden="true"></i>
          {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
        </button>
      </form>

      <div className="admin-login-footer" aria-hidden="true">
        <span></span>
        <i className="fa-solid fa-shield-halved"></i>
        Secure Admin Access
        <span></span>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="admin-login-page">
      <div className="admin-login-bg"></div>
      <div className="admin-login-bg-overlay"></div>
      <Suspense fallback={<div className="text-xs text-gray-400">Loading Portal...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
