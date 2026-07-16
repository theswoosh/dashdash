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
  // Grab the handle near its SE corner (where the visible resize glyph is) —
  // on narrow cards the edit pill overlaps the handle's center.
  const resizeHandle = blockA.locator('.react-resizable-handle');
  const handleBox = await resizeHandle.boundingBox();
  if (!handleBox) throw new Error('Resize handle has no bounding box');
  await page.mouse.move(handleBox.x + handleBox.width - 4, handleBox.y + handleBox.height - 4);
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
  // Grab the handle near its SE corner (where the visible resize glyph is) —
  // on narrow cards the edit pill overlaps the handle's center.
  const resizeHandle = blockAInFrame.locator('.react-resizable-handle');
  const handleBox = await resizeHandle.boundingBox();
  if (!handleBox) throw new Error('Resize handle has no bounding box');
  await page.mouse.move(handleBox.x + handleBox.width - 4, handleBox.y + handleBox.height - 4);
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
  // Direct children of the root grid only, and exclude the frame item — during
  // the reparent's SWR revalidation Block A briefly renders both inside the
  // frame (making the frame's outer item match hasText) and on the root.
  const blockAOnRoot = page.locator('.react-grid-layout.dash-grid > .react-grid-item')
    .filter({ hasText: 'Block A' })
    .filter({ hasNot: page.locator('.frame-card') });
  await expect(blockAOnRoot).toBeVisible();
  // Poll: right after the drop the item can still be mid SWR-revalidation
  // (transient size before the PATCHed layout is applied).
  await expect.poll(async () => (await blockAOnRoot.boundingBox())?.width)
    .toBeGreaterThan(resizedBox.width - 8);
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

