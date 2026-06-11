import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Smoke flows against a prod-like instance (see start-server.mjs).
// Tests run in order with one worker — they share the server's services.yml.

const ADMIN = { email: 'e2e-admin@test.local', password: 'e2e-password-123', name: 'E2E Admin' };

async function loginViaApi(page: Page): Promise<void> {
  const request = page.context().request;
  // First registration wins admin; later calls fail harmlessly (user exists).
  await request.post('/api/auth/register', { data: ADMIN });
  const res = await request.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  expect(res.ok()).toBeTruthy();
}

async function enableEditMode(page: Page): Promise<void> {
  await page.getByLabel('Open config').click();
  await expect(page.getByLabel('Save & exit')).toBeVisible();
}

test('register and sign in through the UI, board renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#login-email')).toBeVisible();

  await page.getByRole('button', { name: 'Create account' }).click();
  await page.locator('#reg-name').fill('UI User');
  await page.locator('#reg-email').fill('ui-user@test.local');
  await page.locator('#reg-password').fill('ui-password-123');
  await page.locator('#reg-confirm-password').fill('ui-password-123');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Registration returns to the login view (no auto-login by design).
  await page.locator('#login-email').fill('ui-user@test.local');
  await page.locator('#login-password').fill('ui-password-123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.locator('.topbar')).toBeVisible();
  await expect(page.locator('.react-grid-item').filter({ hasText: 'Clock' })).toBeVisible();
});

test('dragging a widget persists its position across reload', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const clockItem = page.locator('.react-grid-item').filter({ hasText: 'Clock' });
  await expect(clockItem).toBeVisible();
  const initialTransform = await clockItem.evaluate(el => (el as HTMLElement).style.transform);

  await enableEditMode(page);
  const handle = clockItem.locator('.grid-drag-handle');
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(400, 300, { steps: 12 });
  await page.mouse.up();

  const movedTransform = await clockItem.evaluate(el => (el as HTMLElement).style.transform);
  expect(movedTransform).not.toBe(initialTransform);

  // Save & exit triggers the bulk layout PUT.
  const layoutSave = page.waitForResponse(r => r.url().includes('/api/services/layouts') && r.ok());
  await page.getByLabel('Save & exit').click();
  await layoutSave;

  await page.reload();
  await expect(clockItem).toBeVisible();
  const persistedTransform = await clockItem.evaluate(el => (el as HTMLElement).style.transform);
  expect(persistedTransform).toBe(movedTransform);
});

test('hold-to-delete removes a widget permanently', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const notesItem = page.locator('.react-grid-item').filter({ hasText: 'Notes' });
  await expect(notesItem).toBeVisible();

  await enableEditMode(page);
  const deleteButton = notesItem.getByTitle('Hold to delete');
  await deleteButton.hover();
  await page.mouse.down();
  // holdToDeleteMs defaults to 1000 — hold past it.
  await page.waitForTimeout(1600);
  await page.mouse.up();

  await expect(notesItem).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.react-grid-item').filter({ hasText: 'Clock' })).toBeVisible();
  await expect(page.locator('.react-grid-item').filter({ hasText: 'Notes' })).toHaveCount(0);
});
