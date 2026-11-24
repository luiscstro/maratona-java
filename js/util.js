// Formatação e helpers (pt-BR), no estilo do app Fotos do iOS.
const L = 'pt-BR';
const pad = (n) => String(n).padStart(2, '0');

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export const fmtTime = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

/** "Segunda-feira, 23 de novembro de 2026 às 22:38" */
export function fmtFull(ms) {
  const d = new Date(ms);
  const s = d.toLocaleDateString(L, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `${cap(s)} às ${fmtTime(ms)}`;
}

/** Linha de cima do título do visualizador: "Hoje", "Ontem", "23 de nov." ou "23 de nov. de 2025" */
export function fmtDayLabel(ms) {
  const d = new Date(ms);
  const today = startOfDay(new Date());
  const diff = Math.round((today - startOfDay(d)) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const s = d.toLocaleDateString(L, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  return s;
}

/** Curto, para listas: "seg., 23 de nov. de 2026" */
export function fmtShort(ms) {
  return new Date(ms).toLocaleDateString(L, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export const toDateInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const toTimeInput = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };

export function fromInputs(dateStr, timeStr, keepSecondsFrom) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  let s = 0;
  if (keepSecondsFrom != null && toTimeInput(keepSecondsFrom) === timeStr) s = new Date(keepSecondsFrom).getSeconds();
  return new Date(y, m - 1, d, h, mi, s).getTime();
}

export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function fmtSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toLocaleString(L, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const fmtNum = (n) => n.toLocaleString(L);

export function fmtCount(n, one, many) { return `${fmtNum(n)} ${n === 1 ? one : many}`; }

export function fmtExposure(t) {
  if (!t) return '—';
  if (t < 1) return `1/${Math.round(1 / t)} s`;
  return `${(+t.toFixed(1)).toLocaleString(L)} s`;
}

export function fmtF(f) { return f ? `ƒ${(+f.toFixed(1)).toLocaleString(L)}` : '—'; }

export function norm(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem('fotos.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fotos.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
