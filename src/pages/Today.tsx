import { ArrowRight, Bell, BellRing, CalendarDays, ClipboardList, CloudSun, Pin } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import type { RecipientStatus, Snapshot } from '../domain/types';
import type { Page } from '../components/Shell';
import { getEventStatus } from '../domain/events';
import { getXianWeather, type WeatherResult } from '../weather';
import ClassEmblem from '../components/ClassEmblem';
import { CampusPhoto } from '../components/CampusPhoto';
import { campusPhotos, type CampusPhotoItem } from '../domain/campusPhotos';

const dayFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' });
const dueFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const dateFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
const noticeLink = (id: string) => `?view=notifications&notice=${encodeURIComponent(id)}`;
function excerpt(body: string) {
  const characters = Array.from(body.replace(/\s+/g, ' ').trim());
  return characters.length > 64 ? `${characters.slice(0, 64).join('')}…` : characters.join('');
}

export default function Today({ snapshot, now, onNavigate, receipts = null, receiptStatus = 'guest', campusPhoto = campusPhotos[0] }: { snapshot: Snapshot; now: Date; onNavigate: (page: Page) => void; receipts?: RecipientStatus[] | null; receiptStatus?: 'loading' | 'ready' | 'guest' | 'error'; campusPhoto?: CampusPhotoItem }) {
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
  const digest = notices.filter(notice => notice.id !== important?.id).slice(0, 5);
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
    {receipts !== null && pendingNotifications > 0 && <section className="home-reminder" aria-label="待处理通知提醒"><a href="/?view=notifications" onClick={event => navigateMetric(event, 'notifications')}><BellRing className="home-reminder-icon" size={32}/><span className="home-reminder-copy"><span>你有 <strong>{pendingNotifications}</strong> 条通知需要处理</span><small>请确认知悉通知，并完成待办事项</small></span><span className="home-reminder-action">立即查看 <ArrowRight size={18}/></span></a></section>}
    <section className="welcome">
      <div className="welcome-copy">
        <div className="welcome-message">
          <div className="welcome-message-copy" ref={messageRef}>
            <h1>今天的班务</h1>
            <p className="today-date"><CalendarDays size={15} aria-hidden="true"/> {dayFmt.format(now)} {snapshot.demo && <span className="today-demo">演示数据</span>}</p>
          </div>
          <a className="identity-strip" href="/class-emblem.png" target="_blank" rel="noreferrer" aria-label="查看 ID 2601 完整班徽"><div className="identity-art"><ClassEmblem/></div></a>
        </div>
      </div>
    </section>
    <section className="campus-edition" aria-labelledby={important ? 'featured-title' : 'campus-edition-title'}>
      {important ? <div className="home-notice">
        <div className="home-notice-copy">
          <div className="featured-tags"><span>{important.priority === 'urgent' ? '紧急通知' : '重要通知'}</span>{important.pinned && <span><Pin size={13} aria-hidden="true"/>置顶</span>}</div>
          <h2 id="featured-title">{important.title}</h2>
          <p>{important.body}</p>
        </div>
        <a className="featured-link" href={noticeLink(important.id)}>查看通知 <ArrowRight size={16} aria-hidden="true"/></a>
      </div> : <div className="home-notice"><div className="home-notice-copy"><h2 id="campus-edition-title">{notices.length ? '查看班级通知' : '暂无班级通知'}</h2><p>{notices.length ? '最近发布的通知会出现在下方速览。' : '班委发布后，通知会显示在这里。'}</p></div></div>}
      <CampusPhoto picture={campusPhoto}/>
    </section>
    <div className="summary-strip" aria-label="班务概况">
      <div><a className="metric-link" href="/?view=notifications" onClick={event => navigateMetric(event, 'notifications')}><span className="metric-copy"><small>已发布通知</small><strong>{snapshot.notifications.length}<em>条</em></strong></span></a></div>
      <div className={`personal-metric${receipts !== null && pendingNotifications > 0 ? ' has-reminders' : ''}`} role="status" aria-label="未知悉/未完成"><a className="metric-link" href="/?view=notifications" onClick={event => navigateMetric(event, 'notifications')}><span className="metric-copy"><small>未知悉/未完成</small><strong>{receipts === null ? '—' : pendingNotifications}<em>条</em></strong><span className="metric-hint">{receiptStatus === 'guest' ? '登录后查看' : receiptStatus === 'loading' ? '正在读取…' : receiptStatus === 'error' ? '暂时无法更新' : pendingNotifications > 0 ? '请及时查看' : '已全部处理'}</span></span></a></div>
      <div><a className="metric-link" href="/?view=schedule" onClick={event => navigateMetric(event, 'schedule')}><span className="metric-copy"><small>近期日程</small><strong>{upcoming.length}<em>件</em></strong></span></a></div>
    </div>
    <div className="home-workspace">
      <div className="home-primary">
        <section className="card notice-digest">
          <div className="section-head"><h2>通知速览</h2><button className="text-action" onClick={() => onNavigate('notifications')}>全部通知 <ArrowRight size={15} aria-hidden="true"/></button></div>
          {digest.length ? <div className="digest-list">{digest.map(n => <a className="digest-row" key={n.id} href={noticeLink(n.id)}>
            <span className={`digest-icon ${n.kind === 'task' ? 'task' : ''}`}>{n.kind === 'task' ? <ClipboardList size={19} aria-hidden="true"/> : <Bell size={19} aria-hidden="true"/>}</span>
            <span className="digest-copy"><strong>{n.title}</strong><small>{excerpt(n.body)}</small><span className="digest-tags"><span>{n.kind === 'task' ? '待办' : '公告'}</span>{n.priority !== 'normal' && <span className={`priority-tag ${n.priority}`}>{n.priority === 'urgent' ? '紧急' : '重要'}</span>}</span></span>
            <time className="digest-time" dateTime={n.dueAt || n.publishedAt}>{n.dueAt ? '截止 ' : '发布 '}{dueFmt.format(new Date(n.dueAt || n.publishedAt))}</time>
          </a>)}</div> : <div className="empty-note">{important ? '暂无其他通知。' : '班委尚未发布通知。'}</div>}
        </section>
      </div>
      <aside className="column-stack">
        <section className="card upcoming-card">
          <div className="section-head"><h2>近期日程</h2><button className="text-action" onClick={() => onNavigate('schedule')}>查看日程 <ArrowRight size={15} aria-hidden="true"/></button></div>
          {upcoming.length ? <div className="event-mini-list">{upcoming.slice(0, 3).map(e => <div className="event-mini" key={e.id}>
            <time className="agenda-date" dateTime={e.dueAt}>{dateFmt.format(new Date(e.dueAt))}</time>
            <div><strong>{e.title}</strong><small>{timeFmt.format(new Date(e.dueAt))} 截止{getEventStatus(now, e) === 'soon' && <span className="agenda-soon">即将截止</span>}</small></div>
          </div>)}</div> : <p className="empty-note">近期暂无日程安排。可在日程页查看往期事项。</p>}
        </section>
        <section className="card weather-card"><div className="section-head"><h2>西安天气</h2><CloudSun size={23} aria-hidden="true"/></div>{!weather ? <div className="weather-placeholder">正在查询西安天气…</div> : weather.available ? <><div className="weather-current"><strong>{weather.temperature}<sup>°</sup></strong><span>{weather.condition}<small>体感 {weather.feelsLike}°</small></span></div><div className="weather-details"><span>湿度 <strong>{weather.humidity}%</strong></span><span>风速 <strong>{weather.wind} km/h</strong></span></div></> : <div className="weather-placeholder">天气暂不可用</div>}<a className="weather-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">天气数据：Open-Meteo</a></section>
      </aside>
    </div>
  </div>;
}
