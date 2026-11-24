// Datas em vídeos MP4/MOV: leitura (mvhd / com.apple.quicktime.creationdate) e regravação
// (mvhd, tkhd, mdhd e a data "creationdate" do iPhone) sem carregar o vídeo todo na memória.
const EPOCH_1904 = 2082844800; // segundos entre 1904-01-01 e 1970-01-01
const CONTAINERS = new Set(['moov', 'trak', 'mdia']);
const TIMES = new Set(['mvhd', 'tkhd', 'mdhd']);

const typeOf = (dv, o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
const pad = (n) => String(n).padStart(2, '0');

async function findMoov(file) {
  let pos = 0;
  const size = file.size;
  while (pos + 8 <= size) {
    const dv = new DataView(await file.slice(pos, pos + 16).arrayBuffer());
    let len = dv.getUint32(0), head = 8;
    const type = typeOf(dv, 4);
    if (len === 1 && dv.byteLength >= 16) { len = Number(dv.getBigUint64(8)); head = 16; }
    else if (len === 0) len = size - pos;
    if (len < 8) return null;
    if (type === 'moov') return { pos, len, head };
    pos += len;
  }
  return null;
}

function walk(dv, start, end, fn) {
  let p = start;
  while (p + 8 <= end) {
    const len = dv.getUint32(p);
    const type = typeOf(dv, p + 4);
    if (len < 8 || p + len > end) break;
    if (TIMES.has(type)) fn(p + 8, type);
    else if (CONTAINERS.has(type)) walk(dv, p + 8, p + len, fn);
    p += len;
  }
}

const CREATIONDATE_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}/g;

/** Data de criação do vídeo em ms (UTC), ou null. */
export async function readMp4Date(file) {
  try {
    const m = await findMoov(file);
    if (!m || m.len > 64 * 1024 * 1024) return null;
    const buf = await file.slice(m.pos, m.pos + m.len).arrayBuffer();
    const dv = new DataView(buf);
    // 1) data com fuso que o iPhone grava
    const text = new TextDecoder('latin1').decode(buf);
    const hit = text.match(CREATIONDATE_RE);
    if (hit) {
      const s = hit[0].replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
      const t = Date.parse(s);
      if (!Number.isNaN(t)) return t;
    }
    // 2) mvhd
    let found = null;
    walk(dv, m.head, buf.byteLength, (off, type) => {
      if (type !== 'mvhd' || found) return;
      const v = dv.getUint8(off);
      const secs = v === 1 ? Number(dv.getBigUint64(off + 4)) : dv.getUint32(off + 4);
      if (secs > EPOCH_1904 + 631152000) found = (secs - EPOCH_1904) * 1000; // > 1990
    });
    return found;
  } catch { return null; }
}

/** Devolve um Blob do mesmo vídeo com as datas internas trocadas por `ms`. Em falha, devolve o arquivo original. */
export async function patchMp4Dates(file, ms) {
  try {
    const m = await findMoov(file);
    if (!m || m.len > 64 * 1024 * 1024) return file;
    const buf = await file.slice(m.pos, m.pos + m.len).arrayBuffer();
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    const secs = Math.round(ms / 1000) + EPOCH_1904;
    walk(dv, m.head, buf.byteLength, (off) => {
      const v = dv.getUint8(off);
      if (v === 1) { dv.setBigUint64(off + 4, BigInt(secs)); dv.setBigUint64(off + 12, BigInt(secs)); }
      else { dv.setUint32(off + 4, secs >>> 0); dv.setUint32(off + 8, secs >>> 0); }
    });
    // com.apple.quicktime.creationdate (mesmo tamanho: "AAAA-MM-DDTHH:MM:SS±HHMM")
    const d = new Date(ms);
    const off = -d.getTimezoneOffset();
    const a = Math.abs(off);
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}${pad(a % 60)}`;
    const text = new TextDecoder('latin1').decode(buf);
    for (const mt of text.matchAll(CREATIONDATE_RE)) {
      for (let i = 0; i < stamp.length; i++) u8[mt.index + i] = stamp.charCodeAt(i);
    }
    return new Blob([file.slice(0, m.pos), buf, file.slice(m.pos + m.len)], { type: file.type });
  } catch { return file; }
}
