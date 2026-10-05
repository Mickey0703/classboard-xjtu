import { useEffect, useRef, useState } from 'react';
import type { ClassMember, NotificationKind, NotificationPriority, NotificationStatus } from '../domain/types';
import { movePhotoPositions, type Photo } from '../domain/photos';
import PhotoUpload from './PhotoUpload';
import { NotificationBody, PhotoGallery } from './PhotoViewer';
import FileUpload from './FileUpload';
import type { Attachment } from '../domain/attachments';

interface AdminNotification {
  id: string; kind: NotificationKind; priority: NotificationPriority; title: string; body: string;
  due_at: string | null; pinned: number; status: NotificationStatus; published_at: string | null;
  recipientEmails?: string[] | null;
  photos?: Photo[];
  attachments?: Attachment[];
  requiresCompletionProof?: boolean;
}
interface Stats { total: number; acknowledged: number; completed: number; notAcknowledged: { email: string; displayName: string }[]; notCompleted: { email: string; displayName: string }[]; completedRecipients?: { email: string; displayName: string; completedAt: string; photos: Photo[] }[] }
const blank = { kind: 'notice' as NotificationKind, priority: 'normal' as NotificationPriority, title: '', body: '', dueAt: null as string | null, pinned: false, photos: [] as Photo[], attachments: [] as Attachment[], requiresCompletionProof: false };
const completedTime = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'medium', timeStyle: 'short' });
export type NotificationAdminView = 'compose' | 'records';

