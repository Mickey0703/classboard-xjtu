import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import Today from './Today';
import Timetable from './Timetable';
import Schedule from './Schedule';
import type { Snapshot } from '../domain/types';

const snapshot: Snapshot = {
  demo: true,
  semester: { title: '秋季', startDate: '2026-09-28', endDate: '2026-10-18', periods: [{ number: 1, start: '08:00', end: '08:45' }] },
  courses: [{ id: 'c', title: '高等数学（演示）', teacher: '张老师', location: 'A101', weekday: 1, startPeriod: 1, endPeriod: 1, startWeek: 1, endWeek: 3, weekType: 'all' }],
  events: [{ id: 'e', title: '班会（演示）', description: '教室集合', category: '班级', startAt: '2026-09-29T18:00:00+08:00', dueAt: '2026-09-29T19:00:00+08:00', done: false }]
};

it("shows today's course and clearly labels demo content", () => {
  render(<Today snapshot={snapshot} now={new Date('2026-09-28T00:00:00Z')} onNavigate={vi.fn()} />);
  expect(screen.getByText(/演示数据/)).toBeTruthy();
  expect(screen.getAllByText(/高等数学（演示）/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/下一节/).length).toBeGreaterThan(0);
});

it('switches teaching weeks in the timetable', () => {
  render(<Timetable snapshot={snapshot} now={new Date('2026-09-28T00:00:00Z')} />);
  expect(screen.getByText(/第 1 周/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '下周' }));
  expect(screen.getByText(/第 2 周/)).toBeTruthy();
});

it('filters schedule items by category', () => {
  render(<Schedule snapshot={snapshot} now={new Date('2026-09-28T00:00:00Z')} />);
  expect(screen.getByText('班会（演示）')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '学习' }));
  expect(screen.queryByText('班会（演示）')).toBeNull();
});
