import { ArrowRight, Bell, CalendarDays, CheckCircle2, Clock3, CloudSun, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getCoursesForDate, getEventStatus, getNextClass, getTeachingWeek, localDate } from '../domain/calendar';
import type { Snapshot } from '../domain/types';
import type { Page } from '../components/Shell';
import { getXianWeather, type WeatherResult } from '../weather';

const dayFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'long' });
const shortDateFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
export default function Today({ snapshot, now, onNavigate }: { snapshot: Snapshot; now: Date; onNavigate: (page: Page) => void }) {
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  useEffect(() => { let active = true; void getXianWeather().then(result => { if (active) setWeather(result); }); return () => { active = false; }; }, []);
  const today = localDate(now);
  const classes = getCoursesForDate(today, snapshot.courses, snapshot.semester);
  const next = getNextClass(now, snapshot.courses, snapshot.semester);
  const nextWhen = next ? `${next.date === today ? '今天' : shortDateFmt.format(next.startAt)} ${timeFmt.format(next.startAt)}` : '';
  const week = getTeachingWeek(today, snapshot.semester);
  const events = snapshot.events.filter(e => !e.done).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const important = [...snapshot.notifications].filter(n => n.priority !== 'normal').sort((a,b) => Number(b.pinned) - Number(a.pinned) || (b.priority === 'urgent' ? 2 : 1) - (a.priority === 'urgent' ? 2 : 1) || b.publishedAt.localeCompare(a.publishedAt))[0];
  const near = events.filter(e => Date.parse(e.dueAt) >= now.getTime()).slice(0, 3);
  return <div className="page-stack">
    <section className="welcome"><div><span className="eyebrow">CLASSBOARD · XJTU</span><h1>今天的安排</h1><p>{dayFmt.format(now)} · {week > 0 ? `第 ${week} 周` : '学期未开始'}</p></div><div className="welcome-number"><strong>{classes.length}</strong><span>今日课程</span></div></section>
    {snapshot.demo && <div className="demo-banner"><Sparkles size={16}/> 当前展示演示数据；班委录入课表和事项后将同步更新。</div>}
    {important && <section className="home-notice"><div><span className="home-notice-label"><Bell size={14}/> {important.priority === 'urgent' ? '紧急通知' : '重要通知'}</span><h2>{important.title}</h2><p>{important.body}</p></div><button onClick={() => onNavigate('notifications')}>查看通知 <ArrowRight size={16}/></button></section>}
    <div className="summary-strip"><div><CalendarDays size={18}/><span>今天 <strong>{classes.length}</strong> 节课</span></div><div><CheckCircle2 size={18}/><span>待完成 <strong>{events.length}</strong> 件事</span></div><div><Clock3 size={18}/><span>{next ? `下一节 ${nextWhen}` : '暂无后续课程'}</span></div></div>
    <div className="dashboard-grid">
      <div className="column-stack">
        <section className="card next-card"><div className="section-head"><span className="section-kicker">NEXT UP</span><span className="light-pill">下一节</span></div>
          {next ? <><h2>{next.course.title}</h2><p className="next-time">{nextWhen} 开始</p><div className="detail-row"><MapPin size={16}/>{next.course.location} · {next.course.teacher}</div></> : <><h2>接下来没有课程</h2><p>可以看看日程，安排空闲时间。</p></>}
        </section>
        <section className="card"><div className="section-head"><h2>今天的课</h2><span className="muted">{classes.length} 节</span></div>
          {classes.length ? <div className="course-list">{classes.map(c => <div className="course-line" key={c.course.id}><time>{timeFmt.format(c.startAt)}</time><div><strong>{c.course.title}</strong><small>{c.course.location} · {c.course.teacher}</small></div></div>)}</div> : <p className="empty-note">今天没有排课，适合专注处理手头的事。</p>}
          <button className="text-action" onClick={() => onNavigate('timetable')}>查看完整课表 <ArrowRight size={16}/></button>
        </section>
      </div>
      <div className="column-stack">
        <section className="card weather-card"><div className="section-head"><h2>西安天气</h2><CloudSun size={20}/></div>{!weather ? <div className="weather-placeholder">正在查询西安天气…</div> : weather.available ? <div className="weather-current"><strong>{weather.temperature}°</strong><span>{weather.condition}<br/>体感 {weather.feelsLike}° · 湿度 {weather.humidity}% · 风速 {weather.wind} km/h</span></div> : <div className="weather-placeholder">天气暂不可用</div>}<a className="weather-credit" href="https://open-meteo.com/" target="_blank" rel="noreferrer">天气数据：Open-Meteo</a></section>
        <section className="card"><div className="section-head"><h2>近期事项</h2><span className="muted">未来安排</span></div>{near.length ? <div className="event-mini-list">{near.map(e => <div className="event-mini" key={e.id}><span className={getEventStatus(now,e) === 'soon' ? 'event-dot urgent' : 'event-dot'}/><div><strong>{e.title}</strong><small>{e.category} · 截止 {new Date(e.dueAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></div></div>)}</div> : <p className="empty-note">近期暂无待办事项。</p>}
          <button className="text-action" onClick={() => onNavigate('schedule')}>查看全部日程 <ArrowRight size={16}/></button>
        </section>
      </div>
    </div>
    <section className="card timeline-card"><div className="section-head"><div><span className="section-kicker">TODAY'S FLOW</span><h2>今日时间轴</h2></div><span className="muted">{dayFmt.format(now)}</span></div>{classes.length ? <div className="timeline">{classes.map(c => <div className="timeline-item" key={c.course.id}><time>{timeFmt.format(c.startAt)}</time><div><strong>{c.course.title}</strong><small>{c.course.location} · 第 {c.course.startPeriod}-{c.course.endPeriod} 节</small></div></div>)}</div> : <p className="empty-note">今天没有课程安排。</p>}</section>
  </div>;
}
