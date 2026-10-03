import { expect, it } from 'vitest';
import { validNotification } from '../../functions/api/admin/notification-helpers';
import { movePhotoPositions } from './photos';

const draft = { kind: 'notice', priority: 'normal', title: '通知', body: '前文后文', dueAt: null, pinned: false };
const photo = { id: 'p1', position: 2, dataUrl: 'data:image/png;base64,iVBORw0KGgo=' };
it('validates inline photo positions, count, unique identifiers and real image signatures', () => {
  expect(validNotification({ ...draft, photos: [photo] })).toBe(true);
  for (const photos of [[{ ...photo, position: 99 }], [photo, photo], [photo, { ...photo, id: 'p2' }, { ...photo, id: 'p3' }, { ...photo, id: 'p4' }], [{ ...photo, dataUrl: 'data:image/png;base64,YmFk' }]]) {
    expect(validNotification({ ...draft, photos })).toBe(false);
  }
});

it('rejects unbounded extra metadata on photos', () => {
  expect(validNotification({ ...draft, photos: [{ ...photo, metadata: 'unbounded' }] })).toBe(false);
});

it('keeps photos anchored when text is inserted, removed or replaced around them', () => {
  for (const [before, after, position, expected] of [
    ['前文后文', '新前文后文', 2, 3],
    ['前文后文', '前文', 2, 2],
    ['前文后文', '前段后文', 2, 2],
    ['前文后文', '前文后文追加', 1, 1],
    ['前文后文', '', 2, 0]
  ] as const) {
    expect(movePhotoPositions([{ ...photo, position }], before, after)[0].position).toBe(expected);
  }
});
