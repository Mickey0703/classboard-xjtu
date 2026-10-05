import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const requiredSnapshot = { ...snapshot, notifications: snapshot.notifications.map(item => ({ ...item, requiresCompletionProof: item.kind === 'task' })) };

it('renders notification photos between the selected portions of the body', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const withPhotos = { ...snapshot, notifications: [{ ...snapshot.notifications[0], body: '前文后文', photos: [{ id: 'p1', position: 2, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }] }] };
  render(<Notifications snapshot={withPhotos} now={new Date()} />);
  const photo = screen.getByRole('img', { name: '通知照片 1' });
  expect(photo.closest('.notice-body')?.textContent).toBe('前文后文');
  expect(photo.closest('button')?.previousSibling?.textContent).toBe('前文');
  expect(photo.closest('button')?.nextSibling?.textContent).toBe('后文');
  await screen.findByText('使用班级邮箱登录');
  vi.unstubAllGlobals();
});

it('opens the required completion upload dialog without saving; cancel preserves the pending task', async () => {
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { writes.push(JSON.parse(String(init.body))); return { ok: true }; }
    return { ok: true, json: async () => url.endsWith('/session') ? { email: 'a@example.com', displayName: '同学 A' } : [{ notificationId: 'task', acknowledgedAt: null, completedAt: null }] };
  }));
  render(<Notifications snapshot={requiredSnapshot} now={new Date()} />);
  fireEvent.click(await screen.findByRole('button', { name: '标记已完成' }));
  const dialog = screen.getByRole('dialog', { name: '提交完成照片' });
  expect(within(dialog).getByLabelText('添加完成照片')).toBeTruthy();
  expect(within(dialog).getByText('请添加完成照片或截图，供班委查看。')).toBeTruthy();
  expect((within(dialog).getByRole('button', { name: '确认' }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(dialog).queryByText('无需照片，确认完成')).toBeNull();
  expect(writes).toEqual([]);
  fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(writes).toEqual([]);
  vi.unstubAllGlobals();
});

it('completes a task directly without an upload dialog when proof is not required', async () => {
  let completed = false;
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') { writes.push(JSON.parse(String(init.body))); completed = true; return { ok: true }; }
    return { ok: true, json: async () => url.endsWith('/session') ? { email: 'a@example.com', displayName: '同学 A' } : [{ notificationId: 'task', acknowledgedAt: null, completedAt: completed ? '2026-10-03T12:00:00+08:00' : null }] };
  }));
  render(<Notifications snapshot={snapshot} now={new Date()} />);
  fireEvent.click(await screen.findByRole('button', { name: '标记已完成' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await screen.findByRole('button', { name: '撤销完成' });
  expect(writes).toEqual([{ notificationId: 'task', action: 'complete', photos: [] }]);
  expect(screen.queryByRole('dialog')).toBeNull();
  vi.unstubAllGlobals();
});

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

it('shows the most recently published important notice before older urgent notices on the homepage', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const two = { ...snapshot, notifications: [
    { ...snapshot.notifications[0], pinned: true },
    { ...snapshot.notifications[1], title: '较新的重要通知', kind: 'notice' as const, dueAt: null, publishedAt: '2026-09-29T12:00:00+08:00' }
  ] };
  render(<Today snapshot={two} now={new Date('2026-09-29T03:00:00Z')} onNavigate={vi.fn()} />);
  expect(screen.getByRole('heading', { name: '较新的重要通知' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '校区调整' })).toBeNull();
  expect(await screen.findByText('天气暂不可用')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('orders public notices and the homepage digest by publication time even when older notices are urgent and pinned', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403 })));
  const two = { ...snapshot, notifications: [snapshot.notifications[0], { ...snapshot.notifications[1], title: '最新普通通知', kind: 'notice' as const, priority: 'normal' as const, dueAt: null, publishedAt: '2026-09-29T12:00:00+08:00' }] };
  const noticeView = render(<Notifications snapshot={two} now={new Date()} />);
  expect(screen.getAllByRole('article').map(card => card.querySelector('h2')?.textContent)).toEqual(['最新普通通知', '校区调整']);
  await screen.findByText('使用班级邮箱登录');
  noticeView.unmount();
  const todayView = render(<Today snapshot={two} now={new Date()} onNavigate={vi.fn()} />);
  expect(Array.from(todayView.container.querySelectorAll('.digest-row strong'), element => element.textContent)).toEqual(['最新普通通知', '校区调整']);
  await screen.findByText('天气暂不可用');
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
