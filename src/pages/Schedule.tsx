import { useState } from 'react';
import { CalendarClock, CalendarPlus, CheckCircle2, Clock3 } from 'lucide-react';
import { getEventStatus } from '../domain/events';
import type { EventItem, Snapshot } from '../domain/types';
import CalendarDialog from '../components/CalendarDialog';

const categories = ['全部', '学习', '班级', '活动'];
const fmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
export default function Schedule({ snapshot, now }: { snapshot: Snapshot; now: Date }) {
  const [category, setCategory] = useState('全部');
  const [date, setDate] = useState('');
  const [view, setView] = useState<'upcoming'|'all'>('upcoming');
  const [calendar, setCalendar] = useState<EventItem | 'class' | null>(() => snapshot.events.find(event => event.id === new URLSearchParams(window.location.search).get('calendarEvent')) ?? null);
  function closeCalendar() {
    setCalendar(null);
    const url = new URL(window.location.href);
    if (url.searchParams.has('calendarEvent')) { url.searchParams.delete('calendarEvent'); window.history.replaceState({}, '', url); }
  }
  const items = snapshot.events.filter(e => (category === '全部' || e.category === category) && (!date || e.dueAt.slice(0,10) === date) && (view === 'all' || (!e.done && Date.parse(e.dueAt) >= now.getTime()))).sort((a,b) => a.dueAt.localeCompare(b.dueAt));
  return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">THE DAYS AHEAD</span><h1>班级日程</h1><p>重要日期与班级事项，都在这里。</p></div><CalendarClock className="title-illustration" size={52}/></div>
    {snapshot.demo && <div className="demo-banner">演示数据 · 正式事项由班委录入</div>}
    <section className="calendar-subscribe-bar" aria-label="系统日历订阅"><div><strong>让手机日历自动更新</strong><p>订阅一次，后续安排由支持订阅的日历自动刷新，更新可能有延迟。</p></div><button type="button" className="primary-button" onClick={() => setCalendar('class')}><CalendarPlus size={17} aria-hidden="true"/>订阅班级日程</button></section>
    <div className="schedule-actions"><div className="filter-tabs" aria-label="事项类别">{categories.map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div><label className="date-filter">按截止日期筛选 <input type="date" value={date} onChange={e => setDate(e.target.value)}/></label><button className="outline-button" onClick={() => setView(view === 'all' ? 'upcoming' : 'all')}>{view === 'all' ? '只看未完成' : '查看全部'}</button></div>
    <div className="event-list">{items.length ? items.map(e => { const status = getEventStatus(now, e); return <article className="card event-card" key={e.id}><div className="event-date"><strong>{new Date(e.dueAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', day: '2-digit' })}</strong><span>{new Date(e.dueAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short' })}</span></div><div className="event-content"><div className="event-heading"><span className="category-tag">{e.category || '事项'}</span>{status === 'soon' && <span className="status-pill urgent">即将截止</span>}{status === 'overdue' && <span className="status-pill overdue">已过期</span>}{status === 'done' && <span className="status-pill done">已完成</span>}</div><h2>{e.title}</h2>{e.description && <p>{e.description}</p>}<div className="event-footer"><div className="event-meta">{e.done ? <CheckCircle2 size={15}/> : <Clock3 size={15}/>} 截止 {fmt.format(new Date(e.dueAt))}</div><button type="button" className="outline-button" onClick={() => setCalendar(e)}><CalendarPlus size={16} aria-hidden="true"/>添加到日历</button></div></div></article>; }) : <div className="state-card"><h2>这里暂时没有日程安排</h2><p>试试其他类别，或由班委添加新日程。</p></div>}</div>
    {calendar && <CalendarDialog event={calendar === 'class' ? undefined : calendar} className={snapshot.className} onClose={closeCalendar}/>}
  </div>;
}
