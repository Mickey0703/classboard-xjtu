import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import NotificationEditor, { type NotificationAdminView } from './NotificationAdmin';
import MembersAdmin from './MembersAdmin';

function NotificationAdmin({ onPublished, initialView = 'compose' }: { onPublished: () => Promise<void> | void; initialView?: NotificationAdminView }) {
  const [view, setView] = useState<NotificationAdminView>(initialView);
  return <><nav><button onClick={() => setView('compose')}>通知</button><button onClick={() => setView('records')}>通知记录</button></nav><NotificationEditor view={view} onViewChange={setView} onPublished={onPublished}/></>;
}

it('offers a proof requirement only for tasks, restores it for drafts and clears it when switching to a notice', async () => {
  const writes: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [{ email: 'a@example.com', displayName: '甲', active: true }] };
    if (init?.method === 'PUT') { writes.push(JSON.parse(String(init.body))); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => [{ id: 'required', kind: 'task', priority: 'normal', title: '须交截图', body: '提交', requiresCompletionProof: true, due_at: '2026-10-05T18:00:00+08:00', pinned: 0, status: 'draft' }] };
  }));
  render(<NotificationAdmin onPublished={() => {}} />);
  expect(screen.queryByRole('checkbox', { name: '须提交完成凭据' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '通知记录' }));
  fireEvent.click(await screen.findByRole('button', { name: '编辑' }));
  expect((screen.getByRole('checkbox', { name: '须提交完成凭据' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await screen.findByText('草稿已保存');
  expect(writes[0]).toMatchObject({ kind: 'task', requiresCompletionProof: true });
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  fireEvent.change(screen.getByLabelText('类型'), { target: { value: 'notice' } });
  expect(screen.queryByRole('checkbox', { name: '须提交完成凭据' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await waitFor(() => expect(writes).toHaveLength(2));
  expect(writes[1]).toMatchObject({ kind: 'notice', requiresCompletionProof: false, dueAt: null });
  vi.unstubAllGlobals();
});

it('restores draft photos in the body preview and allows removing them before saving', async () => {
  const photo = { id: 'p1', position: 2, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
  const writes: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [{ email: 'a@example.com', displayName: '甲', active: true }] };
    if (init?.method === 'PUT') { writes.push(JSON.parse(String(init.body))); return { ok: true, json: async () => ({}) }; }
    return { ok: true, json: async () => [{ id: 'n1', kind: 'notice', priority: 'normal', title: '图文通知', body: '前文后文', photos: [photo], due_at: null, pinned: 0, status: 'draft' }] };
  }));
  render(<NotificationAdmin onPublished={() => {}} initialView="records"/>);
  fireEvent.click(await screen.findByRole('button', { name: '编辑' }));
  expect(screen.getByRole('img', { name: '通知照片 1' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '删除照片 1' }));
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await screen.findByText('草稿已保存');
  expect(writes[0]).toMatchObject({ id: 'n1', body: '前文后文', photos: [] });
  vi.unstubAllGlobals();
});

it('lets a committee member save a draft, publish it, and view receipt counts', async () => {
  let row: Record<string, unknown> | null = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [{ email: 'a@example.com', displayName: '甲', active: true }, { email: 'b@example.com', displayName: '乙', active: true }] };
    if (url.includes('notification-stats')) return { ok: true, json: async () => ({ total: 2, acknowledged: 1, completed: 0, notAcknowledged: [{ email: 'b@stu.xjtu.edu.cn', displayName: '同学 B' }], notCompleted: [] }) };
    if (url.endsWith('/notifications') && (!init?.method || init.method === 'GET')) return { ok: true, json: async () => row ? [row] : [] };
    if (init?.method === 'POST') { row = { id: 'n1', kind: 'notice', priority: 'urgent', title: '班级会议', body: '明天开会', due_at: null, pinned: 1, status: 'draft' }; return { ok: true, json: async () => ({ id: 'n1' }) }; }
    if (init?.method === 'PATCH') { row = { ...row, status: 'published' }; return { ok: true, json: async () => ({ status: 'published' }) }; }
    throw Error('unexpected request');
  }));
  render(<NotificationAdmin onPublished={vi.fn()} />);
  await screen.findByText('已选 2 / 2 人');
  fireEvent.change(screen.getByLabelText('通知标题'), { target: { value: '班级会议' } });
  fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '明天开会' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await screen.findByRole('button', { name: '发布通知' });
  fireEvent.click(screen.getByRole('button', { name: '发布通知' }));
  await waitFor(() => expect(screen.getByText(/已知悉 1\/2/)).toBeTruthy());
  expect(screen.queryByText(/已完成 0\/2/)).toBeNull();
  vi.unstubAllGlobals();
});

