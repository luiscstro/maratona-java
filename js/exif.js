// Leitura e escrita mínima de EXIF (JPEG e HEIC) sem dependências.
// Leitura: data, câmera, lente, ISO, abertura, exposição, distância focal.
// Escrita: troca DateTime / DateTimeOriginal / DateTimeDigitized (e OffsetTime*) em JPEG,
//          ou cria um bloco EXIF novo quando o arquivo não tem.

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };

const pad = (n, l = 2) => String(n).padStart(l, '0');

export function exifDateString(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function exifOffsetString(ms) {
  const off = -new Date(ms).getTimezoneOffset();
  const sign = off < 0 ? '-' : '+';
  const a = Math.abs(off);
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/* ------------------------------------------------------------------ localizar EXIF */

function findJpegTiffBase(dv) {
  if (dv.byteLength < 4 || dv.getUint16(0) !== 0xffd8) return -1;
  let off = 2;
  while (off + 4 <= dv.byteLength) {
    if (dv.getUint8(off) !== 0xff) return -1;
    const marker = dv.getUint8(off + 1);
    if (marker === 0xd9 || marker === 0xda) return -1;
    const len = dv.getUint16(off + 2);
    if (marker === 0xe1 && off + 10 <= dv.byteLength &&
        dv.getUint32(off + 4) === 0x45786966 && dv.getUint16(off + 8) === 0) {
      return off + 10;
    }
    off += 2 + len;
  }
  return -1;
}

// HEIC/HEIF: procura "Exif\0\0" seguido do cabeçalho TIFF.
function findHeicTiffBase(u8) {
  const n = u8.length;
  for (let i = 0; i < n - 12; i++) {
    if (u8[i] === 0x45 && u8[i + 1] === 0x78 && u8[i + 2] === 0x69 && u8[i + 3] === 0x66 &&
        u8[i + 4] === 0 && u8[i + 5] === 0) {
      const a = u8[i + 6], b = u8[i + 7];
      if ((a === 0x4d && b === 0x4d && u8[i + 9] === 0x2a) || (a === 0x49 && b === 0x49 && u8[i + 8] === 0x2a)) {
        return i + 6;
      }
    }
  }
  return -1;
}

function findTiffBase(buf) {
  const dv = new DataView(buf);
  let base = findJpegTiffBase(dv);
  if (base >= 0) return base;
  const u8 = new Uint8Array(buf);
  // só tenta HEIC se tiver "ftyp"
  if (u8.length > 12 && u8[4] === 0x66 && u8[5] === 0x74 && u8[6] === 0x79 && u8[7] === 0x70) {
    base = findHeicTiffBase(u8);
  }
  return base;
}

/* ------------------------------------------------------------------ parser TIFF */

function parseTiff(buf, base) {
  const dv = new DataView(buf);
  const little = dv.getUint16(base) === 0x4949;
  if (dv.getUint16(base + 2, little) !== 42) return null;
  const u16 = (o) => dv.getUint16(o, little);
  const u32 = (o) => dv.getUint32(o, little);

  const readIFD = (off) => {
    const tags = {};
    const start = base + off;
    if (start + 2 > dv.byteLength) return tags;
    const n = u16(start);
    for (let i = 0; i < n; i++) {
      const e = start + 2 + i * 12;
      if (e + 12 > dv.byteLength) break;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
      const size = (TYPE_SIZE[type] || 1) * count;
      const valOff = size <= 4 ? e + 8 : base + u32(e + 8);
      if (valOff + size > dv.byteLength) continue;
      tags[tag] = { type, count, valOff, size };
    }
    return tags;
  };

  const value = (t) => {
    if (!t) return undefined;
    const out = [];
    const cnt = Math.min(t.count, 16);
    for (let i = 0; i < cnt; i++) {
      const o = t.valOff + i * (TYPE_SIZE[t.type] || 1);
      switch (t.type) {
        case 2: {
          let s = '';
          for (let k = 0; k < t.count; k++) {
            const c = dv.getUint8(t.valOff + k);
            if (c === 0) break;
            s += String.fromCharCode(c);
          }
          return s.trim();
        }
        case 3: out.push(dv.getUint16(o, little)); break;
        case 4: out.push(dv.getUint32(o, little)); break;
        case 5: { const d = dv.getUint32(o + 4, little); out.push(d ? dv.getUint32(o, little) / d : 0); break; }
        case 9: out.push(dv.getInt32(o, little)); break;
        case 10: { const d = dv.getInt32(o + 4, little); out.push(d ? dv.getInt32(o, little) / d : 0); break; }
        case 11: out.push(dv.getFloat32(o, little)); break;
        case 12: out.push(dv.getFloat64(o, little)); break;
        case 1: case 7: out.push(dv.getUint8(o)); break;
        default: out.push(0);
      }
    }
    return out.length === 1 ? out[0] : out;
  };

  const ifd0 = readIFD(u32(base + 4));
  const exifPtr = ifd0[0x8769] ? value(ifd0[0x8769]) : 0;
  const exif = exifPtr ? readIFD(exifPtr) : {};
  return { ifd0, exif, value };
}

function parseDateString(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s || '');
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, h, mi, se).getTime();
}

