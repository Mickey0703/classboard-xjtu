import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Shell from './Shell';
import ClassEmblem from './ClassEmblem';

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.unstubAllGlobals();
});

it('uses the saved theme and persists a manual change without changing navigation', () => {
  localStorage.setItem('classboard-theme', 'dark');
  render(<Shell page="today" setPage={vi.fn()}><p>班务内容</p></Shell>);
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.click(screen.getByRole('button', { name: '切换到浅色模式' }));
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(localStorage.getItem('classboard-theme')).toBe('light');
  expect(screen.getByRole('navigation', { name: '主导航' }).textContent).toBe('今日通知日程');
});

it('respects the device theme until the user chooses a theme', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
  render(<Shell page="today" setPage={vi.fn()}><p>班务内容</p></Shell>);
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(screen.getByRole('button', { name: '切换到浅色模式' })).toBeTruthy();
});

it('updates both explicit SVG filter colours and IDs when the theme changes', () => {
  localStorage.setItem('classboard-theme', 'light');
  const { container } = render(<Shell page="today" setPage={vi.fn()}><ClassEmblem/></Shell>);
  const previousIds = Array.from(container.querySelectorAll('filter'), filter => filter.id);
  expect(Array.from(container.querySelectorAll('feFlood'), flood => flood.getAttribute('flood-color'))).toEqual(['#08254d', '#08254d']);
  fireEvent.click(screen.getByRole('button', { name: '切换到深色模式' }));
  expect(Array.from(container.querySelectorAll('feFlood'), flood => flood.getAttribute('flood-color'))).toEqual(['#ffffff', '#ffffff']);
  const darkIds = Array.from(container.querySelectorAll('filter'), filter => filter.id);
  expect(new Set(darkIds).size).toBe(2);
  expect(darkIds.every(id => !previousIds.includes(id))).toBe(true);
});

it('follows system changes live, preserves a manual choice, and can restore automatic mode', () => {
  let listener: ((event: { matches: boolean }) => void) | undefined;
  const query = { matches: false, addEventListener: vi.fn((_type, handler) => { listener = handler; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => query));
  const { unmount } = render(<Shell page="today" setPage={vi.fn()}><ClassEmblem/></Shell>);
  act(() => { query.matches = true; listener?.({ matches: true }); });
  expect(document.documentElement.dataset.theme).toBe('dark');
  fireEvent.click(screen.getByRole('button', { name: '切换到浅色模式' }));
  act(() => { query.matches = false; listener?.({ matches: false }); query.matches = true; listener?.({ matches: true }); });
  expect(document.documentElement.dataset.theme).toBe('light');
  fireEvent.click(screen.getByRole('button', { name: '跟随系统', hidden: true }));
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(localStorage.getItem('classboard-theme')).toBe('system');
  unmount();
  expect(query.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
});
