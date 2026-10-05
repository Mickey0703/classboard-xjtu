import { Fragment, useState, type ReactNode } from 'react';
import type { Photo } from '../domain/photos';
import type { Attachment } from '../domain/attachments';
import AttachmentCard from './AttachmentCard';
import { Modal } from './Modal';
export { Modal } from './Modal';

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
  const inserts = [...photos.map((photo, index) => ({ key: `photo-${photo.id}`, position: photo.position ?? body.length, node: <PhotoButton photo={photo} label={`通知照片 ${index + 1}`}/> })), ...attachments.map(file => ({ key: `file-${file.id}`, position: file.position, node: <AttachmentCard file={file}/> }))];
  inserts.sort((a, b) => a.position - b.position).forEach(insert => {
    const position = Math.max(cursor, Math.min(body.length, insert.position));
    parts.push(<span key={`${insert.key}-text`}>{body.slice(cursor, position)}</span>, <Fragment key={insert.key}>{insert.node}</Fragment>);
    cursor = position;
  });
  parts.push(<span key="end">{body.slice(cursor)}</span>);
  return <div className="notice-body">{parts}</div>;
}
