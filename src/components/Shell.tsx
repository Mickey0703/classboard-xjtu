import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bell, ChevronDown, ClipboardList, Home, LockKeyhole, Moon, Sun } from 'lucide-react';
import ClassEmblem from './ClassEmblem';
import HomeScreenGuide from './HomeScreenGuide';
import { campusPhotos, type CampusPhotoItem } from '../domain/campusPhotos';
import { ThemeContext, type Theme, type ThemePreference } from './ThemeContext';

export type Page = 'today' | 'schedule' | 'notifications' | 'admin';
const tabs: { id: Page; label: string; icon: typeof Home }[] = [
  { id: 'today', label: '今日', icon: Home },
  { id: 'notifications', label: '通知', icon: Bell },
  { id: 'schedule', label: '日程', icon: ClipboardList }
];

export default function Shell({ page, setPage, brandName, campusPhoto = campusPhotos[0], children }: { page: Page; setPage: (p: Page) => void; brandName?: string; campusPhoto?: CampusPhotoItem; children: React.ReactNode }) {
  const main = useRef<HTMLElement>(null);
  const previousPage = useRef(page);
  useLayoutEffect(() => {
    if (previousPage.current === page) return;
    previousPage.current = page;
    main.current?.scrollIntoView?.({ block: 'start' });
  }, [page]);
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#201b20' : '#f6f2ea');
  }, [theme]);
  const chooseTheme = (next: ThemePreference) => {
    setPreference(next);
    try { localStorage.setItem('classboard-theme', next); } catch { /* Still switch for this visit. */ }
  };
  const toggleTheme = () => chooseTheme(theme === 'dark' ? 'light' : 'dark');
  return <ThemeContext.Provider value={theme}><div className="app-shell">
    <a className="skip-content" href="#main-content">跳到主要内容</a>
    <header className="topbar"><div className="topbar-inner">
      <div className="brand-mark"><ClassEmblem/></div>
      <div className="brand-copy"><strong>{brandName || '西交班务'}</strong><span>西安交通大学班级事务中心</span></div>
      <nav className="bottom-nav" aria-label="主导航" data-current-page={page}>{tabs.map(({ id, label, icon: Icon }) =>
        <button key={id} className={page === id ? 'nav-item active' : 'nav-item'} onClick={() => setPage(id)} aria-current={page === id ? 'page' : undefined}><Icon size={18}/><span>{label}</span></button>
      )}</nav>
      <button className="admin-link" onClick={() => setPage('admin')} aria-current={page === 'admin' ? 'page' : undefined} aria-label="班委管理"><LockKeyhole size={16}/><span>班委管理</span></button>
      <div className="theme-controls"><button className="theme-toggle" onClick={toggleTheme} aria-label={`切换到${theme === 'dark' ? '浅色' : '深色'}模式`} title={`切换到${theme === 'dark' ? '浅色' : '深色'}模式`}>{theme === 'dark' ? <Sun size={18}/> : <Moon size={18}/>}</button><details className="theme-menu"><summary aria-label="选择外观模式" title="选择外观模式"><ChevronDown size={14}/></summary><div className="theme-options" role="group" aria-label="外观模式">{([{ id: 'system', label: '跟随系统' }, { id: 'light', label: '浅色模式' }, { id: 'dark', label: '深色模式' }] as const).map(option => <button key={option.id} aria-pressed={preference === option.id} onClick={event => { chooseTheme(option.id); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{option.label}</button>)}</div></details></div>
    </div></header>
    <main ref={main} className="main-wrap" id="main-content" tabIndex={-1}><div className="workspace-stage" key={page} data-page={page}>{children}</div></main>
    <footer className="site-footer">{page === 'today' && <HomeScreenGuide/>}<div className="footer-meta"><span>XJTU–POLIMI ID 2601</span>{page === 'today' && <span>校园照片 <a href={campusPhoto.source}>{campusPhoto.credit}</a>{campusPhoto.license && <>，<a href={campusPhoto.license.url}>{campusPhoto.license.name}</a>，网页裁切</>}</span>}</div></footer>
  </div></ThemeContext.Provider>;
}
