// Importação de fotos/vídeos (miniatura, EXIF, dimensões) e exportação com a data editada gravada no arquivo.
import { readExif, patchJpegDates, injectExif } from './exif.js';
import { db } from './db.js';
import { readMp4Date, patchMp4Dates } from './mp4.js';

const THUMB = 360;

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function extOf(name) { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; }

function formatOf(file) {
  const ext = extOf(file.name);
  const t = (file.type || '').toLowerCase();
  if (t.includes('heic') || t.includes('heif') || ext === 'heic' || ext === 'heif') return 'HEIF';
  if (t.includes('jpeg') || ext === 'jpg' || ext === 'jpeg') return 'JPEG';
  if (t.includes('png') || ext === 'png') return 'PNG';
  if (t.includes('webp') || ext === 'webp') return 'WEBP';
  if (t.includes('gif') || ext === 'gif') return 'GIF';
  if (t.includes('quicktime') || ext === 'mov') return 'MOV';
  if (t.includes('mp4') || ext === 'mp4' || ext === 'm4v') return 'MP4';
  if (t.startsWith('video/')) return (ext || 'VÍDEO').toUpperCase();
  return (ext || 'IMG').toUpperCase();
}

function isVideo(file) {
  return (file.type || '').startsWith('video/') || ['mov', 'mp4', 'm4v', 'webm'].includes(extOf(file.name));
}

function baseName(file, i) {
  let n = (file.name || '').replace(/\.[a-z0-9]+$/i, '');
  if (!n || /^image$/i.test(n) || /^[0-9a-f-]{20,}$/i.test(n)) n = `IMG_${String(Date.now() % 10000).padStart(4, '0')}${i}`;
  return n;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível abrir a imagem'));
    img.src = url;
  });
}

function squareThumb(source, sw, sh) {
  const c = document.createElement('canvas');
  c.width = c.height = THUMB;
  const g = c.getContext('2d');
  const s = Math.max(THUMB / sw, THUMB / sh);
  const w = sw * s, h = sh * s;
  g.fillStyle = '#1c1c1e';
  g.fillRect(0, 0, THUMB, THUMB);
  g.drawImage(source, (THUMB - w) / 2, (THUMB - h) / 2, w, h);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', 0.82));
}

async function videoInfo(file) {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise((res, rej) => {
      v.onloadeddata = res; v.onerror = () => rej(new Error('vídeo')); setTimeout(res, 4000);
      v.load();
    });
    const duration = isFinite(v.duration) ? v.duration : 0;
    try {
      v.currentTime = Math.min(0.1, duration / 2 || 0);
      await new Promise((res) => { v.onseeked = res; setTimeout(res, 1500); });
    } catch { /* ignore */ }
    const w = v.videoWidth || 1080, h = v.videoHeight || 1920;
    let thumb;
    try { thumb = await squareThumb(v, w, h); } catch { thumb = null; }
    return { duration, width: w, height: h, thumb };
  } finally { URL.revokeObjectURL(url); }
}

function placeholderThumb() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2c2c2e'; g.fillRect(0, 0, 64, 64);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.7));
}

/** Importa um arquivo e devolve o item já gravado no banco. */
export async function importFile(file, index = 0) {
  const now = Date.now();
  const video = isVideo(file);
  const item = {
    id: uid(), name: baseName(file, index), type: video ? 'video' : 'photo', mime: file.type || '',
    format: formatOf(file), size: file.size, added: now + index, fav: false, deleted: null,
    caption: '', keywords: [], location: '', camera: null, edited: false,
  };
  let thumb;
  if (video) {
    const info = await videoInfo(file);
    Object.assign(item, { width: info.width, height: info.height, duration: info.duration });
    thumb = info.thumb || await placeholderThumb();
    item.taken = (await readMp4Date(file)) || file.lastModified || now;
  } else {
    const buf = await file.arrayBuffer();
    const ex = readExif(buf);
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      item.width = img.naturalWidth; item.height = img.naturalHeight;
      thumb = await squareThumb(img, img.naturalWidth, img.naturalHeight);
    } finally { URL.revokeObjectURL(url); }
    item.taken = ex.date || file.lastModified || now;
    if (ex.make || ex.model || ex.iso || ex.fnumber) {
      item.camera = {
        make: ex.make || '', model: ex.model || '', lens: ex.lens || '', iso: ex.iso || 0,
        exposure: ex.exposure || 0, fnumber: ex.fnumber || 0, focal: ex.focal || 0, focal35: ex.focal35 || 0, ev: ex.ev || 0,
      };
    }
  }
  item.origTaken = item.taken;
  await db.addNew(item, thumb, file);
  return item;
}

function canvasToJpeg(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95));
}

/**
 * Gera o arquivo para compartilhar/salvar. Em fotos, a data editada vai gravada no EXIF
 * (é isso que o app Fotos do iOS usa como "data da foto" ao salvar a imagem).
 */
export async function exportItem(item) {
  const file = await db.getFile(item.id);
  if (!file) throw new Error('Arquivo não encontrado');
  if (item.type === 'video') {
    const ext = (/\.([a-z0-9]+)$/i.exec(file.name || '') || [])[1] || (file.type.includes('quicktime') ? 'mov' : 'mp4');
    const blob = await patchMp4Dates(file, item.taken);
    return new File([blob], `${item.name}.${ext}`, { type: file.type || 'video/mp4' });
  }
  const buf = await file.arrayBuffer();
  const isJpeg = new DataView(buf).getUint16(0) === 0xffd8;
  let out = isJpeg ? patchJpegDates(buf, item.taken) : null;
  if (!out) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const blob = await canvasToJpeg(img);
      const c = item.camera || {};
      out = injectExif(await blob.arrayBuffer(), {
        ms: item.taken, make: c.make, model: c.model, iso: c.iso, exposure: c.exposure,
        fnumber: c.fnumber, focal: c.focal, focal35: c.focal35,
      });
    } finally { URL.revokeObjectURL(url); }
  }
  return new File([out], `${item.name}.JPG`, { type: 'image/jpeg', lastModified: item.taken });
}
