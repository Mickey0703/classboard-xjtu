import { useEffect, useState } from 'react';
import { fetchSnapshot } from './api/client';
import Shell, { type Page } from './components/Shell';
import Today from './pages/Today';
import Timetable from './pages/Timetable';
import Schedule from './pages/Schedule';
import Admin from './pages/Admin';
import type { Snapshot } from './domain/types';

export default function App() {
  const [page, setPage] = useState<Page>('today');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const refresh = () => fetchSnapshot().then(data => { setSnapshot(data); setError(''); }).catch(() => setError('班务数据暂不可用，请稍后刷新页面。'));
  useEffect(() => { void refresh(); }, []);
  const now = new Date();
  return <Shell page={page} setPage={setPage}>
    {page === 'admin' ? <Admin snapshot={snapshot} onSaved={refresh} onBack={() => setPage('today')}/> :
      error ? <div className="state-card"><h2>暂时无法读取班务信息</h2><p>{error}</p><button onClick={refresh}>重新加载</button></div> :
      !snapshot ? <div className="state-card">正在读取班务信息…</div> :
      page === 'today' ? <Today snapshot={snapshot} now={now} onNavigate={setPage}/> :
      page === 'timetable' ? <Timetable snapshot={snapshot} now={now}/> : <Schedule snapshot={snapshot} now={now}/>
    }
  </Shell>;
}
