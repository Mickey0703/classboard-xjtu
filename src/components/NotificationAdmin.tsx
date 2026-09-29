import { useEffect, useState } from 'react';
import type { NotificationKind, NotificationPriority, NotificationStatus } from '../domain/types';

interface AdminNotification {
  id: string; kind: NotificationKind; priority: NotificationPriority; title: string; body: string;
  due_at: string | null; pinned: number; status: NotificationStatus; published_at: string | null;
}
interface Stats { total: number; acknowledged: number; completed: number; notAcknowledged: { email: string; displayName: string }[]; notCompleted: { email: string; displayName: string }[] }
const blank = { kind: 'notice' as NotificationKind, priority: 'normal' as NotificationPriority, title: '', body: '', dueAt: null as string | null, pinned: false };

export default function NotificationAdmin({ onPublished }: { onPublished: () => Promise<void> | void }) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [form, setForm] = useState({ ...blank, id: '' });
  const [statsId, setStatsId] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = async () => {
    const response = await fetch('/api/admin/notifications', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw Error('通知列表暂不可用');
    setItems(await response.json() as AdminNotification[]);
  };
  const loadStats = async (id: string) => {
    const response = await fetch(`/api/admin/notification-stats?id=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw Error('统计暂不可用');
    setStats(await response.json() as Stats);
    setStatsId(id);
  };
  useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : '通知列表暂不可用')); }, []);
  const request = async (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body: unknown) => {
    const response = await fetch('/api/admin/notifications', { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; throw Error(result.error ?? '操作失败'); }
    return response.json() as Promise<{ id: string; status: NotificationStatus }>;
  };
  const save = async () => {
    setError(''); setMessage('');
    if (form.kind === 'task' && !form.dueAt) { setError('待办必须填写截止时间'); return; }
    try { await request(form.id ? 'PUT' : 'POST', form); await load(); setMessage('草稿已保存'); setForm({ ...blank, id: '' }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
  };
  const transition = async (id: string, action: 'publish' | 'withdraw') => {
    setError(''); setMessage('');
    try { await request('PATCH', { id, action }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '操作失败'); return; }
    try { await load(); }
    catch { setError(action === 'publish' ? '已发布，但列表刷新失败，请刷新页面确认' : '已撤回，但列表刷新失败，请刷新页面确认'); return; }
    try { await onPublished(); }
    catch { setError(action === 'publish' ? '已发布，但首页刷新失败，请刷新页面确认' : '已撤回，但首页刷新失败，请刷新页面确认'); return; }
    if (action === 'publish') {
      try { await loadStats(id); }
      catch { setError('已发布，但统计刷新失败，请稍后重试'); return; }
    }
    setMessage(action === 'publish' ? '通知已发布' : '通知已撤回');
  };
  const statsKind = items.find(item => item.id === statsId)?.kind;
  return <div className="admin-subsection"><div className="section-head"><h2>{form.id ? '编辑通知草稿' : '撰写通知'}</h2></div>
    <form onSubmit={e => { e.preventDefault(); void save(); }}><div className="form-grid">
      <label className="field">类型<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as NotificationKind, dueAt: e.target.value === 'notice' ? null : form.dueAt })}><option value="notice">公告</option><option value="task">待办</option></select></label>
      <label className="field">重要程度<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as NotificationPriority })}><option value="normal">普通</option><option value="important">重要</option><option value="urgent">紧急</option></select></label>
      <label className="field wide">通知标题<input required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
      <label className="field wide">通知正文<textarea required rows={6} maxLength={5000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}/></label>
      {form.kind === 'task' && <label className="field">截止时间<input type="datetime-local" required value={form.dueAt?.slice(0,16) ?? ''} onChange={e => setForm({ ...form, dueAt: e.target.value ? `${e.target.value}:00+08:00` : null })}/></label>}
      <label className="field checkbox-field"><input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })}/> 置顶显示</label>
    </div><p>{error && <span className="form-error" role="alert">{error}</span>}{message && <span className="form-success">{message}</span>}</p><button className="primary-button" type="submit">保存草稿</button>{form.id && <button className="outline-button" type="button" onClick={() => setForm({ ...blank, id: '' })}>取消编辑</button>}</form>
    <div className="admin-list"><h3>通知记录</h3>{items.length ? items.map(item => <div className="admin-notice-row" key={item.id}><div><strong>{item.title}</strong><small>{item.kind === 'task' ? '待办' : '公告'} · {item.priority === 'urgent' ? '紧急' : item.priority === 'important' ? '重要' : '普通'} · {item.status === 'draft' ? '草稿' : item.status === 'published' ? '已发布' : '已撤回'}</small></div><div className="admin-notice-actions">{item.status === 'draft' ? <><button onClick={() => setForm({ id: item.id, kind: item.kind, priority: item.priority, title: item.title, body: item.body, dueAt: item.due_at, pinned: Boolean(item.pinned) })}>编辑</button><button onClick={() => void transition(item.id, 'publish')}>发布通知</button></> : item.status === 'published' ? <><button onClick={() => void loadStats(item.id).catch(cause => setError(cause instanceof Error ? cause.message : '统计暂不可用'))}>查看统计</button><button onClick={() => void transition(item.id, 'withdraw')}>撤回</button></> : null}</div></div>) : <p className="empty-note">还没有通知草稿</p>}</div>
    {stats && <section className="notice-stats"><h3>传达统计</h3><p>已知悉 {stats.acknowledged}/{stats.total}{statsKind === 'task' && <>　已完成 {stats.completed}/{stats.total}</>}</p><div className="stats-lists"><div><strong>尚未知悉</strong>{stats.notAcknowledged.length ? stats.notAcknowledged.map(m => <span key={m.email}>{m.displayName} · {m.email}</span>) : <small>全部已知悉</small>}</div>{statsKind === 'task' && <div><strong>尚未完成</strong>{stats.notCompleted.length ? stats.notCompleted.map(m => <span key={m.email}>{m.displayName} · {m.email}</span>) : <small>全部已完成</small>}</div>}</div><small>通知编号：{statsId}</small></section>}
  </div>;
}
