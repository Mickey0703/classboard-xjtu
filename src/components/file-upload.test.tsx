import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import NotificationAdmin, { type NotificationAdminView } from './NotificationAdmin';

function Editor() {
  const [view, setView] = useState<NotificationAdminView>('compose');
  return <><button onClick={() => setView('records')}>记录</button><button onClick={() => setView('compose')}>撰写</button><NotificationAdmin view={view} onViewChange={setView} onPublished={() => {}}/></>;
}

it('uploads a file at the selected body position and preserves it across menu switches and draft saving', async () => {
  const writes: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [{ email: 'a@example.com', displayName: '甲', active: true }] };
    if (url.endsWith('/notification-files')) return { ok: true, json: async () => ({ id: 'file1', name: '报名表.pdf', size: 120, url: '/api/admin/notification-file?id=file1' }) };
    if (init?.method === 'POST') { writes.push(JSON.parse(String(init.body))); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => [] };
  }));
  render(<Editor/>);
  await screen.findByText('已选 1 / 1 人');
  fireEvent.change(screen.getByLabelText('通知标题'), { target: { value: '图文附件' } });
  const body = screen.getByLabelText('通知正文') as HTMLTextAreaElement;
  fireEvent.change(body, { target: { value: '前文后文' } }); body.setSelectionRange(2, 2);
  fireEvent.change(screen.getByLabelText('上传文件'), { target: { files: [new File(['content'], '报名表.pdf', { type: 'application/pdf' })] } });
  await screen.findByRole('link', { name: /报名表.pdf/ });
  fireEvent.click(screen.getByRole('button', { name: '记录' }));
  fireEvent.click(screen.getByRole('button', { name: '撰写' }));
  expect(screen.getByRole('link', { name: /报名表.pdf/ })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(writes).toHaveLength(1));
  expect(writes[0]).toMatchObject({ attachments: [{ id: 'file1', position: 2 }] });
  vi.unstubAllGlobals();
});
