import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Admin from './Admin';
import type { Snapshot } from '../domain/types';

const snapshot: Snapshot = { className: 'ID 2601 班务', demo: true, events: [], notifications: [] };

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
