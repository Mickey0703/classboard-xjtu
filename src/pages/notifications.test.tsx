import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Notifications from './Notifications';
import Today from './Today';
import App from '../App';
import type { Snapshot } from '../domain/types';

const snapshot: Snapshot = {
  className: 'ID 2601 班务', demo: true,
  events: [], notifications: [
    { id: 'notice', kind: 'notice', priority: 'urgent', title: '校区调整', body: '明日起在创新港上课。', dueAt: null, pinned: true, publishedAt: '2026-09-29T10:00:00+08:00' },
    { id: 'task', kind: 'task', priority: 'important', title: '提交报名表', body: '周五前提交。', dueAt: '2026-10-02T18:00:00+08:00', pinned: false, publishedAt: '2026-09-29T09:00:00+08:00' }
  ]
};

it('lets visitors read notices but asks them to sign in before confirming', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
  render(<Notifications snapshot={snapshot} now={new Date('2026-09-29T03:00:00Z')} />);
  expect(screen.getByRole('heading', { name: '校区调整' })).toBeTruthy();
  expect(screen.getByText('提交报名表')).toBeTruthy();
  expect(await screen.findByText(/使用班级邮箱登录/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '确认已知悉' })).toBeNull();
  vi.unstubAllGlobals();
});

it('shows the current student’s acknowledgement after a successful save', async () => {
  let acknowledged = false;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/session')) return { ok: true, json: async () => ({ email: 'a@stu.xjtu.edu.cn', displayName: '同学 A' }) };
    if (url.endsWith('/receipt') && init?.method === 'POST') { acknowledged = true; return { ok: true, json: async () => ({}) }; }
    if (url.endsWith('/receipt')) return { ok: true, json: async () => [{ notificationId: 'notice', acknowledgedAt: acknowledged ? '2026-09-29T12:00:00+08:00' : null, completedAt: null }, { notificationId: 'task', acknowledgedAt: null, completedAt: null }] };
    throw Error('unexpected request');
  }));
  render(<Notifications snapshot={snapshot} now={new Date('2026-09-29T03:00:00Z')} />);
  await screen.findByText(/同学 A/);
  fireEvent.click(screen.getAllByRole('button', { name: '确认已知悉' })[0]);
  await waitFor(() => expect(screen.getByText('已知悉')).toBeTruthy());
  vi.unstubAllGlobals();
});

it('promotes an urgent published notice on the homepage', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  render(<Today snapshot={snapshot} now={new Date('2026-09-29T03:00:00Z')} onNavigate={vi.fn()} />);
  expect(screen.getByRole('heading', { name: '校区调整' })).toBeTruthy();
  expect(await screen.findByText('天气暂不可用')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('keeps urgent notices ahead of newer important notices on the homepage', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const two = { ...snapshot, notifications: [
    { ...snapshot.notifications[0], pinned: false },
    { ...snapshot.notifications[1], title: '较新的重要通知', kind: 'notice' as const, dueAt: null, publishedAt: '2026-09-29T12:00:00+08:00' }
  ] };
  render(<Today snapshot={two} now={new Date('2026-09-29T03:00:00Z')} onNavigate={vi.fn()} />);
  expect(screen.getByRole('heading', { name: '校区调整' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '较新的重要通知' })).toBeNull();
  expect(await screen.findByText('天气暂不可用')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('keeps notifications available without course or semester settings', async () => {
  window.history.pushState({}, '', '/?view=notifications');
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/snapshot') ? { ok: true, json: async () => snapshot } : { ok: false, status: 403 }));
  render(<App />);
  expect(await screen.findByText('校区调整')).toBeTruthy();
  vi.unstubAllGlobals();
  window.history.pushState({}, '', '/');
});

it('loads newly published notices when a student opens the notification tab', async () => {
  let latest = { ...snapshot, notifications: [] as Snapshot['notifications'] };
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/snapshot') ? { ok: true, json: async () => latest } : { ok: false, status: 403 }));
  render(<App />);
  await screen.findByText('今天的班务');
  latest = snapshot;
  fireEvent.click(screen.getByRole('button', { name: '通知' }));
  expect(await screen.findByText('校区调整')).toBeTruthy();
  vi.unstubAllGlobals();
});
