import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSnapshot } from './api/client';
import Shell, { type Page } from './components/Shell';
import Today from './pages/Today';
import Schedule from './pages/Schedule';
import Admin from './pages/Admin';
import Notifications from './pages/Notifications';
import { chooseCampusPhoto, rememberCampusPhoto } from './domain/campusPhotos';
import type { RecipientStatus, Snapshot } from './domain/types';

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    const view = new URLSearchParams(window.location.search).get('view');
    return view === 'admin' || view === 'notifications' || view === 'schedule' ? view : 'today';
  });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [campusPhoto] = useState(chooseCampusPhoto);
  const photoShown = useRef(false);
  const [syncWarning, setSyncWarning] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [receipts, setReceipts] = useState<RecipientStatus[] | null>(null);
  const [receiptStatus, setReceiptStatus] = useState<'loading' | 'ready' | 'guest' | 'error'>('loading');
  const receiptRequest = useRef(0);
  useEffect(() => {
    if (page !== 'today' || !snapshot || error || photoShown.current) return;
    rememberCampusPhoto(campusPhoto.id);
    photoShown.current = true;
  }, [campusPhoto.id, page, snapshot, error]);
  const onReceiptsChanged = useCallback((rows: RecipientStatus[]) => {
    receiptRequest.current++;
    setReceipts(rows); setReceiptStatus('ready');
  }, []);
  useEffect(() => {
    if (page !== 'today') return;
    let active = true;
    const load = async () => {
      const request = ++receiptRequest.current;
      try {
        const response = await fetch('/api/member/receipt', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' });
        if (!active || request !== receiptRequest.current) return;
        if (response.type === 'opaqueredirect' || [0, 302, 303, 401, 403].includes(response.status)) { setReceipts(null); setReceiptStatus('guest'); return; }
        if (!response.ok) throw Error('receipt unavailable');
        const rows = await response.json() as RecipientStatus[];
        if (!Array.isArray(rows)) throw Error('invalid receipts');
        if (active && request === receiptRequest.current) { setReceipts(rows); setReceiptStatus('ready'); }
      } catch { if (active && request === receiptRequest.current) setReceiptStatus('error'); }
    };
    const sync = () => { void load(); };
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    sync();
    const timer = window.setInterval(sync, 60_000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; receiptRequest.current++; window.clearInterval(timer); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', onVisible); };
  }, [page]);
  const refresh = async () => {
    try { const data = await fetchSnapshot(); setSnapshot(data); setError(''); }
    catch (cause) { setError('班务数据暂不可用，请稍后刷新页面。'); throw cause; }
  };
  useEffect(() => { void refresh().catch(() => {}); }, []);
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') update(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  useEffect(() => {
    if (page === 'admin') return;
    const sync = () => { void fetchSnapshot().then(data => { setSnapshot(data); setSyncWarning(false); }).catch(() => setSyncWarning(true)); };
    if (page === 'notifications') sync();
    const timer = window.setInterval(sync, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [page]);
  return <Shell page={page} setPage={setPage} brandName={snapshot?.className} campusPhoto={campusPhoto}>
    {syncWarning && snapshot && page !== 'admin' && <div className="demo-banner" role="status">通知更新暂时失败，当前显示上次读取的内容。</div>}
    {page === 'admin' ? <Admin snapshot={snapshot} onSaved={refresh} onBack={() => setPage('today')}/> :
      error ? <div className="state-card"><h2>暂时无法读取班务信息</h2><p>{error}</p><button onClick={() => void refresh().catch(() => {})}>重新加载</button></div> :
      !snapshot ? <div className="state-card loading-panel" role="status"><span>正在读取班务信息…</span><div aria-hidden="true"><i/><i/><i/></div></div> :
      page === 'notifications' ? <Notifications snapshot={snapshot} now={now} onReceiptsChanged={onReceiptsChanged} targetId={new URLSearchParams(window.location.search).get('notice')}/> :
      page === 'today' ? <Today snapshot={snapshot} now={now} onNavigate={setPage} receipts={receipts} receiptStatus={receiptStatus} campusPhoto={campusPhoto}/> :
      <Schedule snapshot={snapshot} now={now}/>
    }
  </Shell>;
}
