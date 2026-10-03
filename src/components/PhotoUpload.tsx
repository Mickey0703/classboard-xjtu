import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { readPhoto } from '../api/photos';
import { MAX_PHOTOS, type Photo } from '../domain/photos';

export default function PhotoUpload({ photos, onChange, label = '添加照片', disabled = false, onBusy }: { photos: Photo[]; onChange: (photos: Photo[]) => void; label?: string; disabled?: boolean; onBusy?: (busy: boolean) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const add = async (files: File[]) => {
    setError('');
    if (!files.length) return;
    if (files.length + photos.length > MAX_PHOTOS) { setError('每次最多添加 3 张照片，请减少选择数量'); return; }
    setLoading(true); onBusy?.(true);
    try {
      const added = await Promise.all(files.map(readPhoto));
      if (mounted.current) onChange([...photos, ...added]);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '照片读取失败'); }
    finally { if (mounted.current) { setLoading(false); onBusy?.(false); } }
  };
  return <div className="photo-upload">
    <button type="button" className="outline-button" disabled={disabled || loading || photos.length >= MAX_PHOTOS} onClick={() => input.current?.click()}><ImagePlus size={17}/>{loading ? '正在处理照片…' : label}</button>
    <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" multiple aria-label={label} disabled={disabled || loading || photos.length >= MAX_PHOTOS} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void add(files); }}/>
    <small className="muted">最多 3 张，支持 JPG、PNG、WebP；原图不超过 12 MB，将自动压缩。</small>
    {photos.length > 0 && <div className="photo-thumbnails">{photos.map((photo, index) => <div className="photo-thumbnail" key={photo.id}><img src={photo.dataUrl} alt={`已选照片 ${index + 1}`}/><button type="button" className="photo-remove" disabled={disabled || loading} aria-label={`删除照片 ${index + 1}`} onClick={() => { setError(''); onChange(photos.filter(p => p.id !== photo.id)); }}><X size={17}/></button></div>)}</div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
