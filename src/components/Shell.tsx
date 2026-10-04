import { useEffect, useState } from 'react';
import { Bell, ChevronDown, ClipboardList, Home, LockKeyhole, Moon, Sun } from 'lucide-react';
import ClassEmblem from './ClassEmblem';
import HomeScreenGuide from './HomeScreenGuide';
import { ThemeContext, type Theme, type ThemePreference } from './ThemeContext';

export type Page = 'today' | 'schedule' | 'notifications' | 'admin';
const tabs: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'today', label: '今日', icon: Home },
  { id: 'notifications', label: '通知', icon: Bell },
  { id: 'schedule', label: '日程', icon: ClipboardList }
];

export default function Shell({ page, setPage, brandName, children }: { page: Page; setPage: (p: Page) => void; brandName?: string; children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(() => {
    try {
      const saved = localStorage.getItem('classboard-theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch { /* Reading preferences must not prevent viewing the site. */ }
    return 'system';
  });
  const [systemTheme, setSystemTheme] = useState<Theme>(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const theme = preference === 'system' ? systemTheme : preference;
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!query) return;
    setSystemTheme(query.matches ? 'dark' : 'light');
    const onChange = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? 'dark' : 'light');
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener?.(onChange);
    return () => query.removeListener?.(onChange);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1e2733' : '#fdfefe');
  }, [theme]);
  const chooseTheme = (next: ThemePreference) => {
    setPreference(next);
    try { localStorage.setItem('classboard-theme', next); } catch { /* Still switch for this visit. */ }
  };
  const toggleTheme = () => chooseTheme(theme === 'dark' ? 'light' : 'dark');
  return <ThemeContext.Provider value={theme}><div className="app-shell">
    <header className="topbar"><div className="topbar-inner">
      <div className="brand-mark"><ClassEmblem/></div>
      <div className="brand-copy"><strong>{brandName || '西交班务'}</strong><span>西安交通大学 · 班级事务中心</span></div>
      <nav className="bottom-nav" aria-label="主导航">{tabs.map(({ id, label, icon: Icon }) =>
        <button key={id} className={page === id ? 'nav-item active' : 'nav-item'} onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined}><Icon size={18}/><span>{label}</span></button>
      )}</nav>
      <button className="admin-link" onClick={() => setPage('admin')} aria-label="班委管理"><LockKeyhole size={16}/><span>班委管理</span></button>
      <div className="theme-controls"><button className="theme-toggle" onClick={toggleTheme} aria-label={`切换到${theme === 'dark' ? '浅色' : '深色'}模式`} title={`切换到${theme === 'dark' ? '浅色' : '深色'}模式`}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><details className="theme-menu"><summary aria-label="选择外观模式" title="选择外观模式"><ChevronDown size={14}/></summary><div className="theme-options" role="group" aria-label="外观模式">{([{ id: 'system', label: '跟随系统' }, { id: 'light', label: '浅色模式' }, { id: 'dark', label: '深色模式' }] as const).map(option => <button key={option.id} aria-pressed={preference === option.id} onClick={event => { chooseTheme(option.id); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{option.label}</button>)}</div></details></div>
    </div></header>
    <main className="main-wrap">{children}</main>
    <footer className="site-footer">{page === 'today' && <HomeScreenGuide/>}<div className="footer-meta"><span>ID 2601 · XJTU–POLIMI</span><span>让重要的事，有处可寻。</span></div></footer>
  </div></ThemeContext.Provider>;
}
