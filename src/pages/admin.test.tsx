import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Admin from './Admin';
import type { Snapshot } from '../domain/types';

const snapshot: Snapshot = { demo: true, semester: { title: '秋季', startDate: '2026-09-07', endDate: '2027-01-10', periods: [{ number: 1, start: '08:00', end: '08:45' }] }, courses: [], events: [], notifications: [] };

it('shows a sign-in prompt when admin session is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
  render(<Admin snapshot={snapshot} onSaved={vi.fn()} onBack={vi.fn()} />);
  expect(await screen.findByText(/班委登录/)).toBeTruthy();
  vi.unstubAllGlobals();
});

it('preserves entered course data after save fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/session') ? { ok: true, json: async () => ({ email: 'monitor@stu.xjtu.edu.cn' }) } : { ok: false, json: async () => ({ error: '保存失败' }) }));
  render(<Admin snapshot={snapshot} onSaved={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText(/monitor@stu.xjtu.edu.cn/);
  fireEvent.click(screen.getByRole('button', { name: '课程' }));
  fireEvent.change(screen.getByLabelText('课程名称'), { target: { value: '高等数学' } });
  fireEvent.click(screen.getByRole('button', { name: '保存课程' }));
  await waitFor(() => expect(screen.getByText('保存失败')).toBeTruthy());
  expect((screen.getByLabelText('课程名称') as HTMLInputElement).value).toBe('高等数学');
  vi.unstubAllGlobals();
});

it('keeps a newline while the committee types another class period', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/session') ? { email: 'monitor@stu.xjtu.edu.cn' } : [] })));
  render(<Admin snapshot={snapshot} onSaved={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText(/monitor@stu.xjtu.edu.cn/);
  fireEvent.click(screen.getByRole('button', { name: '学期' }));
  const field = screen.getByLabelText(/节次时间/) as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: '1,08:00,08:45\n' } });
  expect(field.value).toBe('1,08:00,08:45\n');
  vi.unstubAllGlobals();
});

it('reports a saved change whose shared-data refresh failed without clearing the form', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => url.endsWith('/session') ? { ok: true, json: async () => ({ email: 'monitor@stu.xjtu.edu.cn' }) } : url.endsWith('/notifications') && !init?.method ? { ok: true, json: async () => [] } : { ok: true, json: async () => ({}) }));
  render(<Admin snapshot={snapshot} onSaved={vi.fn(async () => { throw Error('offline'); })} onBack={vi.fn()} />);
  await screen.findByText(/monitor@stu.xjtu.edu.cn/);
  fireEvent.click(screen.getByRole('button', { name: '课程' }));
  fireEvent.change(screen.getByLabelText('课程名称'), { target: { value: '高等数学' } });
  fireEvent.click(screen.getByRole('button', { name: '保存课程' }));
  expect(await screen.findByText(/已保存，但刷新失败/)).toBeTruthy();
  expect((screen.getByLabelText('课程名称') as HTMLInputElement).value).toBe('高等数学');
  vi.unstubAllGlobals();
});
