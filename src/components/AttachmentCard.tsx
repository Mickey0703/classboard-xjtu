import { useEffect, useRef, useState } from 'react';
import { FileDown } from 'lucide-react';
import { fileSizeLabel, type Attachment } from '../domain/attachments';
import { Modal } from './Modal';
import PdfPreview from './PdfPreview';
import { loadAttachmentBytes, prefetchAttachment } from '../api/attachment-source';

function fileType(name: string, bytes: Uint8Array): string {
  if (new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-') return 'application/pdf';
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (/\.csv$/i.test(name)) return 'text/csv';
  if (/\.(txt|md|json)$/i.test(name)) return 'text/plain';
  const types: Record<string, string> = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', doc: 'application/msword', xls: 'application/vnd.ms-excel', ppt: 'application/vnd.ms-powerpoint', zip: 'application/zip' };
  return types[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

function FilePanel({ file, onClose }: { file: Attachment; onClose: () => void }) {
  const [prepared, setPrepared] = useState<{ file: File; bytes: Uint8Array<ArrayBuffer>; imageUrl?: string } | null>(null);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let imageUrl: string | undefined;
    void (async () => {
      try {
        const bytes = await loadAttachmentBytes(file, controller.signal, (loaded, total) => { if (!controller.signal.aborted) setProgress(Math.min(100, Math.round(loaded / Math.max(1, total) * 100))); });
        if (controller.signal.aborted) return;
        const type = fileType(file.name, bytes);
        const attachment = new File([bytes], file.name, { type });
        if (type.startsWith('image/')) imageUrl = URL.createObjectURL(attachment);
        setPrepared({ file: attachment, bytes, imageUrl });
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof TypeError ? '文件读取失败，请检查网络后重新打开' : cause instanceof Error ? cause.message : '文件暂时无法读取'); }
    })();
    return () => { controller.abort(); if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [file.url, file.name]);
  let canShare = false;
  try { canShare = Boolean(prepared && typeof navigator.share === 'function' && navigator.canShare?.({ files: [prepared.file] })); } catch { /* A blocked share capability falls back to a new window. */ }
  const share = async () => {
    if (!prepared || sharing) return;
    setSharing(true);
    try { await navigator.share({ files: [prepared.file], title: file.name }); }
    catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError('暂时无法保存或分享，请尝试在新窗口下载'); }
    finally { setSharing(false); }
  };
  return <Modal title={file.name} onClose={onClose} closeLabel="关闭文件" className="file-dialog">
    <p className="file-panel-meta">{fileSizeLabel(file.size)} · 关闭文件即可回到原页面</p>
    {!prepared && !error && <p role="status">正在准备文件…{progress > 0 ? ` ${progress}%` : ''}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {prepared?.file.type === 'application/pdf' && <PdfPreview bytes={prepared.bytes}/>}
    {prepared?.imageUrl && <div className="file-preview"><img src={prepared.imageUrl} alt={file.name}/></div>}
    {prepared?.file.type.startsWith('text/') && <div className="file-preview"><pre>{new TextDecoder().decode(prepared.bytes).slice(0, 100_000)}</pre>{prepared.bytes.length > 100_000 && <p className="muted">内容较长，可保存后查看完整文件。</p>}</div>}
    {prepared && prepared.file.type !== 'application/pdf' && !prepared.imageUrl && !prepared.file.type.startsWith('text/') && <p>可保存到“文件”或使用对应应用查看。</p>}
    <div className="file-panel-actions">{(canShare || (!prepared && !error && typeof navigator.share === 'function')) && <button type="button" className="primary-button" disabled={!prepared || sharing} onClick={() => void share()}>{!prepared ? '文件准备中…' : sharing ? '正在打开分享菜单…' : '保存或分享文件'}</button>}<a className="outline-button" href={file.url} target="_blank" rel="noopener noreferrer">在新窗口下载</a></div>
    <p className="muted">iPhone / iPad 可在分享菜单中选择“存储到文件”；下载或分享不会替换通知页面。</p>
  </Modal>;
}

export default function AttachmentCard({ file }: { file: Attachment }) {
  const [open, setOpen] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (!link.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting) && document.visibilityState === 'visible') { observer.disconnect(); prefetchAttachment(file); } });
    observer.observe(link.current); return () => observer.disconnect();
  }, [file.url, file.size]);
  return <><a ref={link} className="notice-attachment" href={file.url} target="_blank" rel="noopener noreferrer" onFocus={() => prefetchAttachment(file)} onClick={event => { if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) { event.preventDefault(); setOpen(true); } }}><FileDown size={20} aria-hidden="true"/><span><strong>{file.name}</strong><small>{fileSizeLabel(file.size)} · 点击查看或保存</small></span></a>{open && <FilePanel file={file} onClose={() => setOpen(false)}/>}</>;
}