export default function NotificationAdmin({ onPublished, view, onViewChange }: { onPublished: () => Promise<void> | void; view: NotificationAdminView; onViewChange: (view: NotificationAdminView) => void }) {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const processing = uploading || uploadingFiles;
  const insertionPoint = useRef(0);
  const bodyInput = useRef<HTMLTextAreaElement>(null);
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
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const response = await fetch('/api/admin/members', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw Error('成员名单暂不可用，请刷新后重试');
      const active = (await response.json() as ClassMember[]).filter(member => member.active);
      if (!cancelled) { setMembers(active); setRecipientEmails(active.map(member => member.email)); setMembersLoaded(true); }
    })().catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : '成员名单暂不可用'); });
    return () => { cancelled = true; };
  }, []);
  const reset = () => { setForm({ ...blank, id: '' }); insertionPoint.current = 0; setRecipientEmails(members.map(member => member.email)); setQuery(''); };
  const request = async (method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body: unknown) => {
    const response = await fetch('/api/admin/notifications', { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; throw Error(result.error ?? '操作失败'); }
    return response.json() as Promise<{ id: string; status: NotificationStatus }>;
  };
  const save = async () => {
    if (busy || processing) return;
    setError(''); setMessage('');
    if (!membersLoaded) { setError('成员名单尚未加载，请稍后重试'); return; }
    if (!recipientEmails.length) { setError('请至少选择一位收件人'); return; }
    if (form.kind === 'task' && !form.dueAt) { setError('待办必须填写截止时间'); return; }
    setBusy(true);
    try { await request(form.id ? 'PUT' : 'POST', { ...form, recipientEmails }); await load(); setMessage('草稿已保存'); reset(); onViewChange('records'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); }
    finally { setBusy(false); }
  };
  const transition = async (id: string, action: 'publish' | 'withdraw') => {
    if (busy || processing) return;
    setBusy(true);
    try {
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
    } finally { setBusy(false); }
  };
  return <div className="admin-subsection"><div className="section-head"><h2>{view === 'records' ? '通知记录' : form.id ? '编辑通知草稿' : '撰写通知'}</h2></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success">{message}</p>}
    <form hidden={view !== 'compose'} onSubmit={e => { e.preventDefault(); void save(); }}><div className="form-grid">
      <label className="field">类型<select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as NotificationKind, dueAt: e.target.value === 'notice' ? null : form.dueAt, requiresCompletionProof: e.target.value === 'task' && form.requiresCompletionProof })}><option value="notice">公告</option><option value="task">待办</option></select></label>
      <label className="field">重要程度<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as NotificationPriority })}><option value="normal">普通</option><option value="important">重要</option><option value="urgent">紧急</option></select></label>
      <label className="field wide">通知标题<input required maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label>
      <label className="field wide">通知正文<textarea ref={bodyInput} required disabled={busy || processing} rows={6} maxLength={5000} value={form.body} onSelect={e => { insertionPoint.current = e.currentTarget.selectionStart; }} onChange={e => { const body = e.target.value; insertionPoint.current = e.target.selectionStart; setForm({ ...form, body, photos: movePhotoPositions(form.photos, form.body, body), attachments: movePhotoPositions(form.attachments, form.body, body) }); }}/></label>
      <div className="field wide"><PhotoUpload photos={form.photos} disabled={busy || uploadingFiles} onBusy={value => { if (value) insertionPoint.current = bodyInput.current?.selectionStart ?? insertionPoint.current; setUploading(value); }} onChange={photos => setForm(previous => ({ ...previous, photos: photos.map(photo => photo.position === undefined ? { ...photo, position: Math.min(previous.body.length, insertionPoint.current) } : photo) }))}/>
        <FileUpload attachments={form.attachments} disabled={busy || uploading} onBusy={value => { if (value) insertionPoint.current = bodyInput.current?.selectionStart ?? insertionPoint.current; setUploadingFiles(value); }} onChange={attachments => setForm(previous => ({ ...previous, attachments: attachments.map(file => file.position === undefined ? { ...file, position: Math.min(previous.body.length, insertionPoint.current) } : file) }))}/>
        <small className="muted">先在正文中点击插入位置，再添加照片或上传文件。内容将随通知一起公开展示。</small>
        {(form.photos.length > 0 || form.attachments.length > 0) && <section className="notice-preview" aria-label="正文预览"><h3>正文预览</h3><NotificationBody body={form.body} photos={form.photos} attachments={form.attachments}/></section>}
      </div>
      <div className="field wide recipient-field"><span>收件人</span>
        <div className="recipient-toolbar"><span role="status">{membersLoaded ? `已选 ${recipientEmails.length} / ${members.length} 人` : '正在加载成员…'}</span><div><button className="outline-button" type="button" disabled={!membersLoaded || busy} onClick={() => setRecipientEmails(members.map(member => member.email))}>全选</button><button className="outline-button" type="button" disabled={busy} onClick={() => setRecipientEmails([])}>清空</button></div></div>
        <details className="recipient-picker"><summary>选择收件人（可多选）</summary><div className="recipient-panel">
          <label className="field">搜索姓名或邮箱<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="输入姓名或邮箱"/></label>
          <div className="recipient-options">{members.filter(member => `${member.displayName} ${member.email}`.toLowerCase().includes(query.trim().toLowerCase())).map(member => <label className="recipient-option" key={member.email}><input type="checkbox" disabled={busy} checked={recipientEmails.includes(member.email)} onChange={e => setRecipientEmails(previous => e.target.checked ? [...previous, member.email] : previous.filter(email => email !== member.email))}/><span>{member.displayName}<small>{member.email}</small></span></label>)}</div>
          {!members.length && membersLoaded && <p className="empty-note">尚无活跃成员，请先在“成员”页导入名单。</p>}
          {members.length > 0 && !members.some(member => `${member.displayName} ${member.email}`.toLowerCase().includes(query.trim().toLowerCase())) && <p className="empty-note">没有匹配的成员</p>}
        </div></details>
        {recipientEmails.some(email => !members.some(member => member.email === email)) && <span className="form-error">草稿含已停用成员，请重新选择或点击全选。</span>}
        <small className="muted">所选人员用于知悉与完成统计；通知正文仍公开展示。</small>
      </div>
      {form.kind === 'task' && <label className="field">截止时间<input type="datetime-local" required value={form.dueAt?.slice(0,16) ?? ''} onChange={e => setForm({ ...form, dueAt: e.target.value ? `${e.target.value}:00+08:00` : null })}/></label>}
      {form.kind === 'task' && <label className="field checkbox-field"><input type="checkbox" disabled={busy} checked={form.requiresCompletionProof} onChange={e => setForm({ ...form, requiresCompletionProof: e.target.checked })}/> 须提交完成凭据</label>}
      <label className="field checkbox-field"><input type="checkbox" checked={form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })}/> 置顶显示</label>
    </div><button className="primary-button" type="submit" disabled={busy || processing || !membersLoaded || !members.length}>{busy ? '正在保存…' : '保存草稿'}</button>{form.id && <button className="outline-button" type="button" disabled={busy || processing} onClick={reset}>取消编辑</button>}</form>
    {view === 'records' && <><div className="notification-records-list">{items.length ? items.map(item => <article className="notification-record" key={item.id}><div className="admin-notice-row">
      <div><strong>{item.title}</strong><small>{item.kind === 'task' ? '待办' : '公告'} · {item.priority === 'urgent' ? '紧急' : item.priority === 'important' ? '重要' : '普通'} · {item.status === 'draft' ? '草稿' : item.status === 'published' ? '已发布' : '已撤回'}</small>{item.status === 'draft' && <small>收件人：{item.recipientEmails == null ? '发布时全部活跃成员' : `${item.recipientEmails.length} 人`}</small>}</div>
      <div className="admin-notice-actions">{item.status === 'draft' ? <>
        <button disabled={!membersLoaded || busy || processing} onClick={() => { setForm({ id: item.id, kind: item.kind, priority: item.priority, title: item.title, body: item.body, photos: item.photos ?? [], attachments: item.attachments ?? [], dueAt: item.due_at, pinned: Boolean(item.pinned), requiresCompletionProof: Boolean(item.requiresCompletionProof) }); insertionPoint.current = item.body.length; setRecipientEmails(item.recipientEmails ?? members.map(member => member.email)); setQuery(''); setError(''); setMessage(''); onViewChange('compose'); }}>编辑</button>
        <button disabled={busy || processing || form.id === item.id} title={form.id === item.id ? '请先保存或取消编辑，再发布通知' : undefined} onClick={() => void transition(item.id, 'publish')}>发布通知</button>
      </> : item.status === 'published' ? <><button onClick={() => void loadStats(item.id).catch(cause => setError(cause instanceof Error ? cause.message : '统计暂不可用'))}>查看统计</button><button disabled={busy} onClick={() => void transition(item.id, 'withdraw')}>撤回</button></> : null}</div>
    </div>
    {stats && statsId === item.id && item.status === 'published' && <section className="notice-stats"><h3>传达统计</h3><p>已知悉 {stats.acknowledged}/{stats.total}{item.kind === 'task' && <>　已完成 {stats.completed}/{stats.total}</>}</p><div className="stats-lists"><div><strong>尚未知悉</strong>{stats.notAcknowledged.length ? stats.notAcknowledged.map(m => <span key={m.email}>{m.displayName} · {m.email}</span>) : <small>全部已知悉</small>}</div>{item.kind === 'task' && <div><strong>尚未完成</strong>{stats.notCompleted.length ? stats.notCompleted.map(m => <span key={m.email}>{m.displayName} · {m.email}</span>) : <small>全部已完成</small>}</div>}</div><small>通知编号：{statsId}</small></section>}
    {stats && statsId === item.id && item.status === 'published' && item.kind === 'task' && <section className="completed-recipients"><h3>已完成同学与照片</h3>{stats.completedRecipients?.length ? stats.completedRecipients.map(person => <article className="completed-recipient" key={person.email}><strong>{person.displayName}</strong><small>{person.email} · 完成于 {completedTime.format(new Date(person.completedAt))}</small>{person.photos.length ? <PhotoGallery photos={person.photos} label={`${person.displayName}的完成照片`}/> : <p className="muted">未上传照片</p>}</article>) : <p className="empty-note">暂无已完成同学</p>}</section>}</article>) : <p className="empty-note">还没有通知草稿</p>}</div></>}
  </div>;
}
