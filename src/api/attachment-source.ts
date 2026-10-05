import { MAX_FILE_SIZE, type Attachment } from '../domain/attachments';

type Progress = (loaded: number, total: number) => void;
interface LoadedFile { bytes: Uint8Array<ArrayBuffer>; etag: string | null }
interface Download { promise: Promise<LoadedFile>; signal?: AbortSignal; loaded: number; total: number; listeners: Set<Progress> }
const memory = new Map<string, LoadedFile & { at: number }>();
const pending = new Map<string, Download>();
const MAX_MEMORY = 16 * 1024 * 1024;
const TTL = 2 * 60_000;
let prefetched = 0;
const isPublic = (file: Attachment) => file.url.startsWith('/api/notification-file?');

async function assertResponse(response: Response) {
  if (response.ok || response.status === 304) return;
  const result = await response.json().catch(() => ({})) as { error?: string };
  throw Error(result.error ?? '文件暂时无法读取，请稍后重试');
}
function remember(file: Attachment, data: LoadedFile) {
  if (!data.etag || data.bytes.length !== file.size) return;
  memory.delete(file.url); memory.set(file.url, { ...data, at: Date.now() });
  for (const [key, value] of memory) if (Date.now() - value.at > TTL) memory.delete(key);
  while (memory.size > 20 || Array.from(memory.values()).reduce((sum, value) => sum + value.bytes.length, 0) > MAX_MEMORY) memory.delete(memory.keys().next().value!);
}
async function download(file: Attachment, signal?: AbortSignal, progress?: Progress): Promise<LoadedFile> {
  const response = await fetch(file.url, { credentials: 'same-origin', cache: 'no-store', signal });
  await assertResponse(response);
  const reader = response.body?.getReader();
  if (!reader) return { bytes: new Uint8Array(await response.arrayBuffer()), etag: response.headers.get('ETag') };
  const parts: Uint8Array[] = []; let length = 0;
  const total = Number(response.headers.get('Content-Length')) || file.size;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.length;
      if (length > MAX_FILE_SIZE) { await reader.cancel(); throw Error('文件超过大小限制'); }
      parts.push(value); progress?.(length, total);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return { bytes, etag: response.headers.get('ETag') };
}
function start(file: Attachment, signal?: AbortSignal): Download {
  const job: Download = { promise: null as unknown as Promise<LoadedFile>, signal, loaded: 0, total: file.size, listeners: new Set() };
  job.promise = download(file, signal, (loaded, total) => { job.loaded = loaded; job.total = total; job.listeners.forEach(listener => listener(loaded, total)); })
    .then(data => { remember(file, data); return data; })
    .finally(() => { if (pending.get(file.url) === job) pending.delete(file.url); });
  pending.set(file.url, job); return job;
}

export function prefetchAttachment(file: Attachment) {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (!isPublic(file) || file.size > 1024 * 1024 || prefetched + file.size > 2 * 1024 * 1024 || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? '') || memory.has(file.url) || pending.has(file.url)) return;
  prefetched += file.size;
  void start(file).promise.catch(() => {});
}

export async function loadAttachmentBytes(file: Attachment, signal: AbortSignal, progress: Progress): Promise<Uint8Array<ArrayBuffer>> {
  // Private drafts are never shared through this memory cache.
  if (!isPublic(file)) return (await download(file, signal, progress)).bytes;
  let cached = memory.get(file.url);
  if (cached && (Date.now() - cached.at > TTL || cached.bytes.length !== file.size)) { memory.delete(file.url); cached = undefined; }
  let job = pending.get(file.url);
  if (job?.signal?.aborted) { pending.delete(file.url); job = undefined; }
  if (cached || job) {
    // Revalidate live publication even if all bytes are already prepared.
    const validation = fetch(file.url, { method: 'HEAD', credentials: 'same-origin', cache: 'no-store', signal, headers: cached?.etag ? { 'If-None-Match': cached.etag } : undefined }).then(async response => { await assertResponse(response); return response; });
    const unsubscribe = () => { if (job) job.listeners.delete(progress); };
    job?.listeners.add(progress); if (job) progress(job.loaded, job.total);
    signal.addEventListener('abort', unsubscribe, { once: true });
    try {
      const [response, data] = await Promise.all([validation, cached ? Promise.resolve(cached) : job!.promise]);
      await assertResponse(response);
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (response.status === 304 || response.headers.get('ETag') === data.etag) { remember(file, data); progress(data.bytes.length, data.bytes.length); return data.bytes; }
      memory.delete(file.url);
    } catch (cause) { memory.delete(file.url); throw cause; }
    finally { unsubscribe(); signal.removeEventListener('abort', unsubscribe); }
  }
  job = start(file, signal); job.listeners.add(progress);
  try { const data = await job.promise; progress(data.bytes.length, data.bytes.length); return data.bytes; }
  finally { job.listeners.delete(progress); }
}
