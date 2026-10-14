import { useState } from 'react';
import { CalendarPlus, Copy, Download } from 'lucide-react';
import { androidCalendarIntent, calendarDetails, calendarPlatform, calendarUrls } from '../domain/calendar';
import type { EventItem } from '../domain/types';
import { Modal } from './Modal';

function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const [status, setStatus] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setStatus('已复制'); }
    catch { setStatus('请长按或选中上方内容复制。'); }
  }
  return <div className="calendar-copy"><label>{label}{multiline ? <textarea readOnly value={value} rows={6} onFocus={e => e.currentTarget.select()}/> : <input readOnly value={value} onFocus={e => e.currentTarget.select()}/>}</label><button type="button" className="outline-button" onClick={() => void copy()}><Copy size={16} aria-hidden="true"/>复制{label}</button><span role="status">{status}</span></div>;
}

export default function CalendarDialog({ event, className, onClose }: { event?: EventItem; className: string; onClose: () => void }) {
  const origin = window.location.origin;
  const urls = calendarUrls(origin, event?.id);
  const platform = calendarPlatform(navigator.userAgent, navigator.maxTouchPoints);
  const [device, setDevice] = useState(platform.device);
  const isClass = !event;
  return <Modal title={isClass ? '订阅班级日程' : '添加到日历'} onClose={onClose} className="calendar-dialog">
    <p className="calendar-summary">{isClass ? '订阅全部未完成日程，班委新增或修改安排后，支持订阅的手机日历会自动更新。' : event.title}</p>
    {platform.embedded && <p className="calendar-notice">当前在微信或 QQ 内打开，请点右上角菜单，选择“在浏览器中打开”，再添加或订阅日历。</p>}
    <label className="calendar-device">选择手机系统<select value={device} onChange={e => setDevice(e.target.value)}><option value="ios">iPhone / iPad</option><option value="android">安卓 · 小米 / OPPO / vivo / 荣耀等</option><option value="harmony">华为 · HarmonyOS</option><option value="other">其他设备 / 电脑</option></select></label>
    {isClass ? <>
      <div className="calendar-dialog-actions"><a className="primary-button" href={urls.subscribe}><CalendarPlus size={17} aria-hidden="true"/>订阅班级日程</a></div>
      <p>这是只读订阅。更新以手机日历的刷新频率为准，可能有延迟；完成或删除的日程会从订阅中移除。请勿重复订阅。</p>
      <CopyField label="订阅地址" value={urls.open}/>
      {device === 'ios' ? <p>若按钮未唤起日历：复制地址，打开系统“日历” → “日历” → “添加日历” → “添加订阅日历”，粘贴地址并确认订阅。主屏幕网页 App 无法唤起时，请用 Safari 打开本站。</p> : <p>在系统日历中查找“订阅日历”或“通过网址添加”，粘贴上方地址。各品牌和版本的入口不同；如果只有“导入文件”，则该入口不支持自动更新。CalDAV 账户也不能直接填写此订阅地址。</p>}
      <details className="calendar-fallback"><summary>手机不支持订阅？</summary><p>可下载日历文件后导入。文件是本次安排的副本，后续变更不会自动同步；已导入的副本需要自行修改或删除。</p><a className="outline-button" href={urls.download} target="_blank" rel="noopener noreferrer"><Download size={16} aria-hidden="true"/>下载日历文件</a></details>
    </> : <>
      <div className="calendar-dialog-actions">
        {device === 'android' && !platform.embedded && <a className="primary-button" href={androidCalendarIntent(event, className, origin)}>尝试打开系统日历</a>}
        <a className={device === 'android' && !platform.embedded ? 'outline-button' : 'primary-button'} href={device === 'ios' ? urls.open : urls.download} target="_blank" rel="noopener noreferrer"><CalendarPlus size={17} aria-hidden="true"/>{device === 'ios' ? '打开日历文件' : '下载日历文件'}</a>
      </div>
      <p>请在系统日历中确认保存。文件保留开始、截止时间及截止前 30 分钟提醒；提醒是否生效取决于日历设置。单次添加不会自动同步之后的变更。</p>
      {device === 'ios' ? <details className="calendar-fallback" open><summary>未出现“添加”按钮？</summary><p>用 Safari 打开；如果只显示文件预览，可订阅这条日程，或复制下方地址到系统日历的“添加订阅日历”。订阅刷新可能有延迟。</p><a className="outline-button" href={urls.subscribe}>订阅这条日程</a><CopyField label="订阅地址" value={urls.open}/></details>
        : <details className="calendar-fallback" open><summary>未打开系统日历？</summary><p>在下载列表或文件管理中打开 .ics 文件，选择“日历”并确认导入。华为也可在日历的“添加” → “导入日程” → “从文件导入”中选择文件。部分机型不支持文件导入，可复制下方信息手动新建日程。直接唤起时请检查提醒时间。</p></details>}
      <CopyField label="日程信息" value={calendarDetails(event, className, origin)} multiline/>
    </>}
  </Modal>;
}
