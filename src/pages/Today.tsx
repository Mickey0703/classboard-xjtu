import { ArrowRight, Bell, CalendarDays, CheckCircle2, ClipboardList, CloudSun, Pin, Sparkles } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import type { RecipientStatus, Snapshot } from '../domain/types';
import type { Page } from '../components/Shell';
import { getEventStatus } from '../domain/events';
import { getXianWeather, type WeatherResult } from '../weather';
import ClassEmblem from '../components/ClassEmblem';

const dayFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' });
const dueFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export default function Today({ snapshot, now, onNavigate, receipts = null, receiptStatus = 'guest' }: { snapshot: Snapshot; now: Date; onNavigate: (page: Page) => void; receipts?: RecipientStatus[] | null; receiptStatus?: 'loading' | 'ready' | 'guest' | 'error' }) {
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const text = messageRef.current;
    if (!text) return;
    const alignEmblem = () => {
      const height = text.getBoundingClientRect().height;
      if (height > 0) text.parentElement?.style.setProperty('--welcome-emblem-height', `${height}px`);
    };
    alignEmblem();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(alignEmblem);
    observer.observe(text);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { let active = true; void getXianWeather().then(result => { if (active) setWeather(result); }); return () => { active = false; }; }, []);
  const upcoming = snapshot.events.filter(e => !e.done && Date.parse(e.dueAt) >= now.getTime()).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const notices = [...snapshot.notifications].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.id.localeCompare(a.id));
  const important = notices.find(n => n.priority !== 'normal');
  const receiptById = new Map(receipts?.map(receipt => [receipt.notificationId, receipt]));
  const pendingNotifications = snapshot.notifications.filter(notification => {
    const receipt = receiptById.get(notification.id);
    return receipt && (!receipt.acknowledgedAt || (notification.kind === 'task' && !receipt.completedAt));
  }).length;
  const navigateMetric = (event: MouseEvent<HTMLAnchorElement>, page: Page) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); onNavigate(page);
  };

  return <div className="page-stack home-page">
    <section className="welcome">
      <div className="welcome-copy"><span className="eyebrow"><CalendarDays size={14}/> {dayFmt.format(now)}</span><div className="welcome-message"><div className="welcome-message-copy" ref={messageRef}><h1>今天的班务</h1><p>班级的重要消息与近期安排，都在这里。</p></div><a className="identity-strip" href="/class-emblem.png" target="_blank" rel="noreferrer" aria-label="查看 ID 2601 完整班徽"><div className="identity-art"><ClassEmblem/></div><div className="identity-copy"><strong>ID 2601</strong><span>XJTU–POLIMI JOINT SCHOOL</span></div></a></div><div className="welcome-actions"><button onClick={() => onNavigate('notifications')}>查看全部通知 <ArrowRight size={16}/></button><button onClick={() => onNavigate('schedule')}>查看日程</button></div></div>
    </section>
    {snapshot.demo && <div className="demo-banner"><Sparkles size={14}/> 演示数据 · 正式通知与事项由班委发布</div>}
    <div className="summary-strip">
      <div><a className="metric-link" href="/?view=notifications" onClick={event => navigateMetric(event, 'notifications')}><span className="metric-icon"><Bell size={19}/></span><span className="metric-copy"><small>已发布通知</small><strong>{snapshot.notifications.length}<em>条</em></strong></span></a></div>
      <div className={`personal-metric${receipts !== null && pendingNotifications > 0 ? ' has-reminders' : ''}`} role="status" aria-label="未知悉/未完成"><a className="metric-link" href="/?view=notifications" onClick={event => navigateMetric(event, 'notifications')}><span className="metric-icon"><ClipboardList size={19}/></span><span className="metric-copy"><small>未知悉/未完成</small><strong>{receipts === null ? '—' : pendingNotifications}<em>条</em></strong><span className="metric-hint">{receiptStatus === 'guest' ? '登录后查看' : receiptStatus === 'loading' ? '正在读取…' : receiptStatus === 'error' ? '暂时无法更新' : pendingNotifications > 0 ? '请及时查看' : '已全部处理'}</span></span></a></div>
      <div><a className="metric-link" href="/?view=schedule" onClick={event => navigateMetric(event, 'schedule')}><span className="metric-icon"><CheckCircle2 size={19}/></span><span className="metric-copy"><small>近期日程</small><strong>{upcoming.length}<em>件</em></strong></span></a></div>
    </div>
    {important && <section className="home-notice"><div className="home-notice-symbol"><Bell size={22}/></div><div className="home-notice-copy"><span className="home-notice-label">{important.priority === 'urgent' ? '紧急通知' : '重要通知'}{important.pinned && <><span className="meta-divider"/><Pin size={11}/> 置顶</>}</span><h2>{important.title}</h2><p>{important.body}</p></div><button onClick={() => onNavigate('notifications')}>查看通知 <ArrowRight size={15}/></button></section>}
    <div className="home-workspace">
      <section className="card notice-digest"><div className="section-head"><div><span className="section-kicker">NOTICEBOARD</span><h2>通知速览</h2></div><button className="text-action" onClick={() => onNavigate('notifications')}>全部通知 <ArrowRight size={14}/></button></div>
        {notices.length ? <div className="digest-list">{notices.slice(0, 5).map(n => <button className="digest-row" key={n.id} onClick={() => onNavigate('notifications')}><span className={`digest-icon ${n.kind === 'task' ? 'task' : ''}`}>{n.kind === 'task' ? <ClipboardList size={18}/> : <Bell size={18}/>}</span><span className="digest-copy"><span className="digest-tags"><span>{n.kind === 'task' ? '待办' : '公告'}</span>{n.priority !== 'normal' && <span className={`priority-tag ${n.priority}`}>{n.priority === 'urgent' ? '紧急' : '重要'}</span>}</span><strong>{n.title}</strong><small>{n.body}</small><time>{dueFmt.format(new Date(n.publishedAt))} 发布</time></span><ArrowRight size={16} className="row-arrow"/></button>)}</div> : <div className="empty-note">班委尚未发布通知。</div>}
        <div className="digest-footnote"><CheckCircle2 size={14}/> 使用班级邮箱登录，可确认知悉和完成待办。</div>
      </section>
      <aside className="column-stack">
        <section className="card upcoming-card"><div className="section-head"><div><span className="section-kicker">COMING UP</span><h2>近期日程</h2></div><CalendarDays size={18} className="muted-icon"/></div>{upcoming.length ? <div className="event-mini-list">{upcoming.slice(0, 3).map(e => <div className="event-mini" key={e.id}><span className={getEventStatus(now, e) === 'soon' ? 'event-dot urgent' : 'event-dot'}/><div><strong>{e.title}</strong><small>{e.category} · {dueFmt.format(new Date(e.dueAt))} 截止</small></div></div>)}</div> : <p className="empty-note">近期暂无日程安排。</p>}<button className="text-action" onClick={() => onNavigate('schedule')}>查看全部日程 <ArrowRight size={14}/></button></section>
        <section className="card weather-card"><div className="section-head"><div><span className="section-kicker">CAMPUS WEATHER</span><h2>西安天气</h2></div><CloudSun size={23}/></div>{!weather ? <div className="weather-placeholder">正在查询西安天气…</div> : weather.available ? <><div className="weather-current"><strong>{weather.temperature}<sup>°</sup></strong><span>{weather.condition}<small>体感 {weather.feelsLike}°</small></span></div><div className="weather-details"><span>湿度 <strong>{weather.humidity}%</strong></span><span>风速 <strong>{weather.wind} km/h</strong></span></div></> : <div className="weather-placeholder">天气暂不可用</div>}<a className="weather-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">天气数据：Open-Meteo ↗</a></section>
      </aside>
    </div>
  </div>;
}
