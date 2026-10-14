import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Admin from './Admin';
import type { Snapshot } from '../domain/types';

const snapshot: Snapshot = { className: 'ID 2601 班务', demo: true, events: [], notifications: [] };

it('separates notice composition from records and opens a draft for editing from the records menu', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/session')) return { ok: true, json: async () => ({ email: 'monitor@stu.xjtu.edu.cn' }) };
    if (url.endsWith('/members')) return { ok: true, json: async () => [{ email: 'a@example.com', displayName: '甲', active: true }] };
    return { ok: true, json: async () => [{ id: 'draft', kind: 'notice', priority: 'normal', title: '已有草稿', body: '草稿正文', due_at: null, pinned: 0, status: 'draft' }] };
  }));
  render(<Admin snapshot={snapshot} onSaved={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText(/monitor@stu.xjtu.edu.cn/);
  const menus = within(screen.getByRole('navigation', { name: '班委管理菜单' }));
  expect(menus.getAllByRole('button').map(button => button.textContent)).toEqual(['通知', '通知记录', '日程', '成员', '网站设置']);
  expect(screen.getByRole('heading', { name: '撰写通知' })).toBeTruthy();
  expect(screen.queryByText('已有草稿')).toBeNull();
  fireEvent.click(menus.getByRole('button', { name: '通知记录' }));
  expect(await screen.findByText('已有草稿')).toBeTruthy();
  expect(screen.queryByRole('textbox', { name: '通知正文' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '编辑草稿' }));
  expect((screen.getByLabelText('通知标题') as HTMLInputElement).value).toBe('已有草稿');
  expect((screen.getByLabelText('通知正文') as HTMLTextAreaElement).value).toBe('草稿正文');
  expect(screen.getByRole('button', { name: '发布通知' })).toBeTruthy();
  vi.unstubAllGlobals();
});

it('shows a sign-in prompt when admin session is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
  render(<Admin snapshot={snapshot} onSaved={vi.fn()} onBack={vi.fn()} />);
  expect(await screen.findByText(/班委登录/)).toBeTruthy();
  vi.unstubAllGlobals();
});

it('keeps entered event details after a failed save', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/session') ? { ok: true, json: async () => ({ email: 'monitor@stu.xjtu.edu.cn' }) } : url.endsWith('/notifications') ? { ok: true, json: async () => [] } : { ok: false, json: async () => ({ error: '保存失败' }) }));
  render(<Admin snapshot={snapshot} onSaved={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText(/monitor@stu.xjtu.edu.cn/);
  fireEvent.click(screen.getByRole('button', { name: '日程' }));
  fireEvent.change(screen.getByLabelText('事项标题'), { target: { value: '班会' } });
  fireEvent.change(screen.getByLabelText('开始时间'), { target: { value: '2026-09-29T18:00' } });
  fireEvent.change(screen.getByLabelText('截止时间'), { target: { value: '2026-09-29T19:00' } });
  fireEvent.click(screen.getByRole('button', { name: '保存事项' }));
  await waitFor(() => expect(screen.getByText('保存失败')).toBeTruthy());
  expect((screen.getByLabelText('事项标题') as HTMLInputElement).value).toBe('班会');
  vi.unstubAllGlobals();
});

it('lets the committee update the class display name without semester settings', async () => {
  const calls: { url: string; method?: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method });
    if (url.endsWith('/session')) return { ok: true, json: async () => ({ email: 'monitor@stu.xjtu.edu.cn' }) };
    if (url.endsWith('/notifications')) return { ok: true, json: async () => [] };
    return { ok: true, json: async () => ({}) };
  }));
  render(<Admin snapshot={snapshot} onSaved={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText(/monitor@stu.xjtu.edu.cn/);
  fireEvent.click(screen.getByRole('button', { name: '网站设置' }));
  fireEvent.change(screen.getByLabelText('班级名称'), { target: { value: '工业设计 2601 班' } });
  fireEvent.click(screen.getByRole('button', { name: '保存班级名称' }));
  await waitFor(() => expect(calls.some(call => call.url.endsWith('/api/admin/site-settings') && call.method === 'PUT')).toBe(true));
  vi.unstubAllGlobals();
});
