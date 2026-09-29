import { useState } from 'react';
import { CalendarDays, Download, RotateCcw } from 'lucide-react';
import { addDays, getCoursesForDate, getTeachingWeek, localDate, mondayOf } from '../domain/calendar';
import { buildIcs } from '../domain/ics';
import type { CourseOccurrence, Snapshot } from '../domain/types';

const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
export default function Timetable({ snapshot, now }: { snapshot: Snapshot; now: Date }) {
  const current = Math.max(1, getTeachingWeek(localDate(now), snapshot.semester));
  const [week, setWeek] = useState(current);
  const [selected, setSelected] = useState<CourseOccurrence | null>(null);
  const firstMonday = mondayOf(snapshot.semester.startDate);
  const dates = days.map((_, i) => addDays(firstMonday, (week - 1) * 7 + i));
  const periods = snapshot.semester.periods;
  const weekCourses = dates.flatMap(date => getCoursesForDate(date, snapshot.courses, snapshot.semester));
  const time = (date: Date) => date.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false });
  const download = () => { const blob = new Blob([buildIcs(snapshot.courses, snapshot.semester)], { type: 'text/calendar;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '西交班务-课表.ics'; a.click(); URL.revokeObjectURL(url); };
  return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">YOUR WEEK AT A GLANCE</span><h1>本周课表</h1><p>{snapshot.semester.title} · 第 {week} 周</p></div><CalendarDays className="title-illustration" size={52}/></div>
    {snapshot.demo && <div className="demo-banner">演示数据 · 课程信息由班委录入后更新</div>}
    <div className="toolbar"><div className="week-controls"><button onClick={() => { setWeek(Math.max(1, week - 1)); setSelected(null); }} disabled={week === 1}>上周</button><button onClick={() => { setWeek(current); setSelected(null); }}><RotateCcw size={14}/> 本周</button><button onClick={() => { setWeek(week + 1); setSelected(null); }}>下周</button></div><button className="outline-button" onClick={download}><Download size={16}/> 导出手机日历</button></div>
    <section className="card timetable-card"><div className="table-scroll"><div className="timetable-grid" style={{ gridTemplateColumns: `74px repeat(7, minmax(120px, 1fr))` }}>
      <div className="grid-corner">节次</div>{days.map((day, i) => <div className="grid-day" key={day}><strong>{day}</strong><span>{dates[i].slice(5).replace('-', '/')}</span></div>)}
      {periods.map(p => <div className="grid-row" key={p.number}><div className="grid-period"><strong>{p.number}</strong><span>{p.start}</span></div>{dates.map(date => { const list = getCoursesForDate(date, snapshot.courses, snapshot.semester).filter(c => c.course.startPeriod <= p.number && c.course.endPeriod >= p.number); return <div className="grid-cell" key={date}>{list.map(c => <button className="class-block" key={c.course.id} aria-label={`查看${c.course.title}详情`} onClick={() => setSelected(c)}><strong>{c.course.title}</strong><small>{c.course.location}</small><small>{c.course.teacher}</small></button>)}</div>; })}</div>)}
    </div></div>{!weekCourses.length && <p className="empty-week">本周没有课程</p>}{selected && <div className="course-detail"><strong>{selected.course.title}</strong><span>{selected.date} · {time(selected.startAt)}–{time(selected.endAt)}</span><span>{selected.course.location} · {selected.course.teacher}</span><span>第 {selected.course.startWeek}-{selected.course.endWeek} 周 · {selected.course.weekType === 'all' ? '每周' : selected.course.weekType === 'odd' ? '单周' : '双周'}</span></div>}</section>
  </div>;
}
