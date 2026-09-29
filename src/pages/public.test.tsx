import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Today from './Today';
import Timetable from './Timetable';
import Schedule from './Schedule';
import App from '../App';
import Shell from '../components/Shell';
import type { Snapshot } from '../domain/types';

const snapshot: Snapshot = {
  demo: true,
  semester: { title: '秋季', startDate: '2026-09-28', endDate: '2026-10-18', periods: [{ number: 1, start: '08:00', end: '08:45' }] },
  courses: [{ id: 'c', title: '高等数学（演示）', teacher: '张老师', location: 'A101', weekday: 1, startPeriod: 1, endPeriod: 1, startWeek: 1, endWeek: 3, weekType: 'all' }],
  events: [{ id: 'e', title: '班会（演示）', description: '教室集合', category: '班级', startAt: '2026-09-29T18:00:00+08:00', dueAt: '2026-09-29T19:00:00+08:00', done: false }]
  ,notifications: []
};

it("shows today's course and clearly labels demo content", async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  render(<Today snapshot={snapshot} now={new Date('2026-09-28T00:00:00Z')} onNavigate={vi.fn()} />);
  expect(screen.getByText(/演示数据/)).toBeTruthy();
  expect(screen.getAllByText(/高等数学（演示）/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/下一节/).length).toBeGreaterThan(0);
  expect(screen.getByRole('img', { name: 'ID 2601 班徽' })).toBeTruthy();
  expect(screen.getByRole('link', { name: '查看 ID 2601 完整班徽' }).getAttribute('href')).toBe('/class-emblem.png');
  expect(await screen.findByText('天气暂不可用')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('shows the class emblem in the shared header', () => {
  render(<Shell page="today" setPage={vi.fn()}><div>内容</div></Shell>);
  expect(screen.getByRole('img', { name: 'ID 2601 班徽' }).getAttribute('src')).toBe('/class-emblem.png');
});

it('shows the date when the next class is on a later day', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
  const withTomorrow = { ...snapshot, courses: [{ ...snapshot.courses[0], weekday: 2 }] };
  render(<Today snapshot={withTomorrow} now={new Date('2026-09-28T03:00:00Z')} onNavigate={vi.fn()} />);
  expect(screen.getByText(/9月29日 08:00 开始/)).toBeTruthy();
  expect(await screen.findByText('天气暂不可用')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('switches teaching weeks in the timetable', () => {
  render(<Timetable snapshot={snapshot} now={new Date('2026-09-28T00:00:00Z')} />);
  expect(screen.getByText(/第 1 周/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '下周' }));
  expect(screen.getByText(/第 2 周/)).toBeTruthy();
});

it('shows a course in every period it occupies', () => {
  const twoPeriods = { ...snapshot, semester: { ...snapshot.semester, periods: [...snapshot.semester.periods, { number: 2, start: '08:55', end: '09:40' }] }, courses: [{ ...snapshot.courses[0], endPeriod: 2 }] };
  render(<Timetable snapshot={twoPeriods} now={new Date('2026-09-28T00:00:00Z')} />);
  expect(screen.getAllByText('高等数学（演示）')).toHaveLength(2);
});

it('explains an empty timetable week and shows full details when a course is selected', () => {
  const empty = { ...snapshot, courses: [] };
  const view = render(<Timetable snapshot={empty} now={new Date('2026-09-28T00:00:00Z')} />);
  expect(screen.getByText('本周没有课程')).toBeTruthy();
  view.rerender(<Timetable snapshot={snapshot} now={new Date('2026-09-28T00:00:00Z')} />);
  fireEvent.click(screen.getByRole('button', { name: /查看高等数学（演示）详情/ }));
  expect(screen.getByText(/1-3 周/)).toBeTruthy();
  expect(screen.getByText(/08:00–08:45/)).toBeTruthy();
});

it('filters schedule items by category', () => {
  render(<Schedule snapshot={snapshot} now={new Date('2026-09-28T00:00:00Z')} />);
  expect(screen.getByText('班会（演示）')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '学习' }));
  expect(screen.queryByText('班会（演示）')).toBeNull();
});

it('filters schedule items by selected date', () => {
  render(<Schedule snapshot={snapshot} now={new Date('2026-09-28T00:00:00Z')} />);
  fireEvent.change(screen.getByLabelText('按截止日期筛选'), { target: { value: '2026-09-30' } });
  expect(screen.queryByText('班会（演示）')).toBeNull();
});

it('explains when the class has not configured a semester', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ semester: { title: '', startDate: '', endDate: '', periods: [] }, courses: [], events: [], demo: false }) })));
  render(<App />);
  expect(await screen.findByText(/尚未设置学期/)).toBeTruthy();
  vi.unstubAllGlobals();
});

it('uses the class name configured by the committee in the header', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...snapshot, semester: { ...snapshot.semester, className: '能动学院某班' } }) })));
  render(<App />);
  expect(await screen.findByText('能动学院某班')).toBeTruthy();
  expect(await screen.findByText('天气暂不可用')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('updates the displayed date when the tab becomes visible after midnight', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-28T12:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => snapshot })));
  render(<App />);
  expect((await screen.findAllByText(/9月28日星期一/)).length).toBeGreaterThan(0);
  expect(await screen.findByText('天气暂不可用')).toBeTruthy();
  vi.setSystemTime(new Date('2026-09-29T00:00:00Z'));
  fireEvent(document, new Event('visibilitychange'));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(screen.getAllByText(/9月29日星期二/).length).toBeGreaterThan(0);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
