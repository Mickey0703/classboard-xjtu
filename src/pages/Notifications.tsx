import { useEffect, useState } from 'react';
import { AlertCircle, Bell, CheckCheck, CircleCheck, ClipboardCheck, Clock3, Pin } from 'lucide-react';
import type { NotificationItem, RecipientStatus, Snapshot } from '../domain/types';
import type { Photo } from '../domain/photos';
import PhotoUpload from '../components/PhotoUpload';
import { Modal, NotificationBody, PhotoGallery } from '../components/PhotoViewer';

type Filter = 'all' | 'notice' | 'task';
type Member = { email: string; displayName: string };
const timeFmt = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

export default function Notifications({ snapshot, now, onReceiptsChanged }: { snapshot: Snapshot; now: Date; onReceiptsChanged?: (rows: RecipientStatus[]) => void }) {
  const [member, setMember] = useState<Member | null>(null);
  const [checking, setChecking] = useState(true);
  const [receipts, setReceipts] = useState<RecipientStatus[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState<NotificationItem | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const session = await fetch('/api/member/session', { credentials: 'same-origin' });
        if (!session.ok) throw Error('not signed in');
        const person = await session.json() as Member;
        const status = await fetch('/api/member/receipt', { credentials: 'same-origin' });
        if (!status.ok) throw Error('receipt unavailable');
        const rows = await status.json() as RecipientStatus[];
        if (active) { setMember(person); setReceipts(rows); onReceiptsChanged?.(rows); }
      } catch { if (active) setMember(null); }
      finally { if (active) setChecking(false); }
    };
    void load();
    return () => { active = false; };
  }, [onReceiptsChanged]);
  const change = async (notificationId: string, action: 'ack' | 'complete' | 'undoComplete', completionPhotos?: Photo[]) => {
    if (pending) return;
    setError(''); setPending(notificationId);
    try {
      const response = await fetch('/api/member/receipt', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificationId, action, ...(action === 'complete' ? { photos: completionPhotos ?? [] } : {}) }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; throw Error(result.error ?? '确认失败'); }
      if (action === 'complete') { setCompleting(null); setPhotos([]); }
      const refreshed = await fetch('/api/member/receipt', { credentials: 'same-origin', cache: 'no-store' });
      if (!refreshed.ok) throw Error('已保存，但状态刷新失败，请重新打开通知页');
      const rows = await refreshed.json() as RecipientStatus[];
      setReceipts(rows); onReceiptsChanged?.(rows);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '确认失败'); }
    finally { setPending(''); }
  };
  const onAction = async (id: string, action: 'ack' | 'complete' | 'undoComplete') => {
    const item = snapshot.notifications.find(n => n.id === id);
    if (action === 'complete' && item?.requiresCompletionProof) { setError(''); setPhotos([]); setCompleting(item); }
    else await change(id, action);
  };
  const items = [...snapshot.notifications].filter(n => filter === 'all' || n.kind === filter).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || b.id.localeCompare(a.id));
  return <div className="page-stack"><div className="page-title"><div><span className="eyebrow">CLASS NOTICEBOARD</span><h1>班级通知</h1><p>重要消息及时看，待办事项不遗漏。</p></div><Bell className="title-illustration" size={52}/></div>
    {snapshot.demo && <div className="demo-banner">演示数据 · 正式通知由班委发布</div>}
    <div className="notice-intro"><div><strong>{snapshot.notifications.length}</strong><span>条已发布通知</span></div><p>阅读通知无需登录；确认知悉和完成待办需要班级邮箱身份。</p></div>
    {!checking && (member ? <div className="member-strip"><CheckCheck size={18}/> {member.displayName} · {member.email}</div> : <div className="member-strip"><AlertCircle size={18}/><span>登录后可确认通知是否送达你本人。</span><a href="/api/member/login">使用班级邮箱登录</a></div>)}
    {error && !completing && <div className="form-error" role="alert">{error}</div>}
    <div className="filter-tabs notice-filters" aria-label="通知类型"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>全部</button><button className={filter === 'notice' ? 'selected' : ''} onClick={() => setFilter('notice')}>公告</button><button className={filter === 'task' ? 'selected' : ''} onClick={() => setFilter('task')}>待办</button></div>
    <div className="notice-list">{items.length ? items.map(n => <NoticeCard key={n.id} item={n} now={now} member={member} receipt={receipts.find(r => r.notificationId === n.id)} pending={Boolean(pending)} onChange={onAction}/>) : <div className="state-card"><h2>暂无通知</h2><p>班委发布后，这里会显示公告和待办。</p></div>}</div>
    {completing && <Modal title="提交完成照片" busy={Boolean(pending) || uploading} onClose={() => { setCompleting(null); setPhotos([]); setError(''); }}>
      <p className="completion-task-title">{completing.title}</p><p>请添加完成照片或截图，供班委查看。</p>
      <PhotoUpload photos={photos} onChange={setPhotos} label="添加完成照片" disabled={Boolean(pending)} onBusy={setUploading}/>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button type="button" className="outline-button" disabled={Boolean(pending) || uploading} onClick={() => { setCompleting(null); setPhotos([]); setError(''); }}>取消</button><button type="button" className="primary-button" disabled={Boolean(pending) || uploading || !photos.length} onClick={() => void change(completing.id, 'complete', photos)}>{pending ? '正在提交…' : '确认'}</button></div>
    </Modal>}
  </div>;
}