it('lets committee members add and deactivate roster entries', async () => {
  let members: { email: string; displayName: string; active: boolean }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (!init?.method || init.method === 'GET') return { ok: true, json: async () => members };
    const body = JSON.parse(String(init.body));
    if (init.method === 'POST') members = [{ email: body.email.toLowerCase(), displayName: body.displayName, active: true }];
    if (init.method === 'DELETE') members = members.map(m => ({ ...m, active: false }));
    return { ok: true, json: async () => ({}) };
  }));
  render(<MembersAdmin />);
  fireEvent.change(screen.getByLabelText('同学姓名'), { target: { value: '同学甲' } });
  fireEvent.change(screen.getByLabelText('邮箱地址'), { target: { value: 'a@stu.xjtu.edu.cn' } });
  fireEvent.click(screen.getByRole('button', { name: '添加成员' }));
  await screen.findByText('a@stu.xjtu.edu.cn');
  fireEvent.click(screen.getByRole('button', { name: '停用成员' }));
  await screen.findByText('已停用');
  vi.unstubAllGlobals();
});

it('previews a pasted roster and imports it in a single request', async () => {
  let members: { displayName: string; email: string; active: boolean }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      members = body.members.map((m: { displayName: string; email: string }) => ({ ...m, active: true }));
    }
    return { ok: true, json: async () => members };
  }));
  render(<MembersAdmin />);
  fireEvent.change(screen.getByLabelText('批量名单'), { target: { value: '姓名,邮箱\n张三,a@example.com\n李四,b@example.com' } });
  expect(screen.getByText('待导入 2 人')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '导入名单' }));
  await screen.findByText('已导入 2 位成员');
  expect(screen.getByText('张三')).toBeTruthy();
  expect(screen.getByText('李四')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('reports a published notice separately from a failed homepage refresh', async () => {
  let row: Record<string, unknown> | null = { id: 'n2', kind: 'notice', priority: 'normal', title: '已准备通知', body: '内容', due_at: null, pinned: 0, status: 'draft' };
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (_url.endsWith('/members')) return { ok: true, json: async () => [{ email: 'a@example.com', displayName: '甲', active: true }] };
    if (init?.method === 'PATCH') { row = { ...row, status: 'published' }; return { ok: true, json: async () => ({ id: 'n2', status: 'published' }) }; }
    return { ok: true, json: async () => [row] };
  }));
  render(<NotificationAdmin onPublished={vi.fn(async () => { throw Error('offline'); })} initialView="records"/>);
  fireEvent.click(await screen.findByRole('button', { name: '发布通知' }));
  expect(await screen.findByText(/已发布，但首页刷新失败/)).toBeTruthy();
  vi.unstubAllGlobals();
});

it('saves individual recipients, selects all active members, and restores the draft selection', async () => {
  const requests: Record<string, unknown>[] = [];
  let row: Record<string, unknown> | null = null;
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [
      { email: 'a@example.com', displayName: '甲', active: true },
      { email: 'b@example.com', displayName: '乙', active: true },
      { email: 'c@example.com', displayName: '停用同学', active: false }
    ] };
    if (init?.method === 'POST') {
      const body = JSON.parse(String(init.body)); requests.push(body);
      row = { ...body, id: 'selected', status: 'draft', due_at: null };
      return { ok: true, json: async () => ({ id: 'selected', status: 'draft' }) };
    }
    return { ok: true, json: async () => row ? [row] : [] };
  }));
  render(<NotificationAdmin onPublished={() => {}} />);
  await screen.findByText('已选 2 / 2 人');
  fireEvent.click(screen.getByText(/选择收件人/));
  expect(screen.queryByLabelText(/停用同学/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '清空' }));
  fireEvent.click(screen.getByLabelText(/甲.*a@example.com/));
  fireEvent.change(screen.getByLabelText('通知标题'), { target: { value: '选择测试' } });
  fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '内容' } });
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await screen.findByRole('button', { name: '编辑' });
  expect(requests[0].recipientEmails).toEqual(['a@example.com']);
  fireEvent.click(screen.getByRole('button', { name: '编辑' }));
  expect(screen.getByText('已选 1 / 2 人')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '全选' }));
  expect(screen.getByText('已选 2 / 2 人')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('refreshes the shared public snapshot after withdrawal', async () => {
  let row: Record<string, unknown> = { id: 'n3', kind: 'notice', priority: 'urgent', title: '撤回测试', body: '内容', due_at: null, pinned: 1, status: 'published' };
  const onChanged = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') { row = { ...row, status: 'withdrawn' }; return { ok: true, json: async () => ({ id: 'n3', status: 'withdrawn' }) }; }
    return { ok: true, json: async () => [row] };
  }));
  render(<NotificationAdmin onPublished={onChanged} initialView="records"/>);
  fireEvent.click(await screen.findByRole('button', { name: '撤回' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  vi.unstubAllGlobals();
});
