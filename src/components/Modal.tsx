import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ title, onClose, busy = false, children, closeLabel, className = '' }: { title: string; onClose: () => void; busy?: boolean; children: ReactNode; closeLabel?: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => { if (dialog.open && typeof dialog.close === 'function') dialog.close(); previous?.focus(); };
  }, []);
  return <dialog className={`photo-dialog ${className}`} ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="section-head"><h2>{title}</h2><button type="button" className="outline-button" disabled={busy} aria-label={closeLabel ?? '关闭窗口'} onClick={onClose}>{closeLabel ?? '关闭'}</button></div>{children}
  </dialog>;
}
