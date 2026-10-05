export interface AttachmentRef { id: string; position: number }
export interface Attachment extends AttachmentRef { name: string; size: number; url: string }
export const MAX_ATTACHMENTS = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export function validAttachmentRefs(value: unknown, bodyLength: number): value is AttachmentRef[] {
  if (!Array.isArray(value) || value.length > MAX_ATTACHMENTS) return false;
  const ids = new Set<string>();
  return value.every(file => {
    if (!file || typeof file !== 'object' || typeof file.id !== 'string' || !/^[\w-]{1,64}$/.test(file.id) || ids.has(file.id)) return false;
    ids.add(file.id);
    return Number.isInteger(file.position) && file.position >= 0 && file.position <= bodyLength;
  });
}
export const fileSizeLabel = (size: number) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
