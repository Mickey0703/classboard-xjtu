import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { MAX_ATTACHMENTS, MAX_FILE_SIZE, fileSizeLabel, type Attachment } from '../domain/attachments';

export default function FileUpload({ attachments, onChange, disabled, onBusy }: { attachments: Attachment[]; onChange: (files: Attachment[]) => void; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const add = async (files: File[]) => {
    setError('');
    if (!files.length) return;
    if (files.length + attachments.length > MAX_ATTACHMENTS) { setError('每条通知最多上传 5 个文件'); return; }
    if (files.some(file => !file.size || file.size > MAX_FILE_SIZE)) { setError('请选择非空文件，每个文件不能超过 10 MB'); return; }
    setUploading(true); onBusy(true);
    const next = [...attachments];
    try {
      for (const file of files) {
        const body = new FormData(); body.append('file', file);
        const response = await fetch('/api/admin/notification-files', { method: 'POST', credentials: 'same-origin', body });
        const result = await response.json() as Attachment & { error?: string };
        if (!response.ok) throw Error(result.error ?? '文件上传失败，请重试');
        next.push(result); onChange([...next]);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : '文件上传失败，请重试'); }
    finally { setUploading(false); onBusy(false); }
  };
  return <div className="file-upload">
    <button className="outline-button" type="button" disabled={disabled || uploading || attachments.length >= MAX_ATTACHMENTS} onClick={() => input.current?.click()}><Upload size={17} aria-hidden="true"/>{uploading ? '正在上传文件…' : '上传文件'}</button>
    <input hidden ref={input} type="file" multiple aria-label="上传文件" disabled={disabled || uploading || attachments.length >= MAX_ATTACHMENTS} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void add(files); }}/>
    <small className="muted">最多 5 个文件，每个不超过 10 MB。附件会与通知正文一起公开展示。</small>
    {attachments.length > 0 && <ul className="uploaded-files">{attachments.map(file => <li key={file.id}><span>{file.name}<small>{fileSizeLabel(file.size)}</small></span><button type="button" disabled={disabled || uploading} className="outline-button" aria-label={`删除文件 ${file.name}`} onClick={() => onChange(attachments.filter(item => item.id !== file.id))}><X size={16} aria-hidden="true"/></button></li>)}</ul>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