/** Lê metadados de um ArrayBuffer (JPEG/HEIC). Retorna {} se não houver EXIF. */
export function readExif(buf) {
  try {
    const base = findTiffBase(buf);
    if (base < 0) return {};
    const t = parseTiff(buf, base);
    if (!t) return {};
    const { ifd0, exif, value } = t;
    const out = {};
    const dstr = value(exif[0x9003]) || value(exif[0x9004]) || value(ifd0[0x0132]);
    const date = parseDateString(dstr);
    if (date) out.date = date;
    if (ifd0[0x010f]) out.make = value(ifd0[0x010f]);
    if (ifd0[0x0110]) out.model = value(ifd0[0x0110]);
    if (ifd0[0x0112]) out.orientation = value(ifd0[0x0112]);
    if (exif[0xa434]) out.lens = value(exif[0xa434]);
    if (exif[0x8827]) { const v = value(exif[0x8827]); out.iso = Array.isArray(v) ? v[0] : v; }
    if (exif[0x829a]) out.exposure = value(exif[0x829a]);
    if (exif[0x829d]) out.fnumber = value(exif[0x829d]);
    if (exif[0x920a]) out.focal = value(exif[0x920a]);
    if (exif[0xa405]) out.focal35 = value(exif[0xa405]);
    if (exif[0x9204] !== undefined) out.ev = value(exif[0x9204]);
    if (exif[0xa002]) out.pxW = value(exif[0xa002]);
    if (exif[0xa003]) out.pxH = value(exif[0xa003]);
    return out;
  } catch (e) {
    return {};
  }
}

/* ------------------------------------------------------------------ escrever datas (in-place) */

function writeAscii(u8, off, count, str) {
  for (let i = 0; i < count; i++) u8[off + i] = i < str.length ? str.charCodeAt(i) : 0;
}

/**
 * Troca as datas dentro de um JPEG já existente, mantendo todo o resto (câmera, ISO, GPS, miniatura…).
 * Retorna um novo ArrayBuffer, ou null se o arquivo não tem as tags de data (aí usa-se o caminho via canvas).
 */
export function patchJpegDates(buf, ms) {
  const base = findJpegTiffBase(new DataView(buf));
  if (base < 0) return null;
  const t = parseTiff(buf, base);
  if (!t) return null;
  const copy = buf.slice(0);
  const u8 = new Uint8Array(copy);
  const dateStr = exifDateString(ms);
  const offStr = exifOffsetString(ms);
  let wrote = 0;
  const put = (tag, str) => {
    if (tag && tag.type === 2 && tag.count >= str.length + 1) { writeAscii(u8, tag.valOff, tag.count, str); return true; }
    return false;
  };
  if (put(t.exif[0x9003], dateStr)) wrote++;
  if (put(t.exif[0x9004], dateStr)) wrote++;
  if (put(t.ifd0[0x0132], dateStr)) wrote++;
  put(t.exif[0x9010], offStr); put(t.exif[0x9011], offStr); put(t.exif[0x9012], offStr);
  // frações de segundo: zera
  for (const k of [0x9290, 0x9291, 0x9292]) {
    const tag = t.exif[k];
    if (tag && tag.type === 2) writeAscii(u8, tag.valOff, tag.count, '000'.slice(0, Math.max(0, tag.count - 1)));
  }
  return wrote > 0 && t.exif[0x9003] ? copy : null;
}

/* ------------------------------------------------------------------ criar bloco EXIF novo */

const enc = new TextEncoder();

function ascii(str) {
  const b = enc.encode(str);
  const out = new Uint8Array(b.length + 1);
  out.set(b);
  return out;
}
function be16(n) { return new Uint8Array([(n >> 8) & 255, n & 255]); }
function be32(n) { return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]); }
function rational(num, den) { const o = new Uint8Array(8); o.set(be32(num)); o.set(be32(den), 4); return o; }
function toRational(v, scale = 1000) {
  return rational(Math.max(0, Math.round(v * scale)), scale);
}

