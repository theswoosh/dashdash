import { test, expect } from '@playwright/test';

// Auth-specific E2E flows, split out from dashboard.spec.ts on purpose:
// - needs its own reachability precondition (a running Keycloak test IdP)
//   that the core dashboard suite must never depend on;
// - the OIDC describe block below skips gracefully (not fails) when no IdP
//   is reachable, so `pnpm exec playwright test` still passes without Docker.
// See _dev/roadmap/done/auth_regression.md for the manual verification this
// spec automates a subset of.

const KEYCLOAK_URL = process.env['E2E_OIDC_ISSUER'] ?? 'http://localhost:8081/realms/dashdash-test';
const RATE_LIMIT_EMAIL = 'ratelimit-e2e@test.local';
const RATE_LIMIT_PASSWORD = 'e2e-ratelimit-pw-123';

let oidcAvailable = false;

test.beforeAll(async () => {
  try {
    const res = await fetch(`${KEYCLOAK_URL}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(2000) });
    oidcAvailable = res.ok;
  } catch {
    oidcAvailable = false;
  }
});

test('rate limit locks out after 5 failed attempts, correct password still 429', async ({ page }) => {
  // Deliberately NO registration here: the register endpoint allows only
  // 3/hour/IP shared across the whole E2E run, and dashboard.spec.ts needs
  // all three slots (admin, ui-user, ACL outsider). The login rate limit is
  // checked before user lookup and keyed by email (auth.route.ts), so the
  // lockout behaves identically for a nonexistent account. The
  // correct-password-during-lockout semantics against a real account were
  // verified manually in the 2026-07-16 auth round.
  for (let i = 0; i < 5; i++) {
    const res = await page.request.post('/api/auth/login', {
      data: { email: RATE_LIMIT_EMAIL, password: 'definitely-wrong' },
    });
    expect(res.status()).toBe(401);
  }

  const lockedOut = await page.request.post('/api/auth/login', {
    data: { email: RATE_LIMIT_EMAIL, password: 'definitely-wrong' },
  });
  expect(lockedOut.status()).toBe(429);

  // Even the CORRECT password is rejected while locked out.
  const stillLocked = await page.request.post('/api/auth/login', {
    data: { email: RATE_LIMIT_EMAIL, password: RATE_LIMIT_PASSWORD },
  });
  expect(stillLocked.status()).toBe(429);
  const body = await stillLocked.json() as { error: string };
  expect(body.error).toBe('Too many login attempts. Try again later.');
});

test('rate-limit error renders as readable text in the login form', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 6; i++) {
    await page.locator('#login-email').fill(RATE_LIMIT_EMAIL);
    await page.locator('#login-password').fill('still-wrong');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForTimeout(150);
  }
  const errorText = await page.locator('.login-error').textContent();
  expect(errorText).toBe('Too many login attempts. Try again later.');
});

test.describe('OIDC (requires a running Keycloak test IdP)', () => {
  test.beforeEach(() => {
    test.skip(!oidcAvailable, `Keycloak not reachable at ${KEYCLOAK_URL} — start it per _dev/roadmap/done/auth_regression.md Milestone 1 to run this suite.`);
  });

  test('login screen shows both local and SSO options when both are enabled', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#login-email')).toBeVisible();
    await expect(page.locator('.login-sso-btn')).toBeVisible();
  });

  test('OIDC login redirects to the IdP and back with a valid session', async ({ page }) => {
    await page.goto('/');
    await page.click('.login-sso-btn');
    await page.waitForURL(new RegExp(new URL(KEYCLOAK_URL).host));
    await page.fill('#username', 'oidc-user1@test.local');
    await page.fill('#password', 'TestPass123!');
    await page.click('#kc-login');
    await page.waitForURL(/^http:\/\/127\.0\.0\.1:4317\/?$/);
    await expect(page.locator('.topbar')).toBeVisible();
  });

  test('bad OIDC state redirects with a sane error, not a crash', async ({ page }) => {
    await page.goto('/api/auth/oidc/callback?state=forged-state-xyz&code=whatever');
    await expect(page).toHaveURL(/\?error=oidc_state/);
    await expect(page.locator('.login-error')).toBeVisible();
  });
});