function NoticeCard({ item, now, member, receipt, pending, onChange }: { item: NotificationItem; now: Date; member: Member | null; receipt?: RecipientStatus; pending: boolean; onChange: (id: string, action: 'ack'|'complete'|'undoComplete') => Promise<void> }) {
  const overdue = item.dueAt && Date.parse(item.dueAt) < now.getTime();
  return <article className={`card notice-card priority-${item.priority}`}><div className="notice-card-head"><div className="notice-tags"><span className="category-tag">{item.kind === 'task' ? '待办' : '公告'}</span>{item.priority !== 'normal' && <span className={`priority-tag ${item.priority}`}>{item.priority === 'urgent' ? '紧急' : '重要'}</span>}{item.pinned && <span className="pin-tag"><Pin size={12}/> 置顶</span>}</div><span className="notice-date">{timeFmt.format(new Date(item.publishedAt))}</span></div>
    <h2>{item.title}</h2><NotificationBody body={item.body} photos={item.photos} attachments={item.attachments}/>{item.kind === 'task' && <div className={overdue ? 'notice-deadline overdue' : 'notice-deadline'}><Clock3 size={15}/> 截止 {item.dueAt ? timeFmt.format(new Date(item.dueAt)) : '未设置'}{overdue ? ' · 已过期' : ''}</div>}
    {member && <div className="receipt-actions">{!receipt ? <span className="receipt-note">发布时你不在这条通知的收件名单中</span> : <>
      {receipt.acknowledgedAt ? <span className="receipt-state"><CircleCheck size={16}/> 已知悉</span> : <button disabled={pending} className="outline-button" onClick={() => void onChange(item.id, 'ack')}>确认已知悉</button>}
      {item.kind === 'task' && (receipt.completedAt ? <button disabled={pending} className="outline-button" onClick={() => void onChange(item.id, 'undoComplete')}>撤销完成</button> : <button disabled={pending} className="primary-button" onClick={() => void onChange(item.id, 'complete')}><ClipboardCheck size={15}/> 标记已完成</button>)}
    </>}</div>}
    {receipt?.completedAt && Boolean(receipt.photos?.length) && <div className="completion-proof"><small>你提交的完成照片（仅本人和班委可见）</small><PhotoGallery photos={receipt.photos ?? []}/></div>}
  </article>;
}
