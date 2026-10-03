import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import NotificationAdmin, { type NotificationAdminView } from './NotificationAdmin';
import { readPhoto } from '../api/photos';
import type { Photo } from '../domain/photos';

// Browser image decoding is unavailable in jsdom. Defer just that boundary;
// the uploader, file input, menu transitions and busy state use real components.
vi.mock('../api/photos', () => ({ readPhoto: vi.fn() }));

function Editor() {
  const [view, setView] = useState<NotificationAdminView>('compose');
  return <><button onClick={() => setView('records')}>通知记录</button><button onClick={() => setView('compose')}>通知</button><NotificationAdmin view={view} onViewChange={setView} onPublished={() => {}}/></>;
}

it('finishes photo processing after switching away from and back to composition', async () => {
  let finish!: (photo: Photo) => void;
  vi.mocked(readPhoto).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.endsWith('/members') ? [{ email: 'a@example.com', displayName: '甲', active: true }] : [] })));
  render(<Editor/>);
  await screen.findByText('已选 1 / 1 人');
  fireEvent.change(screen.getByLabelText('通知正文'), { target: { value: '照片正文' } });
  fireEvent.change(screen.getByLabelText('添加照片'), { target: { files: [new File(['photo'], 'photo.png', { type: 'image/png' })] } });
  expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: '通知记录' }));
  expect(screen.queryByRole('textbox', { name: '通知正文' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '通知' }));
  finish({ id: 'p1', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
  await waitFor(() => expect((screen.getByRole('button', { name: '保存草稿' }) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('img', { name: '已选照片 1' })).toBeTruthy();
  vi.unstubAllGlobals();
});
