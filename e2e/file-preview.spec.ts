import { expect, test } from '@playwright/test';
import { previewPdf } from './fixtures/pdf';

test('PDF preview and iOS file sharing keep the notification open and the close button accessible', async ({ page }) => {
  const bytes = previewPdf();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    // Older iOS browsers lack these APIs. PDF.js must supply its own fallbacks.
    Object.defineProperty(Promise, 'withResolvers', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(Map.prototype, 'getOrInsertComputed', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(Uint8Array.prototype, 'toBase64', { value: undefined, writable: true, configurable: true });
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => { const file = data.files![0]; (window as unknown as { sharedFile: unknown }).sharedFile = { name: file.name, type: file.type, size: file.size }; } });
  });
  await page.route('**/api/snapshot', route => route.fulfill({ json: { className: 'ID 2601 班务', events: [], demo: false, notifications: [{ id: 'pdf-notice', kind: 'notice', priority: 'normal', pinned: false, title: '可退出的文件预览', body: '打开后可以回到这里。', dueAt: null, publishedAt: '2026-10-05T18:00:00+08:00', attachments: [{ id: 'pdf-file', name: '可关闭预览.pdf', size: bytes.length, position: 4, url: '/api/notification-file?notificationId=pdf-notice&id=pdf-file' }] }] } }));
  await page.route('**/api/member/**', route => route.fulfill({ status: 403, json: { error: 'not signed in' } }));
  await page.route('**/api/notification-file?**', route => route.fulfill({ body: bytes, contentType: 'application/octet-stream' }));
  await page.goto('/?view=notifications');
  const initialUrl = page.url();
  const link = page.getByRole('link', { name: /可关闭预览.pdf/ });
  await link.click();
  const panel = page.getByRole('dialog', { name: '可关闭预览.pdf' });
  await expect(panel.getByRole('button', { name: '关闭文件' })).toBeVisible();
  await expect(panel.getByRole('button', { name: '下一页' })).toBeEnabled({ timeout: 15000 });
  expect(await panel.locator('canvas').evaluate(canvas => {
    const element = canvas as HTMLCanvasElement;
    const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data;
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index + 3] > 0 && pixels[index] < 180 && pixels[index + 1] < 180 && pixels[index + 2] < 180) return true;
    return false;
  })).toBe(true);
  await panel.getByRole('button', { name: '下一页' }).click();
  await expect(panel.getByText('第 2 / 2 页')).toBeVisible();
  await expect(panel.getByRole('button', { name: '上一页' })).toBeEnabled();
  await panel.getByRole('combobox', { name: 'PDF 缩放' }).selectOption('2');
  await expect(panel.getByRole('button', { name: '上一页' })).toBeEnabled();
  await panel.locator('.file-preview').evaluate(element => { element.scrollTop = element.scrollHeight; element.scrollLeft = element.scrollWidth; });
  await expect(panel.getByRole('button', { name: '关闭文件' })).toBeVisible();
  await page.screenshot({ path: 'test-results/closable-pdf-mobile.png', animations: 'disabled' });
  await panel.getByRole('button', { name: '保存或分享文件' }).click();
  expect(await page.evaluate(() => (window as unknown as { sharedFile: unknown }).sharedFile)).toEqual({ name: '可关闭预览.pdf', type: 'application/pdf', size: bytes.length });
  expect(page.url()).toBe(initialUrl);
  await panel.getByRole('button', { name: '关闭文件' }).click();
  await expect(panel).toHaveCount(0);
  await expect.poll(() => page.workers().length).toBe(0);
  await expect(page.getByRole('heading', { name: '可退出的文件预览' })).toBeVisible();
  await link.click();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect.poll(() => page.workers().length).toBe(0);
});
