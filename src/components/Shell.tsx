import { Bell, CalendarDays, ClipboardList, Home, LockKeyhole } from 'lucide-react';

export type Page = 'today' | 'timetable' | 'schedule' | 'notifications' | 'admin';
const tabs: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'today', label: '今日', icon: Home },
  { id: 'timetable', label: '课表', icon: CalendarDays },
  { id: 'schedule', label: '日程', icon: ClipboardList },
  { id: 'notifications', label: '通知', icon: Bell }
];

export default function Shell({ page, setPage, brandName, children }: { page: Page; setPage: (p: Page) => void; brandName?: string; children: React.ReactNode }) {
  return <div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <div className="brand-mark"><img src="/class-emblem.png" alt="ID 2601 班徽"/></div>
      <div className="brand-copy"><strong>{brandName || '西交班务'}</strong><span>西安交通大学 · ID 2601 班级生活看板</span></div>
      <button className="admin-link" onClick={() => setPage('admin')} aria-label="班委管理"><LockKeyhole size={16}/><span>班委管理</span></button>
    </div></header>
    <main className="main-wrap">{children}</main>
    <nav className="bottom-nav" aria-label="主导航">{tabs.map(({ id, label, icon: Icon }) =>
      <button key={id} className={page === id ? 'nav-item active' : 'nav-item'} onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined}><Icon size={20}/><span>{label}</span></button>
    )}</nav>
  </div>;
}