test('frame shrinks into a vacated child position without an intermediate save', async ({ page }) => {
  await loginViaApi(page);
  const api = page.context().request;

  // Look up ids for the Group frame and Block B via the API — Block A is used
  // (and left back on the root grid) by the previous two tests, so Block B is
  // the one still free to reparent here.
  const servicesRes = await api.get('/api/services');
  const { services: allServices } = await servicesRes.json() as { services: Array<{ id: string; title: string }> };
  const groupId = allServices.find(s => s.title === 'Group')?.id;
  const blockBId = allServices.find(s => s.title === 'Block B')?.id;
  if (!groupId || !blockBId) throw new Error('Fixture missing Group frame or Block B');

  // Persist Block B inside the frame at the right edge (x:16, occupying the
  // last third of the frame's 24-wide inner grid) — this footprint would
  // block shrinking the frame down to w:8 until the child moves away.
  const setupRes = await api.patch(`/api/services/${blockBId}`, {
    data: { parentId: groupId, layout: { x: 16, y: 0, w: 8, h: 8 } },
  });
  expect(setupRes.ok()).toBeTruthy();

  await page.goto('/');
  const frame = page.locator('.frame-card');
  const childInFrame = frame.locator('.react-grid-item').filter({ hasText: 'Block B' });
  await expect(childInFrame).toBeVisible();

  await enableEditMode(page);

  // Drag the child from the right edge to the left edge, in-session only —
  // this move is never saved.
  const childBox = await childInFrame.boundingBox();
  if (!childBox) throw new Error('Block B has no bounding box');
  const dragHandle = childInFrame.locator('.frame-widget-drag-handle');
  await dragHandle.hover();
  await page.mouse.down();
  await page.mouse.move(childBox.x - childBox.width - 4, childBox.y, { steps: 12 });
  await page.mouse.up();

  // Now shrink the frame itself from w:24 toward w:8. Before this fix the
  // resize reverted (red ghost) because the clip check still saw the child
  // at its persisted x:16 position; it must now succeed because the clip
  // check sees the live (moved) in-session position instead.
  const frameItem = page.locator('.react-grid-item').filter({ has: page.locator('.frame-card') });
  const frameBoxBefore = await frameItem.boundingBox();
  if (!frameBoxBefore) throw new Error('Frame has no bounding box');

  // Direct child only — a descendant selector also matches the resize
  // handles of the frame's own inner-grid children (strict-mode violation).
  const resizeHandle = frameItem.locator('> .react-resizable-handle');
  await resizeHandle.hover({ force: true });
  await page.mouse.down();
  await page.mouse.move(frameBoxBefore.x + frameBoxBefore.width / 3, frameBoxBefore.y + frameBoxBefore.height, { steps: 12 });
  await page.mouse.up();

  const frameBoxAfter = await frameItem.boundingBox();
  if (!frameBoxAfter) throw new Error('Frame has no bounding box after resize');

  // A reverted resize snaps back to the original width; a successful shrink
  // must leave the frame noticeably narrower.
  expect(frameBoxAfter.width).toBeLessThan(frameBoxBefore.width * 0.75);

  await page.getByLabel('Save & exit').click();
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

test('chat: message from another user appears via websocket push, not a 5s poll', async ({ page, playwright }) => {
  await loginViaApi(page);
  const adminApi = page.context().request;

  // Same channel/widget setup as the previous chat E2E test, but pollingInterval
  // is disabled (0) so any message arrival can only be explained by the WS
  // push, not the fallback poll.
  const channelRes = await adminApi.post('/api/chat/channels', {
    data: { name: `e2e-ws-room-${Date.now()}` },
  });
  expect(channelRes.status()).toBe(201);
  const { channel } = await channelRes.json() as { channel: { id: string } };
  const patchRes = await adminApi.patch('/api/services/chat-e2e', {
    data: { options: { channelIds: [channel.id], pollingInterval: 0 } },
  });
  expect(patchRes.ok()).toBeTruthy();

  await page.goto('/');
  const chatWidget = page.locator('.react-grid-item').filter({ hasText: 'Chatroom' });
  await expect(chatWidget).toBeVisible();

  const userApi = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4317' });
  const registerRes = await userApi.post('/api/auth/register', {
    data: { email: 'chat-ws-user@test.local', password: 'chat-password-123', name: 'WsChatter' },
  });
  expect(registerRes.ok()).toBeTruthy();
  const userLogin = await userApi.post('/api/auth/login', {
    data: { email: 'chat-ws-user@test.local', password: 'chat-password-123' },
  });
  expect(userLogin.ok()).toBeTruthy();

  const otherMsg = await userApi.post(`/api/chat/channels/${channel.id}/messages`, {
    data: { body: 'pushed instantly' },
  });
  expect(otherMsg.ok()).toBeTruthy();

  // No reload, no wait — push must land within a couple seconds, well under
  // the old 5s poll interval this widget explicitly disabled.
  await expect(
    chatWidget.locator('.chat-bubble').filter({ hasText: 'pushed instantly' }),
  ).toBeVisible({ timeout: 3000 });

  await userApi.dispose();
});

test('chat: inactive tab shows an unread dot until selected', async ({ page, playwright }) => {
  await loginViaApi(page);
  const adminApi = page.context().request;

  // Two channels on the same widget: the second stays inactive so a message
  // pushed into it must produce a tab dot, not just update the active view.
  const firstChannelRes = await adminApi.post('/api/chat/channels', {
    data: { name: `e2e-unread-first-${Date.now()}` },
  });
  expect(firstChannelRes.status()).toBe(201);
  const { channel: firstChannel } = await firstChannelRes.json() as { channel: { id: string; name: string } };

  const secondChannelRes = await adminApi.post('/api/chat/channels', {
    data: { name: `e2e-unread-second-${Date.now()}` },
  });
  expect(secondChannelRes.status()).toBe(201);
  const { channel: secondChannel } = await secondChannelRes.json() as { channel: { id: string; name: string } };

  const patchRes = await adminApi.patch('/api/services/chat-e2e', {
    data: { options: { channelIds: [firstChannel.id, secondChannel.id], pollingInterval: 0 } },
  });
  expect(patchRes.ok()).toBeTruthy();

  await page.goto('/');
  const chatWidget = page.locator('.react-grid-item').filter({ hasText: 'Chatroom' });
  await expect(chatWidget).toBeVisible();

  const userApi = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4317' });
  const registerRes = await userApi.post('/api/auth/register', {
    data: { email: 'chat-unread-user@test.local', password: 'chat-password-123', name: 'UnreadChatter' },
  });
  expect(registerRes.ok()).toBeTruthy();
  const userLogin = await userApi.post('/api/auth/login', {
    data: { email: 'chat-unread-user@test.local', password: 'chat-password-123' },
  });
  expect(userLogin.ok()).toBeTruthy();

  const otherChannelMsg = await userApi.post(`/api/chat/channels/${secondChannel.id}/messages`, {
    data: { body: 'unread me' },
  });
  expect(otherChannelMsg.ok()).toBeTruthy();

  await expect(chatWidget.locator('.chat-tab__unread-dot')).toBeVisible({ timeout: 3000 });
  await chatWidget.getByRole('tab', { name: new RegExp(secondChannel.name, 'i') }).click();
  await expect(chatWidget.locator('.chat-tab__unread-dot')).toHaveCount(0);

  await userApi.dispose();
});

test('chat: admin restricts a channel to specific members', async ({ page, playwright }) => {
  await loginViaApi(page);
  const adminApi = page.context().request;

  const channelRes = await adminApi.post('/api/chat/channels', {
    data: { name: `e2e-acl-${Date.now()}` },
  });
  expect(channelRes.status()).toBe(201);
  const { channel } = await channelRes.json() as { channel: { id: string; name: string } };
  const patchRes = await adminApi.patch('/api/services/chat-e2e', {
    data: { options: { channelIds: [channel.id], pollingInterval: 0 } },
  });
  expect(patchRes.ok()).toBeTruthy();

  // Second (member-to-be) and third (never-added) users, registered up front
  // so both appear in the admin's user picker.
  const memberApi = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4317' });
  await memberApi.post('/api/auth/register', {
    data: { email: 'chat-acl-member@test.local', password: 'chat-password-123', name: 'AclMember' },
  });
  const memberLogin = await memberApi.post('/api/auth/login', {
    data: { email: 'chat-acl-member@test.local', password: 'chat-password-123' },
  });
  expect(memberLogin.ok()).toBeTruthy();

  const outsiderApi = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:4317' });
  await outsiderApi.post('/api/auth/register', {
    data: { email: 'chat-acl-outsider@test.local', password: 'chat-password-123', name: 'AclOutsider' },
  });
  const outsiderLogin = await outsiderApi.post('/api/auth/login', {
    data: { email: 'chat-acl-outsider@test.local', password: 'chat-password-123' },
  });
  expect(outsiderLogin.ok()).toBeTruthy();

  // Sanity: channel is open before any member is added.
  const beforeMsg = await outsiderApi.post(`/api/chat/channels/${channel.id}/messages`, {
    data: { body: 'still open' },
  });
  expect(beforeMsg.status()).toBe(201);

  // Admin opens the chat widget's config modal, edits the channel, and adds
  // the member through the picker.
  await page.goto('/');
  await enableEditMode(page);
  const chatWidget = page.locator('.react-grid-item').filter({ hasText: 'Chatroom' });
  await chatWidget.getByLabel('Configure widget').click();
  const modal = page.locator('.modal');
  await expect(modal).toBeVisible();

  const channelRow = modal.locator('.channels-editor__row').filter({ hasText: channel.name });
  await channelRow.getByLabel(`Edit ${channel.name}`).click();
  const editingRow = modal.locator('.channels-editor__row--editing').filter({ hasText: channel.name });
  await editingRow.locator('.channel-members-picker__add select').selectOption({ label: 'AclMember' });
  await editingRow.locator('.channel-members-picker__add button').click();
  await expect(editingRow.locator('.channel-members-picker__list li').filter({ hasText: 'AclMember' })).toBeVisible();
  await modal.getByLabel('Close').click();

  // Member can now post; the never-added outsider is rejected.
  const memberMsg = await memberApi.post(`/api/chat/channels/${channel.id}/messages`, {
    data: { body: 'member in' },
  });
  expect(memberMsg.status()).toBe(201);

  const afterMsg = await outsiderApi.post(`/api/chat/channels/${channel.id}/messages`, {
    data: { body: 'outsider blocked' },
  });
  expect(afterMsg.status()).toBe(403);

  await memberApi.dispose();
  await outsiderApi.dispose();
});

test('long widget title wraps to a second line instead of clipping', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  let clockItem = page.locator('.react-grid-item').filter({ hasText: 'Clock' });
  await expect(clockItem).toBeVisible();
  // Tag the element before renaming it — once the title changes, a
  // hasText: 'Clock' locator stops matching this item at all.
  await clockItem.evaluate(el => el.setAttribute('data-e2e-clock', 'true'));
  clockItem = page.locator('[data-e2e-clock="true"]');

  await enableEditMode(page);

  // Rename the widget to something wider than its card via the config modal.
  // Clock is narrower than the 90px container-query breakpoint, so its
  // Configure button lives in the always-visible flyout, not .widget-edit-actions.
  await clockItem.hover();
  await clockItem.locator('button[aria-label="Configure widget"]:visible').click();
  const longTitle = 'An Extremely Long Widget Title That Cannot Fit One Line';
  const titleField = page.locator('.config-field').filter({ hasText: 'Widget title' });
  // The title field wraps both the text input and the hide-header checkbox —
  // narrow to the text input to avoid a strict-mode violation.
  await titleField.locator('input[type="text"]').fill(longTitle);
  const save = page.waitForResponse(r =>
    r.url().includes('/api/services/') && r.request().method() === 'PATCH' && r.ok());
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
  await save;

  const title = page.locator('.widget-title', { hasText: longTitle }).first();
  const box = await title.boundingBox();
  // line-height is unset (computes to 'normal', not a px value) — fall back
  // to the standard ~1.2x-font-size approximation for a single line.
  const lineHeightPx = await title.evaluate(el => {
    const style = getComputedStyle(el);
    const parsed = parseFloat(style.lineHeight);
    return Number.isNaN(parsed) ? parseFloat(style.fontSize) * 1.2 : parsed;
  });
  expect(box).not.toBeNull();
  // Wrapped = element taller than one line.
  expect(box!.height).toBeGreaterThan(lineHeightPx * 1.5);
  // And no horizontal clipping.
  const overflows = await title.evaluate(el => el.scrollWidth > el.clientWidth + 1);
  expect(overflows).toBe(false);

  // Restore the original title — later tests locate this widget by its
  // "Clock" text, and the suite shares one services.yml across the run.
  await clockItem.locator('button[aria-label="Configure widget"]:visible').click();
  const restoreTitleField = page.locator('.config-field').filter({ hasText: 'Widget title' });
  await restoreTitleField.locator('input[type="text"]').fill('Clock');
  const restoreSave = page.waitForResponse(r =>
    r.url().includes('/api/services/') && r.request().method() === 'PATCH' && r.ok());
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
  await restoreSave;

  await page.getByLabel('Save & exit').click();
});

test('hide header bar applies immediately in edit mode and the widget stays draggable', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  let clockItem = page.locator('.react-grid-item').filter({ hasText: 'Clock' });
  await expect(clockItem).toBeVisible();
  // Tag the element before hiding its header — once hidden, the "Clock" text
  // (only present in the header title) disappears, and a hasText-filtered
  // locator would stop matching anything at all.
  await clockItem.evaluate(el => el.setAttribute('data-e2e-clock', 'true'));
  clockItem = page.locator('[data-e2e-clock="true"]');

  await enableEditMode(page);
  await clockItem.hover();
  // Clock is narrower than the 90px container-query breakpoint, so its
  // Configure button lives in the always-visible flyout, not .widget-edit-actions.
  await clockItem.locator('button[aria-label="Configure widget"]:visible').click();
  await page.locator('.config-field--checkbox').filter({ hasText: 'Hide header bar' }).locator('input').check();
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();

  // WITHOUT saving the board: the header disappears immediately.
  await expect(clockItem.locator('.widget-header')).toHaveCount(0);
  const flyout = clockItem.locator('.widget-edit-flyout--always');
  await expect(flyout).toBeVisible();

  // The drag handle relocated into the flyout and the widget is still draggable.
  const initialTransform = await clockItem.evaluate(el => (el as HTMLElement).style.transform);
  const handle = flyout.locator('.grid-drag-handle');
  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(400, 300, { steps: 12 });
  await page.mouse.up();
  const movedTransform = await clockItem.evaluate(el => (el as HTMLElement).style.transform);
  expect(movedTransform).not.toBe(initialTransform);

  await page.getByLabel('Save & exit').click();
});

