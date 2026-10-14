import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import NotificationEditor, { type NotificationAdminView } from './NotificationAdmin';
import MembersAdmin from './MembersAdmin';

function NotificationAdmin({ onPublished, initialView = 'compose' }: { onPublished: () => Promise<void> | void; initialView?: NotificationAdminView }) {
  const [view, setView] = useState<NotificationAdminView>(initialView);
  return <><nav><button onClick={() => setView('compose')}>通知</button><button onClick={() => setView('records')}>通知记录</button></nav><NotificationEditor view={view} onViewChange={setView} onPublished={onPublished}/></>;
}

it('filters records and confirms only the selected expired records for deletion', async () => {
  let rows = [
    { id: 'active', title: '进行中的公告', kind: 'notice', status: 'published', due_at: null },
    { id: 'old', title: '过期待办', kind: 'task', status: 'published', due_at: '2000-01-01T00:00:00+08:00' },
    { id: 'gone', title: '撤回公告', kind: 'notice', status: 'withdrawn', due_at: null }
  ];
  const deletes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [] };
    if (init?.method === 'DELETE') { const body = JSON.parse(String(init.body)); deletes.push(body); rows = rows.filter(row => !body.ids.includes(row.id)); return { ok: true, json: async () => ({ deleted: body.ids.length }) }; }
    return { ok: true, json: async () => rows.map(row => ({ ...row, priority: 'normal', body: '', pinned: 0 })) };
  }));
  render(<NotificationAdmin onPublished={() => {}} initialView="records"/>);
  await screen.findByText('进行中的公告');
  fireEvent.click(screen.getByRole('button', { name: /已逾期/ }));
  expect(screen.queryByText('进行中的公告')).toBeNull();
  expect(screen.getByText('过期待办')).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: '选择过期待办' }));
  fireEvent.click(screen.getByRole('button', { name: /删除所选/ }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '取消' }));
  expect(deletes).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: '删除所有已逾期通知' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认删除' }));
  await screen.findByText('已删除 1 条通知');
  expect(deletes).toEqual([{ ids: ['old'], category: 'expired' }]);
  fireEvent.click(screen.getByRole('button', { name: /正在进行/ }));
  expect(screen.getByText('进行中的公告')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /全部删除/ })).toBeNull();
  vi.unstubAllGlobals();
});

it('restores a withdrawn notification into the same draft editor after confirmation', async () => {
  let restored = false;
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [{ email: 'a@example.com', displayName: '甲', active: true }] };
    if (init?.method === 'PATCH') { writes.push(JSON.parse(String(init.body))); restored = true; return { ok: true, json: async () => ({ id: 'original', status: 'draft' }) }; }
    return { ok: true, json: async () => [{ id: 'original', title: '原通知', kind: 'notice', priority: 'normal', status: restored ? 'draft' : 'withdrawn', body: restored ? '保留的正文' : '', pinned: 0, due_at: null, recipientEmails: ['a@example.com'] }] };
  }));
  render(<NotificationAdmin onPublished={() => {}} initialView="records"/>);
  fireEvent.click(await screen.findByRole('button', { name: '重新编辑' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '恢复并编辑' }));
  await screen.findByRole('heading', { name: '编辑通知草稿' });
  expect((screen.getByLabelText('通知正文') as HTMLTextAreaElement).value).toBe('保留的正文');
  expect(writes).toEqual([{ id: 'original', action: 'restore' }]);
  vi.unstubAllGlobals();
});

it('shows statistics and completion photos beneath the selected record and moves them when switching notices', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.endsWith('/members')) return { ok: true, json: async () => [] };
    if (url.includes('notification-stats')) return { ok: true, json: async () => ({ total: 1, acknowledged: 1, completed: 1, notAcknowledged: [], notCompleted: [], completedRecipients: [{ email: 'a@example.com', displayName: '同学甲', completedAt: '2026-10-05T10:00:00+08:00', photos: [] }] }) };
    return { ok: true, json: async () => ['第一条', '第二条', '第三条'].map((title, index) => ({ id: `n${index}`, kind: index === 0 ? 'task' : 'notice', priority: 'normal', title, body: '内容', status: 'published', pinned: 0, due_at: null })) };
  }));
  render(<NotificationAdmin onPublished={() => {}} initialView="records"/>);
  const first = (await screen.findByText('第一条')).closest('article')!;
  const second = screen.getByText('第二条').closest('article')!;
  fireEvent.click(within(first).getByRole('button', { name: '查看统计' }));
  expect(await within(first).findByRole('heading', { name: '传达统计' })).toBeTruthy();
  expect(within(first).getByRole('heading', { name: '已完成同学与照片' })).toBeTruthy();
  expect(within(second).queryByRole('heading', { name: '传达统计' })).toBeNull();
  fireEvent.click(within(second).getByRole('button', { name: '查看统计' }));
  expect(await within(second).findByRole('heading', { name: '传达统计' })).toBeTruthy();
  expect(within(first).queryByRole('heading', { name: '传达统计' })).toBeNull();
  expect(screen.queryByRole('heading', { name: '已完成同学与照片' })).toBeNull();
  vi.unstubAllGlobals();
});

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
  fireEvent.click(await screen.findByRole('button', { name: '编辑草稿' }));
  expect((screen.getByRole('checkbox', { name: '须提交完成凭据' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '保存草稿' }));
  await screen.findByText('草稿已保存');
  expect(writes[0]).toMatchObject({ kind: 'task', requiresCompletionProof: true });
  fireEvent.click(screen.getByRole('button', { name: '编辑草稿' }));
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
  fireEvent.click(await screen.findByRole('button', { name: '编辑草稿' }));
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
  await screen.findByRole('button', { name: '编辑草稿' });
  expect(requests[0].recipientEmails).toEqual(['a@example.com']);
  fireEvent.click(screen.getByRole('button', { name: '编辑草稿' }));
  expect(screen.getByText('已选 1 / 2 人')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '全选' }));
  expect(screen.getByText('已选 2 / 2 人')).toBeTruthy();
  vi.unstubAllGlobals();
});

it('refreshes the shared public snapshot after withdrawal', async () => {
  let row: Record<string, unknown> = { id: 'n3', kind: 'notice', priority: 'urgent', title: '撤回测试', body: '内容', due_at: null, pinned: 1, status: 'published' };
  const onChanged = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') { row = { ...row, status: 'draft' }; return { ok: true, json: async () => ({ id: 'n3', status: 'draft' }) }; }
    return { ok: true, json: async () => [row] };
  }));
  render(<NotificationAdmin onPublished={onChanged} initialView="records"/>);
  fireEvent.click(await screen.findByRole('button', { name: '撤回并编辑' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '确认撤回并编辑' }));
  await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  vi.unstubAllGlobals();
});
