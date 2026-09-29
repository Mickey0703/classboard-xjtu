import { useEffect, useState } from 'react';
import type { ClassMember } from '../domain/types';

export default function MembersAdmin() {
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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
  return <div className="admin-subsection"><div className="section-head"><h2>班级邮箱名单</h2></div><p className="empty-note">只有名单中的同学能确认通知。正式上线时还需将这些邮箱同步加入 Cloudflare Access 允许名单。</p>
    <form onSubmit={e => { e.preventDefault(); void mutate('POST', { email, displayName: name }); }}><div className="form-grid"><label className="field">同学姓名<input required value={name} onChange={e => setName(e.target.value)} maxLength={80}/></label><label className="field">邮箱地址<input required type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={254}/></label></div><p>{error && <span className="form-error" role="alert">{error}</span>}{message && <span className="form-success">{message}</span>}</p><button className="primary-button" type="submit">添加成员</button></form>
    <div className="admin-list"><h3>成员名单</h3>{members.length ? members.map(member => <div className="admin-row" key={member.email}><div><strong>{member.displayName}</strong><small>{member.email}</small></div><div>{member.active ? <button onClick={() => void mutate('DELETE', { email: member.email })}>停用成员</button> : <span className="muted">已停用</span>}</div></div>) : <p className="empty-note">尚未添加成员。发布通知前请先建立名单。</p>}</div>
  </div>;
}
