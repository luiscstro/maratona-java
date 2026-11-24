// Estado global do app: itens, preferências e acesso a miniaturas/arquivos.
import { db } from './db.js';
import { store, norm, fmtFull } from './util.js';

export const S = {
  items: [],
  byId: new Map(),
  prefs: { sort: store.get('sort', 'taken'), filter: store.get('filter', 'all'), cols: store.get('cols', 5) },
};

const listeners = new Set();
export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const emit = () => listeners.forEach((f) => f());

export function setPref(k, v) { S.prefs[k] = v; store.set(k, v); emit(); }

const DAY = 86400000;

export async function loadAll() {
  S.items = await db.allItems();
  // apagados há mais de 30 dias saem de vez
  const now = Date.now();
  for (const it of S.items.filter((i) => i.deleted && now - i.deleted > 30 * DAY)) await db.remove(it.id);
  S.items = S.items.filter((i) => !(i.deleted && now - i.deleted > 30 * DAY));
  reindex();
  emit();
}

function reindex() { S.byId = new Map(S.items.map((i) => [i.id, i])); }

export function addItem(item, silent = false) { S.items.push(item); S.byId.set(item.id, item); if (!silent) emit(); }

export async function saveItems(list) { await db.putItems(list); emit(); }
export async function saveItem(it) { await db.putItem(it); emit(); }

export async function purge(ids) {
  for (const id of ids) {
    await db.remove(id);
    S.items = S.items.filter((i) => i.id !== id);
    dropUrls(id);
  }
  reindex(); emit();
}

export const live = () => S.items.filter((i) => !i.deleted);

export function sorted(list, by = S.prefs.sort) {
  const k = by === 'added' ? 'added' : 'taken';
  return [...list].sort((a, b) => a[k] - b[k] || a.added - b.added);
}

/** Itens da Fototeca com filtro/ordem aplicados (mais antigo → mais novo, como no iOS). */
export function libraryItems() {
  let l = live();
  const f = S.prefs.filter;
  if (f === 'fav') l = l.filter((i) => i.fav);
  else if (f === 'photo') l = l.filter((i) => i.type === 'photo');
  else if (f === 'video') l = l.filter((i) => i.type === 'video');
  else if (f === 'edited') l = l.filter((i) => i.edited);
  return sorted(l);
}

export function search(q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return sorted(live().filter((i) => {
    const hay = norm([
      i.name, i.caption, (i.keywords || []).join(' '), i.location, fmtFull(i.taken),
      new Date(i.taken).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      i.type === 'video' ? 'video videos' : 'foto fotos',
      i.fav ? 'favorito favoritos' : '', i.edited ? 'ajustada ajustadas editada editadas' : '', i.camera ? `${i.camera.make} ${i.camera.model}` : '', i.format,
    ].join(' '));
    return terms.every((t) => hay.includes(t));
  }));
}

/* ----------------------------------------------------------------- URLs de miniaturas / arquivos */
const thumbCache = new Map();
const fileCache = new Map();

export async function thumbURL(id) {
  if (thumbCache.has(id)) return thumbCache.get(id);
  const p = db.getThumb(id).then((b) => (b ? URL.createObjectURL(b) : ''));
  thumbCache.set(id, p);
  return p;
}

export async function fileURL(id) {
  if (fileCache.has(id)) return fileCache.get(id);
  const p = db.getFile(id).then((b) => (b ? URL.createObjectURL(b) : ''));
  fileCache.set(id, p);
  // mantém só os 6 mais recentes
  if (fileCache.size > 6) {
    const first = fileCache.keys().next().value;
    fileCache.get(first).then((u) => u && URL.revokeObjectURL(u));
    fileCache.delete(first);
  }
  return p;
}

function dropUrls(id) {
  for (const c of [thumbCache, fileCache]) {
    const p = c.get(id);
    if (p) p.then((u) => u && URL.revokeObjectURL(u));
    c.delete(id);
  }
}
