import { useEffect, useMemo } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { api } from './api';
import { useLanguage } from './i18n';

export const MAX_PHOTOS = 10;

// Phone photos are 3-12 MB; hosts cap request bodies (Vercel: 4.5 MB). Re-encode as a
// 1600 px JPEG, typically 200-500 KB, which the server's JPEG validation accepts.
export async function shrinkImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
 try {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('encode');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
 } catch {
  return file; // Unsupported format: send as-is and let the server explain.
 }
}

export async function uploadPhotos(path: string, files: File[]) {
 const failed: string[] = [];
 for (const file of files) {
  const form = new FormData();
  form.append('file', await shrinkImage(file));
  try { await api(path, 'POST', form); } catch { failed.push(file.name); }
 }
 return failed;
}

export function PhotoPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
 const { t } = useLanguage();
 const previews = useMemo(() => files.map(f => URL.createObjectURL(f)), [files]);
 useEffect(() => () => previews.forEach(src => URL.revokeObjectURL?.(src)), [previews]);
 return <div className="field full photo-picker">
  <label htmlFor="work-photos">{t('Work photos')}</label>
  {files.length > 0 && <div className="photo-grid">{previews.map((src, i) => <figure key={src}>
   <img src={src} alt={files[i].name}/>
   <button type="button" aria-label={`${t('Remove')}: ${files[i].name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}><X size={14}/></button>
  </figure>)}</div>}
  {files.length < MAX_PHOTOS && <label className="upload-label photo-add"><ImagePlus size={17}/>{t('Add photos')}
   <input id="work-photos" type="file" accept="image/jpeg,image/png,image/*" multiple onChange={e => {
    const picked = Array.from(e.target.files || []).filter(f => f.type.startsWith('image/'));
    onChange([...files, ...picked].slice(0, MAX_PHOTOS)); e.target.value = '';
   }}/></label>}
  <small className="muted">{t('Photos are resized before upload. Up to 10 photos.')}</small>
 </div>;
}
