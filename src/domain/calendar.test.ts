import { describe, expect, it } from 'vitest';
import { buildCalendar, calendarUrls, calendarPlatform, androidCalendarIntent } from './calendar';
import type { EventItem } from './types';

const event: EventItem = { id: '班会;1', title: '班会,讨论;安排', description: '第一行\n第二行\\备忘', category: '班级', startAt: '2026-10-20T18:00:00+08:00', dueAt: '2026-10-20T19:00:00+08:00', done: false };
const options = { className: '西交班务', origin: 'https://class.example.com', now: new Date('2026-10-14T00:00:00Z') };
const unfold = (value: string) => value.replace(/\r\n /g, '');

describe('iCalendar export', () => {
  it('exports the actual interval in UTC and reminds before the deadline', () => {
    const calendar = unfold(buildCalendar([event], options));
    expect(calendar).toContain('DTSTART:20261020T100000Z\r\nDTEND:20261020T110000Z');
    expect(calendar).toContain('DTSTAMP:20261014T000000Z');
    expect(calendar).toContain('TRIGGER;RELATED=END:-PT30M');
    expect(calendar).toContain('URL:https://class.example.com/?view=schedule');
    expect(calendar).toContain('SUMMARY:班会\\,讨论\\;安排');
    expect(calendar).toContain('第一行\\n第二行\\\\备忘');
    expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(calendar.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });

  it('folds Chinese and emoji by UTF-8 bytes without corrupting characters or injecting properties', () => {
    const title = '班级🎓安排'.repeat(30) + '\r\nATTENDEE:bad';
    const calendar = buildCalendar([{ ...event, title }], options);
    for (const line of calendar.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(unfold(calendar)).toContain('SUMMARY:' + title.replace('\r\n', '\\n'));
    expect(calendar).not.toContain('\r\nATTENDEE:');
    expect(calendar).not.toContain('\uFFFD');
  });

  it('keeps UIDs stable across edits and produces valid instantaneous events', () => {
    const uid = (value: string) => unfold(value).match(/^UID:(.+)$/m)?.[1];
    expect(uid(buildCalendar([event], options))).toEqual(uid(buildCalendar([{ ...event, title: '新标题' }], options)));
    const calendar = unfold(buildCalendar([{ ...event, dueAt: event.startAt }], options));
    expect(calendar).not.toContain('DTEND:');
    expect(calendar).toContain('TRIGGER;RELATED=START:-PT30M');
  });

  it('rejects invalid times instead of exporting a corrupt calendar', () => {
    expect(() => buildCalendar([{ ...event, dueAt: 'invalid' }], options)).toThrow();
    expect(() => buildCalendar([{ ...event, dueAt: '2026-10-19T18:00:00+08:00' }], options)).toThrow();
  });
});

it('uses real server URLs for single files, downloads and subscriptions', () => {
  const urls = calendarUrls(options.origin, event.id);
  expect(new URL(urls.open).searchParams.get('event')).toBe(event.id);
  expect(new URL(urls.download).searchParams.get('download')).toBe('1');
  expect(urls.subscribe).toBe(urls.open.replace('https:', 'webcal:'));
  expect(calendarUrls(options.origin).open).toBe('https://class.example.com/api/calendar.ics');
});

it('detects iOS, desktop-mode iPad, Android, HarmonyOS and embedded browsers', () => {
  expect(calendarPlatform('iPhone Safari', 0)).toEqual({ device: 'ios', embedded: false });
  expect(calendarPlatform('Macintosh Safari', 5).device).toBe('ios');
  expect(calendarPlatform('Android MicroMessenger', 0)).toEqual({ device: 'android', embedded: true });
  expect(calendarPlatform('HarmonyOS HuaweiBrowser', 0).device).toBe('harmony');
  expect(calendarPlatform('iPhone QQ/9', 0).embedded).toBe(true);
});

it('encodes Android extras and includes an HTTPS fallback without fixing a vendor package', () => {
  const intent = androidCalendarIntent(event, options.className, options.origin);
  expect(intent).toContain('action=android.intent.action.INSERT;');
  expect(intent).toContain('l.beginTime=' + Date.parse(event.startAt));
  expect(intent).toContain('l.endTime=' + Date.parse(event.dueAt));
  expect(intent).toContain('S.title=' + encodeURIComponent(event.title));
  expect(intent).not.toContain('package=');
  const fallback = new URL(decodeURIComponent(intent.match(/S.browser_fallback_url=([^;]+)/)![1]));
  expect(fallback.origin).toBe(options.origin);
  expect(fallback.searchParams.get('calendarEvent')).toBe(event.id);
});
