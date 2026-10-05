export interface Photo { id: string; dataUrl: string; position?: number }
export const MAX_PHOTOS = 3;
export const MAX_PHOTO_LENGTH = 400_000;

export function validPhotos(value: unknown, bodyLength?: number): value is Photo[] {
  if (!Array.isArray(value) || value.length > MAX_PHOTOS) return false;
  const ids = new Set<string>();
  return value.every(photo => {
    if (!photo || typeof photo !== 'object' || typeof photo.id !== 'string' || !/^[\w-]{1,64}$/.test(photo.id) || ids.has(photo.id)) return false;
    if (Object.keys(photo).some(key => !['id', 'dataUrl', 'position'].includes(key))) return false;
    ids.add(photo.id);
    if (photo.position !== undefined && (!Number.isInteger(photo.position) || photo.position < 0 || photo.position > 5000)) return false;
    if (bodyLength !== undefined && (!Number.isInteger(photo.position) || photo.position < 0 || photo.position > bodyLength)) return false;
    if (typeof photo.dataUrl !== 'string' || photo.dataUrl.length > MAX_PHOTO_LENGTH) return false;
    const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo.dataUrl);
    if (!match || match[2].length % 4 !== 0) return false;
    try {
      const header = atob(match[2].slice(0, 32));
      return match[1] === 'png' ? header.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'jpeg' ? header.startsWith('\xff\xd8\xff') : header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP';
    } catch { return false; }
  });
}

// Keep insertion points attached to the surrounding text while editing.
export function movePhotoPositions<T extends { position?: number }>(photos: T[], before: string, after: string): T[] {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let tail = 0;
  while (tail < before.length - start && tail < after.length - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  const end = before.length - tail;
  const newEnd = after.length - tail;
  return photos.map(photo => ({ ...photo, position: (photo.position ?? before.length) < start ? photo.position : (photo.position ?? before.length) >= end ? Math.max(0, (photo.position ?? before.length) + after.length - before.length) : newEnd }));
}
