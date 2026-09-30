import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Today from './Today';
import Schedule from './Schedule';
import App from '../App';
import Shell from '../components/Shell';
import type { Snapshot } from '../domain/types';

const snapshot: Snapshot = {
  className: 'ID 2601 班务', demo: true,
  events: [{ id: 'e', title: '班会（演示）', description: '教室集合', category: '班级', startAt: '2026-09-29T18:00:00+08:00', dueAt: '2026-09-29T19:00:00+08:00', done: false }],
  notifications: [{ id: 'n', kind: 'notice', priority: 'urgent', title: '班级重要通知', body: '请及时查看。', dueAt: null, pinned: true, publishedAt: '2026-09-29T09:00:00+08:00' }]
};

it('centers the homepage on notices and upcoming matters without class-time widgets', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  render(<Today snapshot={snapshot} now={new Date('2026-09-29T03:00:00Z')} onNavigate={vi.fn()} />);
  expect(screen.getAllByText('班级重要通知').length).toBeGreaterThan(0);
  expect(screen.getByText('班会（演示）')).toBeTruthy();
  expect(screen.queryByText(/下一节|今天的课|今日时间轴|完整课表/)).toBeNull();
  expect(screen.getByRole('link', { name: '查看 ID 2601 完整班徽' })).toBeTruthy();
  expect(await screen.findByText('天气暂不可用')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('offers only today, schedule and notifications in the main navigation', () => {
  render(<Shell page="today" setPage={vi.fn()} brandName="ID 2601 班务"><div>内容</div></Shell>);
  const nav = within(screen.getByRole('navigation', { name: '主导航' }));
  expect(nav.getAllByRole('button').map(button => button.textContent)).toEqual(['今日', '日程', '通知']);
  expect(screen.getByRole('img', { name: 'ID 2601 班徽' })).toBeTruthy();
});

it('loads the homepage without requiring semester settings', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/snapshot') ? { ok: true, json: async () => snapshot } : { ok: false, status: 503 }));
  render(<App />);
  expect((await screen.findAllByText('班级重要通知')).length).toBeGreaterThan(0);
  expect(screen.queryByText('尚未设置学期')).toBeNull();
  vi.unstubAllGlobals();
});

it('filters schedule items by category and date', () => {
  render(<Schedule snapshot={snapshot} now={new Date('2026-09-29T03:00:00Z')} />);
  expect(screen.getByText('班会（演示）')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '学习' }));
  expect(screen.queryByText('班会（演示）')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '全部' }));
  fireEvent.change(screen.getByLabelText('按截止日期筛选'), { target: { value: '2026-09-30' } });
  expect(screen.queryByText('班会（演示）')).toBeNull();
});

it('uses the class name and refreshes the date when the tab becomes visible', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-29T03:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('/api/snapshot') ? { ok: true, json: async () => snapshot } : { ok: false, status: 503 }));
  render(<App />);
  expect(await screen.findByText('ID 2601 班务')).toBeTruthy();
  expect((await screen.findAllByText(/9月29日星期二/)).length).toBeGreaterThan(0);
  vi.setSystemTime(new Date('2026-09-30T00:00:00Z'));
  fireEvent(document, new Event('visibilitychange'));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(screen.getAllByText(/9月30日星期三/).length).toBeGreaterThan(0);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
