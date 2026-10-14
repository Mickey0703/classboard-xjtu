import { buildCalendar } from '../../src/domain/calendar';
import { loadSnapshot } from './snapshot';

interface Env { DB: D1Database }

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const url = new URL(request.url);
  const id = url.searchParams.get('event');
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (id !== null && (!id || id.length > 200)) return Response.json({ error: '日程编号无效' }, { status: 400, headers });
  try {
    const snapshot = await loadSnapshot(env.DB);
    const events = id === null ? snapshot.events.filter(event => !event.done) : snapshot.events.filter(event => event.id === id);
    const download = url.searchParams.get('download') === '1';
    if (id !== null && !events.length && download) return Response.json({ error: '日程不存在或已删除，请返回班级日程查看最新安排。' }, { status: 404, headers });
    // A single-event subscription also needs a successful empty feed after
    // deletion, so clients can remove the previously subscribed event.
    const name = id === null ? snapshot.className : events[0]?.title ?? snapshot.className;
    const calendar = buildCalendar(events, { className: snapshot.className, origin: url.origin });
    const filename = encodeURIComponent(name + '.ics').replace(/['()*]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase());
    return new Response(calendar, { headers: { ...headers, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="classboard.ics"; filename*=UTF-8''${filename}` } });
  } catch {
    // An unavailable feed must stay an error. Returning an empty calendar here
    // could make subscribers remove their previously synced events.
    return Response.json({ error: '日历暂不可用，请稍后重试。' }, { status: 503, headers });
  }
};
