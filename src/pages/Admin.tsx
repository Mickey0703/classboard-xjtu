import { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, Plus, Trash2 } from 'lucide-react';
import { saveAdmin } from '../api/client';
import type { EventItem, Snapshot } from '../domain/types';
import NotificationAdmin from '../components/NotificationAdmin';
import MembersAdmin from '../components/MembersAdmin';

type Tab = 'notifications' | 'notification-records' | 'members' | 'events' | 'settings';
const tabs: { id: Tab; label: string }[] = [{ id: 'notifications', label: '通知' }, { id: 'notification-records', label: '通知记录' }, { id: 'events', label: '日程' }, { id: 'members', label: '成员' }, { id: 'settings', label: '网站设置' }];
const blankEvent: EventItem = { id: '', title: '', description: '', category: '班级', startAt: '', dueAt: '', done: false };

export default function Admin({ snapshot, onSaved, onBack }: { snapshot: Snapshot | null; onSaved: () => Promise<void> | void; onBack: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('notifications');
  const [event, setEvent] = useState<EventItem>(blankEvent);
  const [className, setClassName] = useState(snapshot?.className ?? '西交班务');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { fetch('/api/admin/session', { credentials: 'include' }).then(async r => { if (!r.ok) throw Error('not signed in'); const body = await r.json() as { email: string }; setEmail(body.email); }).catch(() => setEmail(null)).finally(() => setChecking(false)); }, []);
  useEffect(() => { if (snapshot?.className) setClassName(snapshot.className); }, [snapshot?.className]);
  const action = async (path: 'events' | 'site-settings', method: 'POST' | 'PUT' | 'DELETE', body: unknown, label: string) => {
    setError(''); setSuccess('');
    try { await saveAdmin(path, method, body); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); return; }
    try { await onSaved(); }
    catch { setError('已保存，但刷新失败。请刷新页面确认最新数据，避免重复提交。'); return; }
    setSuccess(`${label}成功`);
    if (path === 'events' && method !== 'DELETE') setEvent(blankEvent);
  };
  return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">CLASS MANAGEMENT</span><h1>班委管理</h1><p>发布通知，维护成员和班级事项</p></div><LockKeyhole className="title-illustration" size={52}/></div><button className="text-action" onClick={onBack}><ArrowLeft size={16}/> 返回首页</button>
    {checking ? <div className="state-card">正在检查班委登录状态…</div> : !email ? <div className="state-card"><h2>班委登录</h2><p>只有班委邮箱通过验证后才能修改班务资料。</p><a className="primary-button" href="/api/admin/login">使用班委邮箱登录</a></div> : <>
      <div className="demo-banner">当前班委：{email} · 修改会同步显示给所有访问者</div>
      <nav className="admin-tabs" aria-label="班委管理菜单">{tabs.map(({ id, label }) => <button key={id} className={tab === id ? 'selected' : ''} aria-pressed={tab === id} onClick={() => { setTab(id); setError(''); setSuccess(''); }}>{label}</button>)}</nav>
      <section className="card admin-card">
        {(tab === 'notifications' || tab === 'notification-records') && <NotificationAdmin onPublished={onSaved} view={tab === 'notifications' ? 'compose' : 'records'} onViewChange={view => setTab(view === 'compose' ? 'notifications' : 'notification-records')}/>}
        {tab === 'members' && <MembersAdmin/>}
        {tab === 'events' && <><div className="section-head"><h2>{event.id ? '编辑事项' : '添加事项'}</h2><Plus size={18}/></div><form onSubmit={e => { e.preventDefault(); void action('events', event.id ? 'PUT' : 'POST', event, '保存事项'); }}><div className="form-grid">
          <label className="field wide">事项标题<input required value={event.title} onChange={e => setEvent({ ...event, title: e.target.value })}/></label><label className="field">类别<select value={event.category} onChange={e => setEvent({ ...event, category: e.target.value })}><option>班级</option><option>学习</option><option>活动</option></select></label><label className="field">状态<select value={event.done ? 'done' : 'open'} onChange={e => setEvent({ ...event, done: e.target.value === 'done' })}><option value="open">进行中</option><option value="done">已完成</option></select></label>
          <label className="field">开始时间<input required type="datetime-local" value={event.startAt.slice(0, 16)} onChange={e => setEvent({ ...event, startAt: e.target.value + ':00+08:00' })}/></label><label className="field">截止时间<input required type="datetime-local" value={event.dueAt.slice(0, 16)} onChange={e => setEvent({ ...event, dueAt: e.target.value + ':00+08:00' })}/></label>
          <label className="field wide">说明<textarea rows={3} value={event.description} onChange={e => setEvent({ ...event, description: e.target.value })}/></label>
        </div><p>{error && <span className="form-error">{error}</span>}{success && <span className="form-success">{success}</span>}</p><button className="primary-button" type="submit">保存事项</button>{event.id && <button type="button" className="outline-button" onClick={() => setEvent(blankEvent)}>取消编辑</button>}</form>
        <div className="admin-list">{snapshot?.events.map(item => <div className="admin-row" key={item.id}><div><strong>{item.title}</strong><small>{item.category} · 截止 {item.dueAt.slice(0, 16).replace('T', ' ')}</small></div><div><button onClick={() => setEvent(item)}>编辑</button><button aria-label={`删除${item.title}`} onClick={() => { if (confirm(`确定删除“${item.title}”？`)) void action('events', 'DELETE', { id: item.id }, '删除事项'); }}><Trash2 size={16}/></button></div></div>)}</div></>}
        {tab === 'settings' && <><div className="section-head"><h2>网站设置</h2></div><form onSubmit={e => { e.preventDefault(); void action('site-settings', 'PUT', { className }, '保存班级名称'); }}><div className="form-grid"><label className="field wide">班级名称<input required maxLength={60} value={className} onChange={e => setClassName(e.target.value)} placeholder="例如：ID 2601 班务"/></label></div><p>{error && <span className="form-error">{error}</span>}{success && <span className="form-success">{success}</span>}</p><button className="primary-button" type="submit">保存班级名称</button></form></>}
      </section>
    </>}
  </div>;
}
