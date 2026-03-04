import useSWR, { mutate } from 'swr';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  authMethod?: 'local' | 'oidc';
}

interface AuthConfig {
  registrationEnabled: boolean;
  smtpConfigured: boolean;
  oidcEnabled: boolean;
  localEnabled: boolean;
}

const ME_KEY = '/api/auth/me';
const CONFIG_KEY = '/api/auth/config';

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (res.status === 401) return null as unknown as T;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function useAuth() {
  const { data: user, isLoading } = useSWR<AuthUser | null>(ME_KEY, jsonFetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  });

  const { data: authConfig } = useSWR<AuthConfig>(CONFIG_KEY, jsonFetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  async function login(email: string, password: string): Promise<void> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json() as { error: string };
      throw new Error(body.error ?? 'Login failed');
    }
    await mutate(ME_KEY);
  }

  async function register(email: string, password: string, name: string): Promise<void> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const body = await res.json() as { error: string };
      throw new Error(body.error ?? 'Registration failed');
    }
    await mutate(ME_KEY);
  }

  async function logout(): Promise<void> {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    await mutate(ME_KEY, null, { revalidate: false });
    const body = await res.json() as { ok: boolean; redirectUrl?: string };
    window.location.assign(body.redirectUrl ?? '/');
  }

  async function updateProfile(data: { name?: string; email?: string; password?: string; currentPassword?: string }): Promise<void> {
    const res = await fetch('/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json() as { error: string };
      throw new Error(body.error ?? 'Update failed');
    }
    await mutate(ME_KEY);
  }

  async function deleteAccount(email: string): Promise<void> {
    const res = await fetch('/api/auth/me', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = await res.json() as { error: string };
      throw new Error(body.error ?? 'Delete failed');
    }
    window.location.assign('/');
  }

  return {
    user: user ?? null,
    isLoading,
    registrationEnabled: authConfig?.registrationEnabled ?? true,
    smtpConfigured: authConfig?.smtpConfigured ?? false,
    oidcEnabled: authConfig?.oidcEnabled ?? false,
    localEnabled: authConfig?.localEnabled ?? true,
    login,
    register,
    logout,
    updateProfile,
    deleteAccount,
  };
}
