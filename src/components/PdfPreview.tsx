import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFWorker, RenderTask } from 'pdfjs-dist';
import '../pdf-compat';

export default function PdfPreview({ bytes }: { bytes: Uint8Array }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [rendering, setRendering] = useState(true);
  const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    let loading: PDFDocumentLoadingTask | undefined;
    let worker: Worker | undefined;
    let pdfWorker: PDFWorker | undefined;
    void (async () => {
      try {
        const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs');
        if (!active) return;
        worker = new Worker(new URL('../pdf.worker.ts', import.meta.url), { type: 'module' });
        pdfWorker = pdf.PDFWorker.create({ port: worker });
        loading = pdf.getDocument({ data: bytes.slice(), worker: pdfWorker });
        const result = await loading.promise;
        if (active) setDocument(result);
      } catch { if (active) { setError('此 PDF 暂时无法预览，可保存后用对应应用查看。'); setRendering(false); } }
    })();
    return () => {
      active = false;
      const finish = () => { pdfWorker?.destroy(); worker?.terminate(); };
      if (!loading) { finish(); return; }
      // PDF.js must receive its teardown acknowledgement before the port closes.
      void loading.destroy().catch(() => {}).finally(finish);
    };
  }, [bytes]);
  useEffect(() => {
    if (!document) return;
    let active = true;
    let task: RenderTask | undefined;
    setRendering(true); setError('');
    void (async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (!active || !canvas.current || !viewport.current) return;
        const width = Math.max(200, viewport.current.clientWidth - 16);
        const view = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(view.width, view.height));
        canvas.current.width = Math.max(1, Math.floor(view.width * ratio)); canvas.current.height = Math.max(1, Math.floor(view.height * ratio));
        canvas.current.style.width = `${view.width}px`; canvas.current.style.height = `${view.height}px`;
        task = page.render({ canvas: canvas.current, viewport: view, transform: [ratio, 0, 0, ratio, 0, 0] });
        await task.promise;
      } catch { if (active) setError('此页暂时无法预览，可保存后查看。'); }
      finally { if (active) setRendering(false); }
    })();
    return () => { active = false; task?.cancel(); };
  }, [document, pageNumber, zoom]);
  return <div className="pdf-preview">
    {error && <p className="form-error" role="alert">{error}</p>}
    {rendering && <p role="status">正在加载 PDF…</p>}
    <div className="file-preview pdf-canvas-container" ref={viewport}><canvas ref={canvas} role="img" aria-label={`PDF 第 ${pageNumber} 页`}/></div>
    {document && <div className="pdf-controls"><button className="outline-button" type="button" disabled={rendering || pageNumber <= 1} onClick={() => setPageNumber(pageNumber - 1)}>上一页</button><span>第 {pageNumber} / {document.numPages} 页</span><button className="outline-button" type="button" disabled={rendering || pageNumber >= document.numPages} onClick={() => setPageNumber(pageNumber + 1)}>下一页</button><label>缩放<select aria-label="PDF 缩放" value={zoom} disabled={rendering} onChange={event => setZoom(Number(event.target.value))}><option value={1}>适合宽度</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label></div>}
  </div>;
}
