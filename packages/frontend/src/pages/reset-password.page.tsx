import { useState } from 'react';
import { useT } from '../i18n';
import './login.css';

export function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get('token') ?? '';
  const t = useT();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const body = await res.json() as { error: string };
        throw new Error(body.error ?? t('login.somethingWentWrong'));
      }
      setIsDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.somethingWentWrong'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function goToLogin() {
    window.history.replaceState(null, '', '/');
    window.location.reload();
  }

  return (
    <div className="chrome login-backdrop">
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo">dashdash</span>
        </div>

        {isDone ? (
          <div className="login-form">
            <h1 className="login-title">{t('login.passwordUpdated')}</h1>
            <p className="login-info" role="status">{t('login.passwordUpdatedInfo')}</p>
            <button className="login-btn" onClick={goToLogin}>{t('login.goToSignIn')}</button>
          </div>
        ) : (
          <form className="login-form" onSubmit={e => void handleSubmit(e)}>
            <h1 className="login-title">{t('login.setNewPassword')}</h1>
            {error && <p className="login-error" role="alert">{error}</p>}

            <label className="login-label" htmlFor="reset-password">{t('login.newPassword')}</label>
            <input
              id="reset-password"
              className="login-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoFocus
            />
            <span className="login-hint">{t('login.minChars')}</span>

            <button className="login-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('login.updating') : t('login.setNewPassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
