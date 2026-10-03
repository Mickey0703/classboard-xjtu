import { useEffect, useState } from 'react';
import type { ClassMember } from '../domain/types';
import { parseRoster } from '../domain/roster';

export default function MembersAdmin() {
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [roster, setRoster] = useState('');
  const [importing, setImporting] = useState(false);
  let preview: ReturnType<typeof parseRoster> = [], previewError = '';
  if (roster.trim()) {
    try { preview = parseRoster(roster); }
    catch (cause) { previewError = cause instanceof Error ? cause.message : '名单格式无效'; }
  }
  const load = async () => {
    const response = await fetch('/api/admin/members', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw Error('成员名单暂不可用');
    setMembers(await response.json() as ClassMember[]);
  };
  useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : '成员名单暂不可用')); }, []);
  const mutate = async (method: 'POST' | 'DELETE', body: unknown) => {
    setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/members', { method, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; throw Error(result.error ?? '成员操作失败'); }
      await load();
      if (method === 'POST') { setName(''); setEmail(''); setMessage('成员已添加'); }
      else setMessage('成员已停用');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '成员操作失败'); }
  };
  const importRoster = async () => {
    if (!preview.length || previewError) return;
    setError(''); setMessage(''); setImporting(true);
    try {
      const response = await fetch('/api/admin/members', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ members: preview }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; throw Error(result.error ?? '导入失败'); }
      const count = preview.length;
      setRoster('');
      setMessage(`已导入 ${count} 位成员`);
      try { await load(); } catch { setError('名单已导入，但刷新失败，请刷新页面确认'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败'); }
    finally { setImporting(false); }
  };
  return <div className="admin-subsection"><div className="section-head"><h2>班级邮箱名单</h2></div><p className="empty-note">只有名单中的同学能确认通知。正式上线时还需将这些邮箱同步加入 Cloudflare Access 允许名单。</p>
    <section className="roster-import" aria-label="批量导入成员"><h3>批量导入名单</h3><p className="empty-note">每行一位同学，按“姓名、邮箱”两列填写。可从 Excel 复制粘贴，或选择 UTF-8 编码的 CSV / TSV 文件。</p>
      <label className="field">选择名单文件<input type="file" accept=".csv,.tsv,.txt" disabled={importing} onChange={e => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > 1024 * 1024) { setError('名单文件不能超过 1 MB'); return; }
        void file.text().then(text => { setRoster(text); setError(''); setMessage(''); }).catch(() => setError('文件读取失败，请重新选择'));
      }}/></label>
      <label className="field">批量名单<textarea rows={5} disabled={importing} value={roster} onChange={e => { setRoster(e.target.value); setMessage(''); }} placeholder={'姓名,邮箱\n张三,zhangsan@example.com\n李四,lisi@example.com'}/></label>
      <p role="status">{previewError ? <span className="form-error">{previewError}</span> : preview.length ? `待导入 ${preview.length} 人` : '支持带表头的两列名单，最多 500 人。'}</p>
      <button type="button" className="primary-button" disabled={importing || !preview.length || Boolean(previewError)} onClick={() => void importRoster()}>{importing ? '正在导入…' : '导入名单'}</button>
      <p className="empty-note">同一邮箱会更新姓名并启用成员；未出现在文件中的已有成员保留。</p>
    </section>
    <form onSubmit={e => { e.preventDefault(); void mutate('POST', { email, displayName: name }); }}><div className="form-grid"><label className="field">同学姓名<input required value={name} onChange={e => setName(e.target.value)} maxLength={80}/></label><label className="field">邮箱地址<input required type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254}/></label></div><p>{error && <span className="form-error" role="alert">{error}</span>}{message && <span className="form-success">{message}</span>}</p><button className="primary-button" type="submit">添加成员</button></form>
    <div className="admin-list"><h3>成员名单</h3>{members.length ? members.map(member => <div className="admin-row" key={member.email}><div><strong>{member.displayName}</strong><small>{member.email}</small></div><div>{member.active ? <button onClick={() => void mutate('DELETE', { email: member.email })}>停用成员</button> : <span className="muted">已停用</span>}</div></div>) : <p className="empty-note">尚未添加成员。发布通知前请先建立名单。</p>}</div>
  </div>;
}
