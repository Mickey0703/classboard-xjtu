import { expect, test } from '@playwright/test';

test('home metrics count unread or unfinished notices and link to their pages at mobile and desktop widths', async ({ page }) => {
  const notification = { kind: 'notice', priority: 'normal', title: '通知', body: '正文', pinned: false, dueAt: null, publishedAt: '2026-10-01T10:00:00+08:00' };
  const snapshot = { className: '班务', demo: false, notifications: [
    { ...notification, id: 'unread' },
    { ...notification, id: 'task', kind: 'task', dueAt: '2099-01-01T18:00:00+08:00' },
    { ...notification, id: 'done', kind: 'task', dueAt: '2099-01-01T18:00:00+08:00' }
  ], events: [{ id: 'event', title: '日程', description: '安排', category: '班级', done: false, startAt: '2099-01-01T10:00:00+08:00', dueAt: '2099-01-01T18:00:00+08:00' }] };
  await page.route('**/api/snapshot', route => route.fulfill({ json: snapshot }));
  await page.route('**/api/member/session', route => route.fulfill({ json: { email: 'a@example.com', displayName: '同学甲' } }));
  await page.route('**/api/member/receipt', route => route.fulfill({ json: [
    { notificationId: 'unread', acknowledgedAt: null, completedAt: null },
    { notificationId: 'task', acknowledgedAt: null, completedAt: null },
    { notificationId: 'done', acknowledgedAt: 'at', completedAt: 'at' }
  ] }));
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const summary = page.locator('.summary-strip');
    await expect(page.getByRole('status', { name: '未知悉/未完成' }).locator('strong')).toHaveText('2条');
    expect(await summary.getByRole('link').allTextContents()).toEqual([expect.stringContaining('已发布通知'), expect.stringContaining('未知悉/未完成'), expect.stringContaining('近期日程')]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await summary.screenshot({ path: `test-results/home-metrics-${width}.png` });
    await summary.getByRole('link', { name: /未知悉\/未完成/ }).click();
    await expect(page.getByRole('heading', { name: '班级通知', exact: true })).toBeVisible();
    await page.goto('/');
    await summary.getByRole('link', { name: /已发布通知/ }).click();
    await expect(page.getByRole('heading', { name: '班级通知', exact: true })).toBeVisible();
    await page.goto('/');
    await summary.getByRole('link', { name: /近期日程/ }).click();
    await expect(page.getByRole('heading', { name: '班级日程', exact: true })).toBeVisible();
    await page.goto('/?view=schedule');
    await expect(page.getByRole('heading', { name: '班级日程', exact: true })).toBeVisible();
  }
});
