import type { Snapshot } from '../domain/types';

export async function fetchSnapshot(): Promise<Snapshot> {
  const response = await fetch('/api/snapshot', { cache: 'no-store' });
  if (!response.ok) throw new Error('班务数据暂不可用');
  return response.json() as Promise<Snapshot>;
}

export async function saveAdmin(path: 'courses' | 'events' | 'semester', method: 'POST' | 'PUT' | 'DELETE', body: unknown): Promise<void> {
  const response = await fetch(`/api/admin/${path}`, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(result.error ?? '保存失败，请稍后重试');
  }
}
