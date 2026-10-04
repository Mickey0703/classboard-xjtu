import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Shell from './Shell';

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
