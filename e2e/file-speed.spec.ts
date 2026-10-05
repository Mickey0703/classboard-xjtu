import { expect, test } from '@playwright/test';

test('prepares a visible small attachment before opening and only revalidates on reuse', async ({ page }) => {
  const bytes = Buffer.from('姓名,邮箱\n', 'utf8');
  let byteDownloads = 0; let withdrawn = false;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async () => {} });
  });
  await page.route('**/api/snapshot', route => route.fulfill({ json: { className: '班务', events: [], demo: false, notifications: [{ id: 'speed', kind: 'notice', title: '附件准备测试', body: '点击文件', priority: 'normal', pinned: false, dueAt: null, publishedAt: '2026-10-05T18:00:00+08:00', attachments: [{ id: 'f', name: '快速保存.csv', size: bytes.length, position: 0, url: '/api/notification-file?notificationId=speed&id=f' }] }] } }));
  await page.route('**/api/member/**', route => route.fulfill({ status: 403, json: { error: 'unauthorized' } }));
  await page.route('**/api/notification-file?**', async route => {
    if (withdrawn) { await route.fulfill({ status: 404, json: { error: '通知已撤回' } }); return; }
    if (route.request().method() === 'HEAD') { await route.fulfill({ status: 304, headers: { ETag: '"speed-etag"' } }); return; }
    byteDownloads++;
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.fulfill({ body: bytes, contentType: 'application/octet-stream', headers: { ETag: '"speed-etag"', 'Content-Length': String(bytes.length) } });
  });
  const prepared = page.waitForResponse(response => response.url().includes('/api/notification-file?') && response.request().method() === 'GET');
  await page.goto('/?view=notifications');
  const link = page.getByRole('link', { name: /快速保存.csv/ });
  await link.scrollIntoViewIfNeeded();
  await (await prepared).finished();
  const start = Date.now();
  await link.click();
  await expect(page.getByRole('button', { name: '保存或分享文件' })).toBeEnabled();
  expect(Date.now() - start).toBeLessThan(1000);
  await page.getByRole('button', { name: '关闭文件' }).click();
  await link.click();
  await expect(page.getByRole('button', { name: '保存或分享文件' })).toBeEnabled();
  expect(byteDownloads).toBe(1);
  await page.getByRole('button', { name: '关闭文件' }).click();
  withdrawn = true;
  await link.click();
  await expect(page.getByRole('alert')).toHaveText('通知已撤回');
  await expect(page.getByRole('button', { name: '保存或分享文件' })).toHaveCount(0);
});