test('narrow-widget edit pill does not cover the resize handle', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');

  // Block B lives inside the Group frame at w:8 (~72px, narrower than the
  // 90px container-query breakpoint) since the frame-shrink test above left
  // it there. Its always-visible edit pill is the one under test — Clock's
  // header is permanently hidden by the previous test, so it can no longer
  // be located by its title text.
  const frame = page.locator('.frame-card');
  const item = frame.locator('.react-grid-item').filter({ hasText: 'Block B' });
  await expect(item).toBeVisible();

  await enableEditMode(page);
  await item.hover();

  // Direct child only — a descendant selector would also match the frame's
  // own outer resize handle.
  const handle = item.locator('> .react-resizable-handle');
  const hb = await handle.boundingBox();
  if (!hb) throw new Error('Resize handle has no bounding box');

  // The topmost element at the handle's center must be the handle, not the pill.
  const topEl = await page.evaluate(
    ({ x, y }) => document.elementFromPoint(x, y)?.className ?? '',
    { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 },
  );
  expect(topEl).toContain('react-resizable-handle');

  await page.getByLabel('Save & exit').click();
});

test('chat: markdown renders bold/italic when enabled on the channel, plain text otherwise', async ({ page }) => {
  await loginViaApi(page);
  const adminApi = page.context().request;

  // Channel starts with markdown off (default) — subscribe the seeded chat
  // widget to it.
  const channelRes = await adminApi.post('/api/chat/channels', {
    data: { name: `e2e-md-room-${Date.now()}` },
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

  // Markdown off (default): raw markers render as literal text.
  const composer = chatWidget.locator('.chat-composer__input');
  await composer.fill('**bold** and *italic*');
  await composer.press('Enter');
  const plainBubble = chatWidget.locator('.chat-bubble--own').filter({ hasText: '**bold** and *italic*' });
  await expect(plainBubble).toBeVisible();
  await expect(plainBubble.locator('strong')).toHaveCount(0);
  await expect(plainBubble.locator('em')).toHaveCount(0);

  // Enable markdownEnabled on the channel via the channels editor toggle.
  const channelPatchRes = await adminApi.patch(`/api/chat/channels/${channel.id}`, {
    data: { markdownEnabled: true },
  });
  expect(channelPatchRes.ok()).toBeTruthy();
  await page.reload();
  const reloadedChatWidget = page.locator('.react-grid-item').filter({ hasText: 'Chatroom' });
  await expect(reloadedChatWidget).toBeVisible();

  const composer2 = reloadedChatWidget.locator('.chat-composer__input');
  await composer2.fill('**bold** and *italic*');
  await composer2.press('Enter');
  const mdBubble = reloadedChatWidget.locator('.chat-bubble--own').filter({ hasText: 'bold and italic' });
  await expect(mdBubble.locator('strong').filter({ hasText: 'bold' })).toBeVisible();
  await expect(mdBubble.locator('em').filter({ hasText: 'italic' })).toBeVisible();
});

test('chat: switching skin changes the widget root class', async ({ page }) => {
  await loginViaApi(page);
  await page.goto('/');
  const chatWidget = page.locator('.react-grid-item').filter({ hasText: 'Chatroom' });
  await expect(chatWidget).toBeVisible();

  await enableEditMode(page);
  await chatWidget.hover();
  await chatWidget.locator('.widget-edit-actions').getByLabel('Configure widget').click();
  const skinField = page.locator('.config-field').filter({ hasText: 'Skin' });
  await skinField.locator('select').selectOption('irc');
  const save = page.waitForResponse(r =>
    r.url().includes('/api/services/') && r.request().method() === 'PATCH' && r.ok());
  await page.locator('.modal').getByRole('button', { name: 'Save' }).click();
  await save;

  await expect(chatWidget.locator('.chat-widget')).toHaveClass(/chat--skin-irc/);
});

test('chat: tiny layout shows a last-message preview line', async ({ page }) => {
  await loginViaApi(page);
  const adminApi = page.context().request;

  const channelRes = await adminApi.post('/api/chat/channels', {
    data: { name: `e2e-tiny-room-${Date.now()}` },
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

  const composer = chatWidget.locator('.chat-composer__input');
  await composer.fill('hello from admin');
  await composer.press('Enter');
  await expect(chatWidget.locator('.chat-bubble--own').filter({ hasText: 'hello from admin' })).toBeVisible();

  const tinyPatchRes = await adminApi.patch('/api/services/chat-e2e', {
    data: { options: { channelIds: [channel.id], pollingInterval: 1, layoutSize: 'tiny' } },
  });
  expect(tinyPatchRes.ok()).toBeTruthy();
  await page.reload();

  const tinyWidget = page.locator('.react-grid-item').filter({ hasText: 'Chatroom' });
  await expect(tinyWidget.locator('.chat-widget--tiny')).toBeVisible();
  await expect(tinyWidget.locator('.chat-widget--tiny__preview')).toContainText('hello from admin');
});
