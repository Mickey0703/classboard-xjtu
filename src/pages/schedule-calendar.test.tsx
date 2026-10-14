import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Schedule from './Schedule';
import type { Snapshot } from '../domain/types';

const snapshot: Snapshot = { className: '西交班务', demo: false, notifications: [], events: [{ id: 'e1', title: '班会', description: '教室集合', category: '班级', startAt: '2026-10-20T18:00:00+08:00', dueAt: '2026-10-20T19:00:00+08:00', done: false }] };
const now = new Date('2026-10-14T00:00:00Z');
afterEach(() => { vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });
function open(userAgent = 'iPhone Safari') {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
  render(<Schedule snapshot={snapshot} now={now}/>);
  fireEvent.click(screen.getByRole('button', { name: '添加到日历' }));
  return within(screen.getByRole('dialog', { name: '添加到日历' }));
}

it('offers iOS a real calendar file and subscription fallback while keeping the page accessible', () => {
  const dialog = open();
  const file = dialog.getByRole('link', { name: '打开日历文件' });
  expect(file.getAttribute('href')).toContain('/api/calendar.ics?event=e1');
  expect(file.getAttribute('target')).toBe('_blank');
  expect(file.hasAttribute('download')).toBe(false);
  expect(dialog.getByRole('link', { name: '订阅这条日程' }).getAttribute('href')).toMatch(/^webcal:/);
  expect(dialog.getByLabelText('订阅地址').getAttribute('readonly')).not.toBeNull();
  fireEvent.click(dialog.getByRole('button', { name: '关闭窗口' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('offers Android an optional native handoff, a file fallback and copyable details', () => {
  const dialog = open('Android Chrome');
  expect(dialog.getByRole('link', { name: '尝试打开系统日历' }).getAttribute('href')).toMatch(/^intent:/);
  expect(dialog.getByRole('link', { name: '下载日历文件' }).getAttribute('href')).toContain('download=1');
  expect(dialog.getByLabelText('日程信息').textContent).toContain('2026');
});

it('does not offer blocked native launch from WeChat or HarmonyOS and explains browser handoff', () => {
  const dialog = open('HarmonyOS MicroMessenger');
  expect(dialog.queryByRole('link', { name: '尝试打开系统日历' })).toBeNull();
  expect(dialog.getByText(/在浏览器中打开/)).toBeTruthy();
  expect(dialog.getByRole('link', { name: '下载日历文件' })).toBeTruthy();
});

it('offers an unfiltered class subscription and reopens the selected event after Android fallback', () => {
  window.history.replaceState({}, '', '/?view=schedule&calendarEvent=e1');
  render(<Schedule snapshot={snapshot} now={now}/>);
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '关闭窗口' }));
  fireEvent.click(screen.getByRole('button', { name: '订阅班级日程' }));
  const dialog = within(screen.getByRole('dialog', { name: '订阅班级日程' }));
  expect(dialog.getByRole('link', { name: '订阅班级日程' }).getAttribute('href')).toMatch(/api\/calendar\.ics$/);
  expect(dialog.getByText(/未完成日程/)).toBeTruthy();
});