function buildApp1({ ms, make, model, iso, exposure, fnumber, focal, focal35 }) {
  const dateStr = exifDateString(ms);
  const offStr = exifOffsetString(ms);

  const ifd0 = [];
  if (make) ifd0.push({ tag: 0x010f, type: 2, data: ascii(make) });
  if (model) ifd0.push({ tag: 0x0110, type: 2, data: ascii(model) });
  ifd0.push({ tag: 0x0132, type: 2, data: ascii(dateStr) });

  const exif = [];
  if (exposure) {
    exif.push({ tag: 0x829a, type: 5, data: exposure < 1 ? rational(1, Math.max(1, Math.round(1 / exposure))) : toRational(exposure) });
  }
  if (fnumber) exif.push({ tag: 0x829d, type: 5, data: toRational(fnumber, 100) });
  if (iso) exif.push({ tag: 0x8827, type: 3, data: be16(iso) });
  exif.push({ tag: 0x9003, type: 2, data: ascii(dateStr) });
  exif.push({ tag: 0x9004, type: 2, data: ascii(dateStr) });
  exif.push({ tag: 0x9010, type: 2, data: ascii(offStr) });
  exif.push({ tag: 0x9011, type: 2, data: ascii(offStr) });
  exif.push({ tag: 0x9012, type: 2, data: ascii(offStr) });
  if (focal) exif.push({ tag: 0x920a, type: 5, data: toRational(focal, 100) });
  if (focal35) exif.push({ tag: 0xa405, type: 3, data: be16(Math.round(focal35)) });
  exif.push({ tag: 0xa001, type: 3, data: be16(1) }); // ColorSpace sRGB

  const ptr = { tag: 0x8769, type: 4, data: be32(0) };
  const ifd0All = [...ifd0, ptr].sort((a, b) => a.tag - b.tag);
  exif.sort((a, b) => a.tag - b.tag);

  const count = (e) => e.data.length / ({ 2: 1, 3: 2, 4: 4, 5: 8 }[e.type]);
  const ifdSize = (arr) => 2 + 12 * arr.length + 4;
  const dataSize = (arr) => arr.reduce((s, e) => s + (e.data.length > 4 ? e.data.length + (e.data.length & 1) : 0), 0);

  const ifd0Off = 8;
  const ifd0DataOff = ifd0Off + ifdSize(ifd0All);
  const exifOff = ifd0DataOff + dataSize(ifd0All);
  const exifDataOff = exifOff + ifdSize(exif);
  const total = exifDataOff + dataSize(exif);

  const tiff = new Uint8Array(total);
  const dv = new DataView(tiff.buffer);
  tiff.set([0x4d, 0x4d, 0, 42]);
  dv.setUint32(4, ifd0Off);
  ptr.data = be32(exifOff);

  const writeIfd = (arr, off, dataOff) => {
    dv.setUint16(off, arr.length);
    let d = dataOff;
    arr.forEach((e, i) => {
      const p = off + 2 + i * 12;
      dv.setUint16(p, e.tag);
      dv.setUint16(p + 2, e.type);
      dv.setUint32(p + 4, count(e));
      if (e.data.length > 4) {
        dv.setUint32(p + 8, d);
        tiff.set(e.data, d);
        d += e.data.length + (e.data.length & 1);
      } else {
        tiff.set(e.data, p + 8);
      }
    });
    dv.setUint32(off + 2 + arr.length * 12, 0);
  };
  writeIfd(ifd0All, ifd0Off, ifd0DataOff);
  writeIfd(exif, exifOff, exifDataOff);

  const segLen = 2 + 6 + tiff.length;
  const seg = new Uint8Array(2 + segLen);
  seg.set([0xff, 0xe1, (segLen >> 8) & 255, segLen & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  seg.set(tiff, 10);
  return seg;
}

/** Insere um bloco EXIF novo logo após o SOI de um JPEG (remove o EXIF antigo, se houver). */
export function injectExif(jpegBuf, info) {
  const src = new Uint8Array(jpegBuf);
  const dv = new DataView(jpegBuf);
  if (dv.getUint16(0) !== 0xffd8) return jpegBuf;
  // remove APP1 Exif existente
  let off = 2;
  const keep = [src.subarray(0, 2)];
  let rest = 2;
  while (off + 4 <= src.length && src[off] === 0xff) {
    const marker = src[off + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = dv.getUint16(off + 2);
    if (marker === 0xe1 && dv.getUint32(off + 4) === 0x45786966) {
      keep.push(src.subarray(rest, off));
      rest = off + 2 + len;
    }
    off += 2 + len;
  }
  keep.push(buildApp1(info), src.subarray(rest));
  const size = keep.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(size);
  let p = 0;
  for (const a of keep) { out.set(a, p); p += a.length; }
  return out.buffer;
}
