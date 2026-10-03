import { MAX_PHOTO_LENGTH, type Photo } from '../domain/photos';

export async function readPhoto(file: File): Promise<Photo> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw Error('请选择 JPG、PNG 或 WebP 照片');
  if (file.size > 12 * 1024 * 1024) throw Error('原始照片不能超过 12 MB，请先缩小后重试');
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error('照片读取失败，请重新选择'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(Error('照片无法打开，请选择其他图片'));
    img.src = original;
  });
  const id = crypto.randomUUID();
  if (original.length <= MAX_PHOTO_LENGTH && Math.max(image.width, image.height) <= 1600) return { id, dataUrl: original };
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw Error('当前浏览器无法处理照片，请换一个浏览器重试');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.88, 0.75, 0.6, 0.45]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_PHOTO_LENGTH) return { id, dataUrl };
  }
  throw Error('照片压缩后仍然过大，请裁剪后重试');
}
