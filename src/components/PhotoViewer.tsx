import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Photo } from '../domain/photos';
import { FileDown } from 'lucide-react';
import { fileSizeLabel, type Attachment } from '../domain/attachments';

export function Modal({ title, onClose, busy = false, children }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => { if (dialog.open && typeof dialog.close === 'function') dialog.close(); previous?.focus(); };
  }, []);
  return <dialog className="photo-dialog" ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="section-head"><h2>{title}</h2><button type="button" className="outline-button" disabled={busy} aria-label="关闭窗口" onClick={onClose}>关闭</button></div>{children}
  </dialog>;
}

export function PhotoButton({ photo, label }: { photo: Photo; label: string }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="photo-open" aria-label={`放大${label}`} onClick={() => setOpen(true)}><img src={photo.dataUrl} alt={label} loading="lazy"/></button>{open && <Modal title={label} onClose={() => setOpen(false)}><img className="photo-full" src={photo.dataUrl} alt={`${label}原图`}/></Modal>}</>;
}

export function PhotoGallery({ photos, label = '完成照片' }: { photos: Photo[]; label?: string }) {
  return <div className="photo-gallery">{photos.map((photo, index) => <PhotoButton key={photo.id} photo={photo} label={`${label} ${index + 1}`}/>)}</div>;
}

export function NotificationBody({ body, photos = [], attachments = [] }: { body: string; photos?: Photo[]; attachments?: Attachment[] }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  const inserts = [...photos.map((photo, index) => ({ key: `photo-${photo.id}`, position: photo.position ?? body.length, node: <PhotoButton photo={photo} label={`通知照片 ${index + 1}`}/> })), ...attachments.map(file => ({ key: `file-${file.id}`, position: file.position, node: <a className="notice-attachment" href={file.url} download={file.name}><FileDown size={20} aria-hidden="true"/><span><strong>{file.name}</strong><small>{fileSizeLabel(file.size)} · 点击下载</small></span></a> }))];
  inserts.sort((a, b) => a.position - b.position).forEach(insert => {
    const position = Math.max(cursor, Math.min(body.length, insert.position));
    parts.push(<span key={`${insert.key}-text`}>{body.slice(cursor, position)}</span>, <Fragment key={insert.key}>{insert.node}</Fragment>);
    cursor = position;
  });
  parts.push(<span key="end">{body.slice(cursor)}</span>);
  return <div className="notice-body">{parts}</div>;
}
