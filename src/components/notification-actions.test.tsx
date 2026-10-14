import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import NotificationAdmin, { type NotificationAdminView } from './NotificationAdmin';

function Editor({ records = false, onPublished = vi.fn() }: { records?: boolean; onPublished?: () => Promise<void> | void }) {
  const [view, setView] = useState<NotificationAdminView>(records ? 'records' : 'compose');
  return <NotificationAdmin view={view} onViewChange={setView} onPublished={onPublished}/>;
}
const draft = { id: 'draft', title: '测试通知', body: '原正文', kind: 'notice', priority: 'normal', due_at: null, pinned: 0, status: 'draft', recipientEmails: ['a@example.com'] };
function mock(rows = [] as typeof draft[], failPublish = false, losePublishResponse = false) {
  const writes: { method: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [{ email: 'a@example.com', displayName: '甲', active: true }] };
    if (url.includes('notification-stats')) return { ok: true, json: async () => ({ total: 1, acknowledged: 0, completed: 0, notAcknowledged: [], notCompleted: [] }) };
    if (!init?.method) return { ok: true, json: async () => rows };
    const body = JSON.parse(String(init.body));
    writes.push({ method: init.method, body });
    if (init.method === 'POST') rows.push({ ...draft, id: 'created', title: body.title, body: body.body });
    if (init.method === 'PUT') rows = rows.map(row => row.id === body.id ? { ...row, title: body.title, body: body.body } : row);
    if (init.method === 'PATCH') {
      if (failPublish && body.action === 'publish') return { ok: false, json: async () => ({ error: '名单已变化' }) };
      rows = rows.map(row => row.id === body.id ? { ...row, status: body.action === 'publish' ? 'published' : 'draft' } : row);
      if (losePublishResponse && body.action === 'publish') throw new TypeError('Network response lost');
    }
    if (init.method === 'DELETE') rows = rows.filter(row => row.id !== body.id && !(body.ids ?? []).includes(row.id));
    return { ok: true, json: async () => ({ id: body.id || 'created', status: body.action === 'publish' ? 'published' : 'draft' }) };
  }));
  return writes;
}
afterEach(() => vi.unstubAllGlobals());

it('confirms before creating and directly publishing a new notification', async () => {
  const writes = mock();
  render(<Editor/>);
  await screen.findByText('已选 1 / 1 人');
  fireEvent.change(screen.getByLabelText('通知标题'), { target: { value: '立即发布' } });
  fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '正文' } });
  fireEvent.click(screen.getByRole('button', { name: '发布通知' }));
  expect(writes).toHaveLength(0);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }));
  expect(writes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '发布通知' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认发布' }));
  await screen.findByText('通知已发布');
  expect(writes.map(write => write.method)).toEqual(['POST', 'PATCH']);
  expect(writes[1].body).toEqual({ id: 'created', action: 'publish' });
  expect(screen.getByRole('heading', { name: '通知记录' })).toBeTruthy();
});

it('retains the saved draft and reuses its ID when direct publication fails', async () => {
  const writes = mock([], true);
  render(<Editor/>);
  await screen.findByText('已选 1 / 1 人');
  fireEvent.change(screen.getByLabelText('通知标题'), { target: { value: '重试通知' } });
  fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '保留正文' } });
  for (let i = 0; i < 2; i++) {
    fireEvent.click(screen.getByRole('button', { name: '发布通知' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认发布' }));
    await screen.findByText(/草稿已保存，但发布失败/);
  }
  expect(writes.map(write => write.method)).toEqual(['POST', 'PATCH', 'PUT', 'PATCH']);
  expect((screen.getByLabelText('通知正文') as HTMLTextAreaElement).value).toBe('保留正文');
  fireEvent.click(screen.getByRole('button', { name: '取消编辑' }));
  expect(screen.getByText('重试通知')).toBeTruthy();
});

it('reconciles successful publication after its response is lost', async () => {
  const writes = mock([], false, true);
  render(<Editor/>);
  await screen.findByText('已选 1 / 1 人');
  fireEvent.change(screen.getByLabelText('通知标题'), { target: { value: '已发布的通知' } });
  fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '正文' } });
  fireEvent.click(screen.getByRole('button', { name: '发布通知' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认发布' }));
  await screen.findByText('通知已发布');
  expect(screen.getByRole('heading', { name: '通知记录' })).toBeTruthy();
  expect(writes.map(write => write.method)).toEqual(['POST', 'PATCH']);
});

it('returns to records on cancel without saving edits', async () => {
  const writes = mock([draft]);
  render(<Editor records/>);
  fireEvent.click(await screen.findByRole('button', { name: '编辑草稿' }));
  fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '未保存的修改' } });
  fireEvent.click(screen.getByRole('button', { name: '取消编辑' }));
  expect(screen.getByRole('heading', { name: '通知记录' })).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: '通知正文' })).toBeNull();
  expect(writes).toHaveLength(0);
});

it('offers confirmed single deletion for every record status', async () => {
  const writes = mock(['draft', 'published', 'withdrawn'].map((status, index) => ({ ...draft, id: String(index), title: status, status })));
  render(<Editor records/>);
  await screen.findByText('published');
  expect(screen.getAllByRole('button', { name: '删除' })).toHaveLength(3);
  const row = screen.getByText('published').closest('article')!;
  fireEvent.click(within(row).getByRole('button', { name: '删除' }));
  expect(writes).toHaveLength(0);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认删除' }));
  await screen.findByText('已删除 1 条通知');
  expect(writes[0]).toEqual({ method: 'DELETE', body: { id: '1' } });
  expect(screen.queryByText('published')).toBeNull();
});

it('withdraws a published notification into its original draft editor after confirmation', async () => {
  const writes = mock([{ ...draft, status: 'published' }]);
  const changed = vi.fn();
  render(<Editor records onPublished={changed}/>);
  fireEvent.click(await screen.findByRole('button', { name: '撤回并编辑' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认撤回并编辑' }));
  await screen.findByRole('heading', { name: '编辑通知草稿' });
  expect(writes[0]).toEqual({ method: 'PATCH', body: { id: 'draft', action: 'withdraw-edit' } });
  expect((screen.getByLabelText('通知正文') as HTMLTextAreaElement).value).toBe('原正文');
  await waitFor(() => expect(changed).toHaveBeenCalledOnce());
});

it('collapses statistics on the second click', async () => {
  mock([{ ...draft, status: 'published' }]);
  render(<Editor records/>);
  const button = await screen.findByRole('button', { name: '查看统计' });
  fireEvent.click(button);
  await screen.findByRole('heading', { name: '传达统计' });
  fireEvent.click(button);
  expect(screen.queryByRole('heading', { name: '传达统计' })).toBeNull();
  expect(button.getAttribute('aria-expanded')).toBe('false');
});
