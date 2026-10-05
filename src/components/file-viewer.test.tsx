import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { NotificationBody } from './PhotoViewer';

const attachment = { id: 'file1', name: '通知附件.csv', size: 18, position: 2, url: '/api/notification-file?notificationId=n1&id=file1' };

it('keeps the notification behind a closable attachment panel and offers a new-window download', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('姓名,邮箱\n', { status: 200 })));
  render(<NotificationBody body="前文后文" attachments={[attachment]}/>);
  const link = screen.getByRole('link', { name: /通知附件.csv/ });
  expect(link.hasAttribute('download')).toBe(false);
  expect(link.getAttribute('target')).toBe('_blank');
  link.focus();
  fireEvent.click(link);
  const dialog = await screen.findByRole('dialog', { name: attachment.name });
  expect(within(dialog).getByRole('button', { name: '关闭文件' })).toBeTruthy();
  expect(await within(dialog).findByText('姓名,邮箱')).toBeTruthy();
  const download = within(dialog).getByRole('link', { name: '在新窗口下载' });
  expect(download.getAttribute('target')).toBe('_blank');
  expect(download.hasAttribute('download')).toBe(false);
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭文件' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByText('前文')).toBeTruthy();
  expect(document.activeElement).toBe(link);
  vi.unstubAllGlobals();
});

it('lets iOS users share the prepared file without navigating and allows closing on load failure', async () => {
  const share = vi.fn(async (_data: ShareData) => {});
  vi.stubGlobal('fetch', vi.fn(async () => new Response('姓名,邮箱\n', { status: 200 })));
  Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
  Object.defineProperty(navigator, 'share', { configurable: true, value: share });
  render(<NotificationBody body="内容" attachments={[attachment]}/>);
  fireEvent.click(screen.getByRole('link', { name: /通知附件.csv/ }));
  const dialog = await screen.findByRole('dialog', { name: attachment.name });
  fireEvent.click(await within(dialog).findByRole('button', { name: '保存或分享文件' }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  expect(share.mock.calls[0][0]).toMatchObject({ files: [expect.objectContaining({ name: attachment.name, type: 'text/csv' })] });
  fireEvent.click(within(dialog).getByRole('button', { name: '关闭文件' }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: '通知已撤回' }), { status: 404 })));
  fireEvent.click(screen.getByRole('link', { name: /通知附件.csv/ }));
  expect((await screen.findByRole('alert')).textContent).toBe('通知已撤回');
  fireEvent.click(screen.getByRole('button', { name: '关闭文件' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  delete (navigator as Partial<Navigator>).canShare; delete (navigator as Partial<Navigator>).share;
  vi.unstubAllGlobals();
});

it('reuses public file bytes on reopening after a metadata check and rejects a withdrawn file', async () => {
  let withdrawn = false;
  let byteDownloads = 0;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (withdrawn) return new Response(JSON.stringify({ error: '通知已撤回' }), { status: 404 });
    if (init?.method === 'HEAD') return new Response(null, { status: 304, headers: { ETag: '"cached-file"' } });
    byteDownloads++;
    return new Response('姓名,邮箱\n', { headers: { ETag: '"cached-file"' } });
  }));
  const file = { ...attachment, size: 14, url: '/api/notification-file?notificationId=cache-test&id=cache-file' };
  render(<NotificationBody body="内容" attachments={[file]}/>);
  const open = () => fireEvent.click(screen.getByRole('link', { name: /通知附件.csv/ }));
  open(); await screen.findByText('姓名,邮箱');
  fireEvent.click(screen.getByRole('button', { name: '关闭文件' }));
  open(); await screen.findByText('姓名,邮箱');
  expect(byteDownloads).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: '关闭文件' }));
  withdrawn = true;
  open(); expect((await screen.findByRole('alert')).textContent).toBe('通知已撤回');
  expect(screen.queryByText('姓名,邮箱')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '关闭文件' }));
  vi.unstubAllGlobals();
});
