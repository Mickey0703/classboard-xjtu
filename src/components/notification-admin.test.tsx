import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import NotificationAdmin from './NotificationAdmin';
import MembersAdmin from './MembersAdmin';

it('lets a committee member save a draft, publish it, and view receipt counts', async () => {
  let row: Record<string, unknown> | null = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('notification-stats')) return { ok: true, json: async () => ({ total: 2, acknowledged: 1, completed: 0, notAcknowledged: [{ email: 'b@stu.xjtu.edu.cn', displayName: '同学 B' }], notCompleted: [] }) };
    if (url.endsWith('/notifications') && (!init?.method || init.method === 'GET')) return { ok: true, json: async () => row ? [row] : [] };
    if (init?.method === 'POST') { row = { id: 'n1', kind: 'notice', priority: 'urgent', title: '班级会议', body: '明天开会', due_at: null, pinned: 1, status: 'draft' }; return { ok: true, json: async () => ({ id: 'n1' }) }; }
    if (init?.method === 'PATCH') { row = { ...row, status: 'published' }; return { ok: true, json: async () => ({ status: 'published' }) }; }
    throw Error('unexpected request');
  }));
  render(<NotificationAdmin onPublished={vi.fn()} />);
  await screen.findByText('还没有通知草稿');
  fireEvent.change(screen.getByLabelText('通知标题'), { target: { value: '班级会议' } });
  fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '明天开会' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await screen.findByRole('button', { name: '发布通知' });
  fireEvent.click(screen.getByRole('button', { name: '发布通知' }));
  await waitFor(() => expect(screen.getByText(/已知悉 1\/2/)).toBeTruthy());
  expect(screen.queryByText(/已完成 0\/2/)).toBeNull();
  vi.unstubAllGlobals();
});

it('lets committee members add and deactivate roster entries', async () => {
  let members: { email: string; displayName: string; active: boolean }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.method || init.method === 'GET') return { ok: true, json: async () => members };
    const body = JSON.parse(String(init.body));
    if (init.method === 'POST') members = [{ email: body.email.toLowerCase(), displayName: body.displayName, active: true }];
    if (init.method === 'DELETE') members = members.map(m => ({ ...m, active: false }));
    return { ok: true, json: async () => ({}) };
  }));
  render(<MembersAdmin />);
  fireEvent.change(screen.getByLabelText('同学姓名'), { target: { value: '同学甲' } });
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'a@stu.xjtu.edu.cn' } });
  fireEvent.click(screen.getByRole('button', { name: '添加成员' }));
  await screen.findByText('a@stu.xjtu.edu.cn');
  fireEvent.click(screen.getByRole('button', { name: '停用成员' }));
  await screen.findByText('已停用');
  vi.unstubAllGlobals();
});

it('reports a published notice separately from a failed homepage refresh', async () => {
  let row: Record<string, unknown> | null = { id: 'n2', kind: 'notice', priority: 'normal', title: '已准备通知', body: '内容', due_at: null, pinned: 0, status: 'draft' };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') { row = { ...row, status: 'published' }; return { ok: true, json: async () => ({ id: 'n2', status: 'published' }) }; }
    return { ok: true, json: async () => [row] };
  }));
  render(<NotificationAdmin onPublished={vi.fn(async () => { throw Error('offline'); })} />);
  fireEvent.click(await screen.findByRole('button', { name: '发布通知' }));
  expect(await screen.findByText(/已发布，但首页刷新失败/)).toBeTruthy();
  vi.unstubAllGlobals();
});

it('refreshes the shared public snapshot after withdrawal', async () => {
  let row: Record<string, unknown> = { id: 'n3', kind: 'notice', priority: 'urgent', title: '撤回测试', body: '内容', due_at: null, pinned: 1, status: 'published' };
  const onChanged = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') { row = { ...row, status: 'withdrawn' }; return { ok: true, json: async () => ({ id: 'n3', status: 'withdrawn' }) }; }
    return { ok: true, json: async () => [row] };
  }));
  render(<NotificationAdmin onPublished={onChanged} />);
  fireEvent.click(await screen.findByRole('button', { name: '撤回' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  vi.unstubAllGlobals();
});
