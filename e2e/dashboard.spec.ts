import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// Smoke flows against a prod-like instance (see start-server.mjs).
// Tests run in order with one worker — they share the server's services.yml.

const ADMIN = { email: 'e2e-admin@test.local', password: 'e2e-password-123', name: 'E2E Admin' };

async function loginViaApi(page: Page): Promise<void> {
  const request = page.context().request;
  // Try login first — registration is rate-limited to 3/hour per IP, so only
  // register when the user doesn't exist yet (first registration wins admin).
  let res = await request.post('/api/auth/login', {
    data: { email: ADMIN.email, password: ADMIN.password },
  });
  if (!res.ok()) {
    await request.post('/api/auth/register', { data: ADMIN });
    res = await request.post('/api/auth/login', {
      data: { email: ADMIN.email, password: ADMIN.password },
    });
  }
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
  // Two copies of the delete button exist (header actions + narrow-widget
  // flyout) — CSS shows exactly one via container query depending on the
  // widget's rendered width, so scope to whichever is actually visible.
  const deleteButton = notesItem.locator('[title="Hold to delete"]:visible');
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
  await pinger.locator('.widget-edit-actions').getByLabel('Configure widget').click();
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

test('dragging a child out of a frame preserves its in-session size', async ({ page }) => {
  // Depends on the previous test having reparented Block A into the Group frame.
  await loginViaApi(page);
  await page.goto('/');
  const frame = page.locator('.frame-card');
  const blockAInFrame = frame.locator('.react-grid-item').filter({ hasText: 'Block A' });
  await expect(blockAInFrame).toBeVisible();

  await enableEditMode(page);

  // Resize Block A inside the frame — in-session only, never saved.
  const initialBox = await blockAInFrame.boundingBox();
  if (!initialBox) throw new Error('Block A has no bounding box');
  await blockAInFrame.hover();
  const resizeHandle = blockAInFrame.locator('.react-resizable-handle');
  await resizeHandle.hover({ force: true });
  await page.mouse.down();
  await page.mouse.move(initialBox.x + initialBox.width + 60, initialBox.y + initialBox.height + 30, { steps: 10 });
  await page.mouse.up();

  const resizedBox = await blockAInFrame.boundingBox();
  if (!resizedBox) throw new Error('Block A has no bounding box after resize');
  expect(resizedBox.width).toBeGreaterThan(initialBox.width);
  expect(resizedBox.height).toBeGreaterThan(initialBox.height);

  // Drag the resized child out of the frame onto empty root-grid space — same
  // drag-handle technique as the reparent-onto-frame test above, but the
  // frame-internal handle class.
  const dragHandle = blockAInFrame.locator('.frame-widget-drag-handle');
  await dragHandle.hover();
  await page.mouse.down();
  await page.mouse.move(150, 550, { steps: 12 });

  const patchReq = page.waitForRequest(r =>
    r.method() === 'PATCH' && r.url().includes('/api/services/'));
  await page.mouse.up();
  const body = (await patchReq).postDataJSON() as { layout: { w: number; h: number } };

  // Before the fix, the PATCH always carried the persisted 8x8 size — the
  // in-session resize was silently discarded on reparent. It must now reflect
  // the live (resized) size instead.
  expect(body.layout.w).not.toBe(8);
  expect(body.layout.h).not.toBe(8);

  // Visually, the dropped widget on the root grid keeps the resized dimensions.
  const blockAOnRoot = page.locator('.dash-grid-canvas .react-grid-item').filter({ hasText: 'Block A' });
  await expect(blockAOnRoot).toBeVisible();
  const droppedBox = await blockAOnRoot.boundingBox();
  if (!droppedBox) throw new Error('Block A has no bounding box after drop');
  expect(Math.abs(droppedBox.width - resizedBox.width)).toBeLessThan(8);
  expect(Math.abs(droppedBox.height - resizedBox.height)).toBeLessThan(8);

  await page.getByLabel('Save & exit').click();
  await page.reload();
  const reloadedBlockA = page.locator('.react-grid-item').filter({ hasText: 'Block A' });
  await expect(reloadedBlockA).toBeVisible();
  const reloadedBox = await reloadedBlockA.boundingBox();
  if (!reloadedBox) throw new Error('Block A has no bounding box after reload');
  expect(Math.abs(reloadedBox.width - resizedBox.width)).toBeLessThan(8);
  expect(Math.abs(reloadedBox.height - resizedBox.height)).toBeLessThan(8);
});

test('chat: send, receive from another user, search', async ({ page, playwright }) => {
  await loginViaApi(page);
  const adminApi = page.context().request;

  // Create a channel and subscribe the seeded chat widget to it (1 s polling
  // keeps the cross-user assertion fast).
  const channelRes = await adminApi.post('/api/chat/channels', {
    data: { name: `e2e-room-${Date.now()}` },
  });
  expect(channelRes.status()).toBe(201);
  const { channel } = await channelRes.json() as { channel: { id: string } };
  const patchRes = await adminApi.patch('/api/services/chat-e2e', {
    data: { options: { channelIds: [channel.id], pollingInterval: 1 } },
  });
  expect(patchRes.ok()).toBeTruthy();

  await page.goto('/');
  const chatWidget = page.locator('.react-grid-item').filter({ hasText: 'Chatroom' });
  await expect(chatWidget).toBeVisible();

  // Send through the composer — bubble renders own-aligned.
  const composer = chatWidget.locator('.chat-composer__input');
  await composer.fill('hello from admin');
  await composer.press('Enter');
  await expect(chatWidget.locator('.chat-bubble--own').filter({ hasText: 'hello from admin' })).toBeVisible();

  // Second user posts via API — message must arrive through polling.
  const userApi = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4317' });
  const registerRes = await userApi.post('/api/auth/register', {
    data: { email: 'chat-user@test.local', password: 'chat-password-123', name: 'Chatter' },
  });
  expect(registerRes.ok()).toBeTruthy();
  const userLogin = await userApi.post('/api/auth/login', {
    data: { email: 'chat-user@test.local', password: 'chat-password-123' },
  });
  expect(userLogin.ok()).toBeTruthy();
  const otherMsg = await userApi.post(`/api/chat/channels/${channel.id}/messages`, {
    data: { body: 'hi from chatter' },
  });
  expect(otherMsg.status()).toBe(201);

  const foreignBubble = chatWidget.locator('.chat-bubble:not(.chat-bubble--own)').filter({ hasText: 'hi from chatter' });
  await expect(foreignBubble).toBeVisible({ timeout: 5000 });
  await expect(chatWidget.locator('.chat-sender').filter({ hasText: 'Chatter' })).toBeVisible();

  // Search finds the admin message.
  await chatWidget.getByLabel('Search messages').click();
  await chatWidget.locator('.chat-search__input').fill('hello');
  await expect(chatWidget.locator('.chat-search__result').filter({ hasText: 'hello from admin' })).toBeVisible();
  await chatWidget.locator('.chat-search__close').click();

  // Both messages survive a reload (persistence, not just optimistic state).
  await page.reload();
  const reloadedChatWidget = page.locator('.react-grid-item').filter({ hasText: 'Chatroom' });
  await expect(reloadedChatWidget.locator('.chat-bubble').filter({ hasText: 'hello from admin' })).toBeVisible();
  await expect(reloadedChatWidget.locator('.chat-bubble').filter({ hasText: 'hi from chatter' })).toBeVisible();
  await userApi.dispose();
});

test('long widget title wraps to a second line instead of clipping', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const clockItem = page.locator('.react-grid-item').filter({ hasText: 'Clock' });
  await expect(clockItem).toBeVisible();

  await enableEditMode(page);

  // Rename the widget to something wider than its card via the config modal.
  await clockItem.hover();
  await clockItem.locator('.widget-edit-actions').getByLabel('Configure widget').click();
  const longTitle = 'An Extremely Long Widget Title That Cannot Fit One Line';
  const titleField = page.locator('.config-field').filter({ hasText: 'Widget title' });
  await titleField.locator('input').fill(longTitle);
  const save = page.waitForResponse(r =>
    r.url().includes('/api/services/') && r.request().method() === 'PATCH' && r.ok());
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
  await save;

  const title = page.locator('.widget-title', { hasText: longTitle }).first();
  const box = await title.boundingBox();
  const lineHeightPx = await title.evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
  expect(box).not.toBeNull();
  // Wrapped = element taller than one line.
  expect(box!.height).toBeGreaterThan(lineHeightPx * 1.5);
  // And no horizontal clipping.
  const overflows = await title.evaluate(el => el.scrollWidth > el.clientWidth + 1);
  expect(overflows).toBe(false);

  await page.getByLabel('Save & exit').click();
});
