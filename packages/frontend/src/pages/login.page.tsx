import { useState } from 'react';
import { useAuth } from '../hooks/use-auth.hook';
import { useT } from '../i18n';
import './login.css';

type LoginView = 'login' | 'register' | 'forgot';

type TFunc = (key: string) => string;

function resolveOidcError(code: string, t: TFunc): string {
  switch (code) {
    case 'oidc_email_not_verified': return t('login.oidcEmailNotVerified');
    case 'oidc_account_inactive':   return t('login.oidcAccountInactive');
    case 'oidc_disabled':           return t('login.oidcDisabled');
    default:                        return t('login.oidcError');
  }
}

interface LoginPageProps {
  initialView?: LoginView;
  initialError?: string;
}

export function LoginPage({ initialView = 'login', initialError = '' }: LoginPageProps) {
  const { login, register, registrationEnabled, smtpConfigured, oidcEnabled, localEnabled } = useAuth();
  const t = useT();
  const [view, setView] = useState<LoginView>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(initialError ? resolveOidcError(initialError, t) : '');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.signIn'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('login.passwordMismatch'));
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await register(email, password, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.createAccount'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setInfo(t('login.resetLinkSent'));
    } catch {
      setError(t('login.somethingWentWrong'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function switchView(newView: LoginView) {
    setError('');
    setInfo('');
    setPassword('');
    setConfirmPassword('');
    setView(newView);
  }

  return (
    <div className="login-backdrop">
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo">dashdash</span>
        </div>

        {view === 'login' && (
          <div className="login-form">
            <h1 className="login-title">{t('login.signIn')}</h1>
            {error && <p className="login-error" role="alert">{error}</p>}

            {oidcEnabled && (
              <a className="login-sso-btn" href="/api/auth/oidc/login">
                {t('login.ssoSignIn')}
              </a>
            )}

            {oidcEnabled && localEnabled && (
              <div className="login-divider"><span>{t('login.or')}</span></div>
            )}

            {localEnabled && (
              <form onSubmit={e => void handleLogin(e)}>
                <label className="login-label" htmlFor="login-email">{t('login.email')}</label>
                <input
                  id="login-email"
                  className="login-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus={!oidcEnabled}
                />

                <label className="login-label" htmlFor="login-password">{t('login.password')}</label>
                <input
                  id="login-password"
                  className="login-input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />

                <button className="login-btn" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? t('login.signingIn') : t('login.signIn')}
                </button>
              </form>
            )}

            {localEnabled && (
              <div className="login-links">
                {smtpConfigured && (
                  <button type="button" className="login-link" onClick={() => switchView('forgot')}>
                    {t('login.forgotPassword')}
                  </button>
                )}
                {registrationEnabled && (
                  <button type="button" className="login-link" onClick={() => switchView('register')}>
                    {t('login.createAccount')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {view === 'register' && (
          <form className="login-form" onSubmit={e => void handleRegister(e)}>
            <h1 className="login-title">{t('login.createAccount')}</h1>
            {error && <p className="login-error" role="alert">{error}</p>}

            <label className="login-label" htmlFor="reg-name">{t('login.displayName')}</label>
            <input
              id="reg-name"
              className="login-input"
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              maxLength={100}
            />

            <label className="login-label" htmlFor="reg-email">{t('login.email')}</label>
            <input
              id="reg-email"
              className="login-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />

            <label className="login-label" htmlFor="reg-password">{t('login.password')}</label>
            <input
              id="reg-password"
              className="login-input"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <span className="login-hint">{t('login.minChars')}</span>

            <label className="login-label" htmlFor="reg-confirm-password">{t('login.confirmPassword')}</label>
            <input
              id="reg-confirm-password"
              className="login-input"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />

            <button className="login-btn" type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('login.creatingAccount') : t('login.createAccount')}
            </button>

            <div className="login-links">
              <button type="button" className="login-link" onClick={() => switchView('login')}>
                {t('login.alreadyHaveAccount')}
              </button>
            </div>
          </form>
        )}

        {view === 'forgot' && (
          <form className="login-form" onSubmit={e => void handleForgot(e)}>
            <h1 className="login-title">{t('login.resetPassword')}</h1>
            {error && <p className="login-error" role="alert">{error}</p>}
            {info && <p className="login-info" role="status">{info}</p>}

            <label className="login-label" htmlFor="forgot-email">{t('login.email')}</label>
            <input
              id="forgot-email"
              className="login-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />

            <button className="login-btn" type="submit" disabled={isSubmitting || !!info}>
              {isSubmitting ? t('login.sending') : t('login.sendResetLink')}
            </button>

            <div className="login-links">
              <button type="button" className="login-link" onClick={() => switchView('login')}>
                {t('login.backToSignIn')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
