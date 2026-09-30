import { ArrowRight, Bell, CheckCircle2, ClipboardList, CloudSun, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Snapshot } from '../domain/types';
import type { Page } from '../components/Shell';
import { getEventStatus } from '../domain/events';
import { getXianWeather, type WeatherResult } from '../weather';

const dayFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' });
const dueFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const weight = { urgent: 3, important: 2, normal: 1 };

export default function Today({ snapshot, now, onNavigate }: { snapshot: Snapshot; now: Date; onNavigate: (page: Page) => void }) {
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  useEffect(() => { let active = true; void getXianWeather().then(result => { if (active) setWeather(result); }); return () => { active = false; }; }, []);
  const events = snapshot.events.filter(e => !e.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const near = events.filter(e => Date.parse(e.dueAt) >= now.getTime()).slice(0, 3);
  const notices = [...snapshot.notifications].sort((a, b) => Number(b.pinned) - Number(a.pinned) || weight[b.priority] - weight[a.priority] || b.publishedAt.localeCompare(a.publishedAt));
  const important = notices.find(n => n.priority !== 'normal');
  const urgentCount = snapshot.notifications.filter(n => n.priority === 'urgent').length;
  return <div className="page-stack">
    <section className="welcome"><div><span className="eyebrow">CLASSBOARD · XJTU</span><h1>今天的班务</h1><p>{dayFmt.format(now)} · 重要消息和近期安排</p></div><div className="welcome-number"><strong>{snapshot.notifications.length}</strong><span>条通知</span></div></section>
    <a className="identity-strip" href="/class-emblem.png" target="_blank" rel="noreferrer" aria-label="查看 ID 2601 完整班徽"><div className="identity-art"><img src="/class-emblem.png" alt="ID 2601 班徽"/></div><div className="identity-copy"><span>XJTU–POLIMI JOINT SCHOOL</span><strong>ID 2601 · 我们的班级空间</strong></div></a>
    {snapshot.demo && <div className="demo-banner"><Sparkles size={16}/> 当前展示演示数据；正式消息和事项由班委发布。</div>}
    {important && <section className="home-notice"><div><span className="home-notice-label"><Bell size={14}/> {important.priority === 'urgent' ? '紧急通知' : '重要通知'}</span><h2>{important.title}</h2><p>{important.body}</p></div><button onClick={() => onNavigate('notifications')}>查看通知 <ArrowRight size={16}/></button></section>}
    <div className="summary-strip"><div><Bell size={18}/><span>已发布 <strong>{snapshot.notifications.length}</strong> 条通知</span></div><div><ClipboardList size={18}/><span>近期待办 <strong>{near.length}</strong> 件</span></div><div><CheckCircle2 size={18}/><span>紧急通知 <strong>{urgentCount}</strong> 条</span></div></div>
    <div className="dashboard-grid">
      <section className="card"><div className="section-head"><h2>近期事项</h2><span className="muted">未来安排</span></div>{near.length ? <div className="event-mini-list">{near.map(e => <div className="event-mini" key={e.id}><span className={getEventStatus(now, e) === 'soon' ? 'event-dot urgent' : 'event-dot'}/><div><strong>{e.title}</strong><small>{e.category} · 截止 {dueFmt.format(new Date(e.dueAt))}</small></div></div>)}</div> : <p className="empty-note">近期暂无待办事项。</p>}<button className="text-action" onClick={() => onNavigate('schedule')}>查看全部日程 <ArrowRight size={16}/></button></section>
      <div className="column-stack"><section className="card weather-card"><div className="section-head"><h2>西安天气</h2><CloudSun size={20}/></div>{!weather ? <div className="weather-placeholder">正在查询西安天气…</div> : weather.available ? <div className="weather-current"><strong>{weather.temperature}°</strong><span>{weather.condition}<br/>体感 {weather.feelsLike}° · 湿度 {weather.humidity}% · 风速 {weather.wind} km/h</span></div> : <div className="weather-placeholder">天气暂不可用</div>}<a className="weather-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">天气数据：Open-Meteo</a></section>
        <section className="card"><div className="section-head"><h2>通知速览</h2><span className="muted">最新发布</span></div>{notices.length ? <div className="event-mini-list">{notices.slice(0, 3).map(n => <div className="event-mini" key={n.id}><span className={n.priority === 'urgent' ? 'event-dot urgent' : 'event-dot'}/><div><strong>{n.title}</strong><small>{n.kind === 'task' ? '待办' : '公告'} · {n.priority === 'urgent' ? '紧急' : n.priority === 'important' ? '重要' : '普通'}</small></div></div>)}</div> : <p className="empty-note">班委尚未发布通知。</p>}<button className="text-action" onClick={() => onNavigate('notifications')}>进入通知 <ArrowRight size={16}/></button></section></div>
    </div>
  </div>;
}
