import type { EventItem } from './types';

const dateFormat = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

export function calendarDetails(event: EventItem, className: string, origin: string): string {
  return [event.title, className, event.category && `类别：${event.category}`, `开始：${dateFormat.format(new Date(event.startAt))}（北京时间）`, `截止：${dateFormat.format(new Date(event.dueAt))}（北京时间）`, event.description, new URL('/?view=schedule', origin).href].filter(Boolean).join('\n');
}

// RFC 5545 TEXT escaping and octet-based folding. Iterate code points so a
// multi-byte Chinese character or emoji never gets split across content lines.
function escapeText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
function foldLine(value: string): string {
  const encoder = new TextEncoder();
  let result = '', bytes = 0;
  for (const character of value) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { result += '\r\n '; bytes = 1; }
    result += character;
    bytes += length;
  }
  return result;
}
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

export function buildCalendar(events: EventItem[], { className, origin, now = new Date() }: { className: string; origin: string; now?: Date }): string {
  const site = new URL('/?view=schedule', origin);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Classboard XJTU//Class Calendar//ZH', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeText(className)}`, 'X-WR-TIMEZONE:Asia/Shanghai', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M'];
  for (const event of events) {
    const start = new Date(event.startAt), end = new Date(event.dueAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) throw new Error('日程时间无效');
    const hasDuration = end > start;
    lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(event.id)}@${site.hostname}`, `DTSTAMP:${utc(now)}`, `DTSTART:${utc(start)}`);
    if (hasDuration) lines.push(`DTEND:${utc(end)}`);
    lines.push(`SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(calendarDetails(event, className, origin))}`, `CATEGORIES:${escapeText(event.category || '事项')}`, `URL:${site.href}`, 'STATUS:CONFIRMED', 'TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(event.title + ' · 即将截止')}`, `TRIGGER;RELATED=${hasDuration ? 'END' : 'START'}:-PT30M`, 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

export function calendarUrls(origin: string, eventId?: string) {
  const url = new URL('/api/calendar.ics', origin);
  if (eventId !== undefined) url.searchParams.set('event', eventId);
  const open = url.href;
  url.searchParams.set('download', '1');
  return { open, download: url.href, subscribe: open.replace(/^https?:/, 'webcal:') };
}

export function calendarPlatform(userAgent: string, maxTouchPoints: number) {
  const device = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) ? 'ios'
    : /HarmonyOS|OpenHarmony/i.test(userAgent) ? 'harmony'
    : /Android/i.test(userAgent) ? 'android' : 'other';
  return { device, embedded: /MicroMessenger|\bQQ\//i.test(userAgent) };
}

// This is a best-effort browser handoff, not a native calendar API. Browsers
// require a BROWSABLE calendar activity; keep a first-party fallback and do
// not lock the intent to a Google or manufacturer-specific package.
export function androidCalendarIntent(event: EventItem, className: string, origin: string): string {
  const fallback = new URL('/?view=schedule', origin);
  fallback.searchParams.set('calendarEvent', event.id);
  return 'intent://com.android.calendar/events#Intent;scheme=content;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/event;'
    + `S.title=${encodeURIComponent(event.title)};S.description=${encodeURIComponent(calendarDetails(event, className, origin))};`
    + `l.beginTime=${Date.parse(event.startAt)};l.endTime=${Date.parse(event.dueAt)};S.browser_fallback_url=${encodeURIComponent(fallback.href)};end`;
}
