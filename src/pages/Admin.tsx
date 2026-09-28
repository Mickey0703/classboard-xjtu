import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, Plus, Trash2 } from 'lucide-react';
import { saveAdmin } from '../api/client';
import type { Course, EventItem, Semester, Snapshot, WeekType } from '../domain/types';

type Tab = 'courses' | 'events' | 'semester';
const blankCourse: Course = { id: '', title: '', teacher: '', location: '', weekday: 1, startPeriod: 1, endPeriod: 2, startWeek: 1, endWeek: 16, weekType: 'all' };
const blankEvent: EventItem = { id: '', title: '', description: '', category: '班级', startAt: '', dueAt: '', done: false };

export default function Admin({ snapshot, onSaved, onBack }: { snapshot: Snapshot | null; onSaved: () => Promise<void> | void; onBack: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('courses');
  const [course, setCourse] = useState<Course>(blankCourse);
  const [event, setEvent] = useState<EventItem>(blankEvent);
  const [semester, setSemester] = useState<Semester>(snapshot?.semester ?? { title: '', startDate: '', endDate: '', periods: [] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { fetch('/api/admin/session', { credentials: 'include' }).then(async r => { if (!r.ok) throw Error('not signed in'); const body = await r.json() as { email: string }; setEmail(body.email); }).catch(() => setEmail(null)).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (snapshot?.semester) setSemester(snapshot.semester); }, [snapshot]);
  const action = async (path: Tab, method: 'POST'|'PUT'|'DELETE', body: unknown, label: string) => {
    setError(''); setSuccess('');
    try { await saveAdmin(path, method, body); await onSaved(); setSuccess(`${label}成功`); if (path === 'courses' && method !== 'DELETE') setCourse(blankCourse); if (path === 'events' && method !== 'DELETE') setEvent(blankEvent); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
  };
  return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">CLASS MANAGEMENT</span><h1>班委管理</h1><p>维护全班共享的课表与日程</p></div><LockKeyhole className="title-illustration" size={52}/></div><button className="text-action" onClick={onBack}><ArrowLeft size={16}/> 返回首页</button>
    {checking ? <div className="state-card">正在检查班委登录状态…</div> : !email ? <div className="state-card"><h2>班委登录</h2><p>只有班委邮箱通过验证后才能修改班务资料。</p><a className="primary-button" href="/api/admin/session">使用班委邮箱登录</a></div> : <>
      <div className="demo-banner">当前班委：{email} · 修改会同步显示给所有访问者</div>
      <div className="admin-tabs">{(['courses','events','semester'] as const).map((value,i) => <button key={value} className={tab === value ? 'selected' : ''} onClick={() => { setTab(value); setError(''); setSuccess(''); }}>{['课程','日程','学期'][i]}</button>)}</div>
      <section className="card admin-card">
        {tab === 'courses' && <><div className="section-head"><h2>{course.id ? '编辑课程' : '添加课程'}</h2><Plus size={18}/></div><form onSubmit={e => { e.preventDefault(); void action('courses', course.id ? 'PUT' : 'POST', course, '保存课程'); }}><div className="form-grid">
          <label className="field wide">课程名称<input value={course.title} onChange={e => setCourse({ ...course, title: e.target.value })} required maxLength={100}/></label>
          <label className="field">任课教师<input value={course.teacher} onChange={e => setCourse({ ...course, teacher: e.target.value })}/></label><label className="field">上课地点<input value={course.location} onChange={e => setCourse({ ...course, location: e.target.value })}/></label>
          <label className="field">星期<select value={course.weekday} onChange={e => setCourse({ ...course, weekday: Number(e.target.value) })}>{['一','二','三','四','五','六','日'].map((d,i) => <option key={d} value={i+1}>周{d}</option>)}</select></label><label className="field">单双周<select value={course.weekType} onChange={e => setCourse({ ...course, weekType: e.target.value as WeekType })}><option value="all">每周</option><option value="odd">单周</option><option value="even">双周</option></select></label>
          <label className="field">开始节次<input type="number" min="1" value={course.startPeriod} onChange={e => setCourse({ ...course, startPeriod: Number(e.target.value) })}/></label><label className="field">结束节次<input type="number" min="1" value={course.endPeriod} onChange={e => setCourse({ ...course, endPeriod: Number(e.target.value) })}/></label>
          <label className="field">开始周<input type="number" min="1" value={course.startWeek} onChange={e => setCourse({ ...course, startWeek: Number(e.target.value) })}/></label><label className="field">结束周<input type="number" min="1" value={course.endWeek} onChange={e => setCourse({ ...course, endWeek: Number(e.target.value) })}/></label>
        </div><p>{error && <span className="form-error">{error}</span>}{success && <span className="form-success">{success}</span>}</p><button className="primary-button" type="submit">保存课程</button>{course.id && <button type="button" className="outline-button" onClick={() => setCourse(blankCourse)}>取消编辑</button>}</form>
        <div className="admin-list">{snapshot?.courses.map(c => <div className="admin-row" key={c.id}><div><strong>{c.title}</strong><small>周{c.weekday} · 第 {c.startPeriod}-{c.endPeriod} 节 · {c.startWeek}-{c.endWeek} 周</small></div><div><button onClick={() => setCourse(c)}>编辑</button><button aria-label={`删除${c.title}`} onClick={() => { if (confirm(`确定删除“${c.title}”？`)) void action('courses','DELETE',{ id:c.id },'删除课程'); }}><Trash2 size={16}/></button></div></div>)}</div></>}
        {tab === 'events' && <><div className="section-head"><h2>{event.id ? '编辑事项' : '添加事项'}</h2><Plus size={18}/></div><form onSubmit={e => { e.preventDefault(); void action('events', event.id ? 'PUT' : 'POST', event, '保存事项'); }}><div className="form-grid">
          <label className="field wide">事项标题<input required value={event.title} onChange={e => setEvent({ ...event, title:e.target.value })}/></label><label className="field">类别<select value={event.category} onChange={e => setEvent({ ...event, category:e.target.value })}><option>班级</option><option>学习</option><option>活动</option></select></label><label className="field">状态<select value={event.done ? 'done' : 'open'} onChange={e => setEvent({ ...event, done:e.target.value === 'done' })}><option value="open">进行中</option><option value="done">已完成</option></select></label>
          <label className="field">开始时间<input required type="datetime-local" value={event.startAt.slice(0,16)} onChange={e => setEvent({ ...event, startAt:e.target.value + ':00+08:00' })}/></label><label className="field">截止时间<input required type="datetime-local" value={event.dueAt.slice(0,16)} onChange={e => setEvent({ ...event, dueAt:e.target.value + ':00+08:00' })}/></label>
          <label className="field wide">说明<textarea rows={3} value={event.description} onChange={e => setEvent({ ...event, description:e.target.value })}/></label>
        </div><p>{error && <span className="form-error">{error}</span>}{success && <span className="form-success">{success}</span>}</p><button className="primary-button" type="submit">保存事项</button>{event.id && <button type="button" className="outline-button" onClick={() => setEvent(blankEvent)}>取消编辑</button>}</form>
        <div className="admin-list">{snapshot?.events.map(item => <div className="admin-row" key={item.id}><div><strong>{item.title}</strong><small>{item.category} · 截止 {item.dueAt.slice(0,16).replace('T',' ')}</small></div><div><button onClick={() => setEvent(item)}>编辑</button><button aria-label={`删除${item.title}`} onClick={() => { if (confirm(`确定删除“${item.title}”？`)) void action('events','DELETE',{ id:item.id },'删除事项'); }}><Trash2 size={16}/></button></div></div>)}</div></>}
        {tab === 'semester' && <><div className="section-head"><h2>学期设置</h2></div><form onSubmit={e => { e.preventDefault(); void action('semester','PUT',semester,'保存学期'); }}><div className="form-grid"><label className="field wide">班级名称<input value={semester.className ?? ''} placeholder="例如：能动学院某班" onChange={e => setSemester({ ...semester, className:e.target.value })}/></label><label className="field wide">学期名称<input required value={semester.title} onChange={e => setSemester({ ...semester, title:e.target.value })}/></label><label className="field">开学日期<input required type="date" value={semester.startDate} onChange={e => setSemester({ ...semester, startDate:e.target.value })}/></label><label className="field">结束日期<input required type="date" value={semester.endDate} onChange={e => setSemester({ ...semester, endDate:e.target.value })}/></label><label className="field wide">节次时间（每行格式：节次,开始,结束）<textarea rows={8} value={semester.periods.map(p => `${p.number},${p.start},${p.end}`).join('\n')} onChange={e => setSemester({ ...semester, periods:e.target.value.split('\n').filter(Boolean).map(line => { const [number,start,end] = line.split(','); return { number:Number(number), start:start ?? '', end:end ?? '' }; }) })}/></label></div><p>{error && <span className="form-error">{error}</span>}{success && <span className="form-success">{success}</span>}</p><button className="primary-button" type="submit">保存学期</button></form></>}
      </section>
    </>}
  </div>;
}
