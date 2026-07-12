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

test('dragging onto an occupied spot shows a red ghost and reverts', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const blockA = page.locator('.react-grid-item').filter({ hasText: 'Block A' });
  const blockB = page.locator('.react-grid-item').filter({ hasText: 'Block B' });
  await expect(blockA).toBeVisible();
  const initialTransform = await blockA.evaluate(el => (el as HTMLElement).style.transform);

  await enableEditMode(page);
  const handle = blockA.locator('.grid-drag-handle');
  await handle.hover();
  await page.mouse.down();
  const targetBox = await blockB.boundingBox();
  if (!targetBox) throw new Error('Block B has no bounding box');
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });

  // Invalid target: the canvas carries the red-ghost class while hovering.
  await expect(page.locator('.dash-grid-canvas.grid-drag-invalid')).toHaveCount(1);

  await page.mouse.up();

  // Drop is rejected — Block A snaps back to where it started.
  await expect.poll(() => blockA.evaluate(el => (el as HTMLElement).style.transform)).toBe(initialTransform);
  await expect(page.locator('.dash-grid-canvas.grid-drag-invalid')).toHaveCount(0);

  const layoutSave = page.waitForResponse(r => r.url().includes('/api/services/layouts') && r.ok());
  await page.getByLabel('Save & exit').click();
  await layoutSave;

  await page.reload();
  await expect(blockA).toBeVisible();
  const persistedTransform = await blockA.evaluate(el => (el as HTMLElement).style.transform);
  expect(persistedTransform).toBe(initialTransform);
});

test('resizing into a neighbor shows a red ghost and reverts', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const blockA = page.locator('.react-grid-item').filter({ hasText: 'Block A' });
  await expect(blockA).toBeVisible();

  await enableEditMode(page);
  const initialBox = await blockA.boundingBox();
  if (!initialBox) throw new Error('Block A has no bounding box');

  await blockA.hover();
  const resizeHandle = blockA.locator('.react-resizable-handle');
  await resizeHandle.hover({ force: true });
  await page.mouse.down();
  // Stretch right past Block B's left edge (Block B starts 4 grid units away).
  await page.mouse.move(initialBox.x + initialBox.width + 90, initialBox.y + initialBox.height - 5, { steps: 10 });

  await expect(page.locator('.dash-grid-canvas.grid-drag-invalid')).toHaveCount(1);

  await page.mouse.up();

  // Resize is rejected — Block A returns to its original size.
  await expect.poll(async () => (await blockA.boundingBox())?.width).toBe(initialBox.width);
  await expect(page.locator('.dash-grid-canvas.grid-drag-invalid')).toHaveCount(0);

  await page.getByLabel('Save & exit').click();
});

test('consecutive invalid drags all revert (revert must not race RGL state)', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const blockA = page.locator('.react-grid-item').filter({ hasText: 'Block A' });
  const blockB = page.locator('.react-grid-item').filter({ hasText: 'Block B' });
  await expect(blockA).toBeVisible();

  await enableEditMode(page);

  // The first invalid drag used to win the same-batch revert race and later
  // ones lost it, leaving the widget parked on the occupied spot (dashtest #23).
  for (let attempt = 1; attempt <= 3; attempt++) {
    const before = await blockA.boundingBox();
    if (!before) throw new Error('Block A has no bounding box');
    const bBox = await blockB.boundingBox();
    if (!bBox) throw new Error('Block B has no bounding box');

    const handle = blockA.locator('.grid-drag-handle');
    await handle.hover();
    await page.mouse.down();
    await page.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2, { steps: 10 });
    await expect(page.locator('.dash-grid-canvas.grid-drag-invalid')).toHaveCount(1);
    await page.mouse.up();

    await expect.poll(async () => JSON.stringify(await blockA.boundingBox()), {
      message: `invalid drag #${attempt} must revert`,
    }).toBe(JSON.stringify(before));
  }

  await page.getByLabel('Save & exit').click();
});

test('toggling tiny layout mid-session pins the drag footprint to the bar', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const pinger = page.locator('.react-grid-item').filter({ hasText: 'Pinger' });
  await expect(pinger).toBeVisible();

  await enableEditMode(page);

  // Switch the healthcheck to the tiny layout via its config modal — without
  // reloading. The grid item must shrink with it; a stale full-size entry
  // leaves an oversized drag ghost and phantom collisions (dashtest #4/#19).
  await pinger.hover();
  await pinger.getByLabel('Configure widget').click();
  const layoutField = page.locator('.config-field').filter({ hasText: 'Layout size' });
  await layoutField.locator('select').selectOption('tiny');
  const save = page.waitForResponse(r =>
    r.url().includes('/api/services/') && r.request().method() === 'PATCH' && r.ok());
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
  await save;

  // The item itself is now bar-sized.
  await expect.poll(async () => (await pinger.boundingBox())?.height).toBeLessThan(50);

  const handle = pinger.locator('.grid-drag-handle');
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(500, 600, { steps: 12 });

  // The drag ghost matches the bar footprint — not the pre-toggle size.
  const ghost = page.locator('.react-grid-placeholder');
  await expect(ghost).toBeVisible();
  const ghostBox = await ghost.boundingBox();
  if (!ghostBox) throw new Error('ghost has no bounding box');
  expect(ghostBox.height).toBeLessThan(50);

  // No phantom collision over genuinely empty space.
  await expect(page.locator('.dash-grid-canvas.grid-drag-invalid')).toHaveCount(0);

  await page.mouse.up();
  await page.getByLabel('Save & exit').click();
});

test('dragging a widget onto a frame reparents it (no red ghost)', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const blockA = page.locator('.react-grid-item').filter({ hasText: 'Block A' });
  const frame = page.locator('.frame-card');
  await expect(blockA).toBeVisible();
  await expect(frame).toBeVisible();

  await enableEditMode(page);
  const handle = blockA.locator('.grid-drag-handle');
  await handle.hover();
  await page.mouse.down();
  const frameBox = await frame.boundingBox();
  if (!frameBox) throw new Error('Frame has no bounding box');
  await page.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2, { steps: 12 });

  // Over a frame the drop is valid — no red ghost.
  await expect(page.locator('.dash-grid-canvas.grid-drag-invalid')).toHaveCount(0);

  const reparent = page.waitForResponse(r =>
    r.url().includes('/api/services/') && r.request().method() === 'PATCH' && r.ok());
  await page.mouse.up();
  await reparent;

  // Block A now renders inside the frame's inner grid.
  await expect(frame.locator('.react-grid-item').filter({ hasText: 'Block A' })).toBeVisible();

  await page.getByLabel('Save & exit').click();
  await page.reload();
  await expect(page.locator('.frame-card .react-grid-item').filter({ hasText: 'Block A' })).toBeVisible();
});
