import { beforeEach, expect, it } from 'vitest';
import { campusPhotos, chooseCampusPhoto, rememberCampusPhoto } from './campusPhotos';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

it('shows Milan Building first and visits every photo before repeating', () => {
  const visited = campusPhotos.map(() => {
    const photo = chooseCampusPhoto();
    rememberCampusPhoto(photo.id);
    return photo.id;
  });

  expect(visited[0]).toBe('milan-building');
  expect(visited.length).toBeGreaterThanOrEqual(4);
  expect(new Set(visited).size).toBe(visited.length);
  expect(chooseCampusPhoto().id).toBe(visited[0]);
});

it('keeps the same choice until the photo is shown', () => {
  const first = chooseCampusPhoto();
  expect(chooseCampusPhoto()).toBe(first);
  rememberCampusPhoto(first.id);
  expect(chooseCampusPhoto().id).not.toBe(first.id);
});
