// Ações sobre itens (favoritar, apagar, ajustar data, compartilhar…), usadas pela grade e pelo visualizador.
import { db } from './db.js';
import { S, saveItems, saveItem, addItem, emit, purge } from './state.js';
import { dateSheet, confirmDelete, toast } from './ui.js';
import { exportItem } from './media.js';
import { fmtCount } from './util.js';

const nameOf = (items, one, many) => (items.length === 1 ? one : many);

export async function setFav(items, val) {
  items.forEach((i) => { i.fav = val; });
  await saveItems(items);
}

export async function trashItems(items) {
  const now = Date.now();
  items.forEach((i) => { i.deleted = now; });
  await saveItems(items);
}

export function askTrash(items, after) {
  const all = items.every((i) => i.type === 'photo');
  const label = items.length === 1
    ? (items[0].type === 'video' ? 'Apagar Vídeo' : 'Apagar Foto')
    : `Apagar ${fmtCount(items.length, all ? 'Foto' : 'Item', all ? 'Fotos' : 'Itens')}`;
  confirmDelete({
    title: items.length === 1 ? 'Este item será movido para Apagados Recentemente.' : `${items.length} itens serão movidos para Apagados Recentemente.`,
    label,
    onConfirm: async () => { await trashItems(items); toast('Movido para Apagados Recentemente'); after && after(); },
  });
}

export async function restoreItems(items) {
  items.forEach((i) => { i.deleted = null; });
  await saveItems(items);
}

export async function deleteForever(items) { await purge(items.map((i) => i.id)); }

/** Abre a folha "Ajustar Data e Hora" para um ou vários itens. */
export function openDateSheet(items, after) {
  if (!items.length) return;
  dateSheet({
    items,
    onApply: async (delta) => {
      if (delta !== 0) {
        items.forEach((i) => { i.taken += delta; i.edited = i.taken !== i.origTaken; });
        await saveItems(items);
        toast(items.length === 1 ? 'Data e hora ajustadas' : `Data e hora de ${items.length} itens ajustadas`);
      }
      after && after();
    },
    onRevert: async () => {
      items.forEach((i) => { if (i.origTaken != null) { i.taken = i.origTaken; } i.edited = false; });
      await saveItems(items);
      toast('Data e hora originais restauradas');
      after && after();
    },
  });
}

export async function revertDates(items) {
  items.forEach((i) => { if (i.origTaken != null) i.taken = i.origTaken; i.edited = false; });
  await saveItems(items);
  toast('Data e hora originais restauradas');
}

export async function duplicateItems(items) {
  let n = 0;
  for (const it of items) {
    const [thumb, file] = await Promise.all([db.getThumb(it.id), db.getFile(it.id)]);
    const copy = { ...it, id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + n)), added: Date.now() + n, camera: it.camera ? { ...it.camera } : null, keywords: [...(it.keywords || [])] };
    await db.addNew(copy, thumb, file);
    addItem(copy, true);
    n++;
  }
  emit();
  toast(n === 1 ? 'Item duplicado' : `${n} itens duplicados`);
}

function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Compartilha (folha de compartilhamento do iOS → "Salvar Imagem" grava no app Fotos com a data nova). */
export async function shareItems(items, { forceDownload = false } = {}) {
  if (!items.length) return;
  const done = toast('Preparando…', true);
  try {
    const files = [];
    for (const it of items) files.push(await exportItem(it));
    done();
    if (!forceDownload && navigator.canShare && navigator.canShare({ files })) {
      try { await navigator.share({ files }); } catch (e) { if (e && e.name !== 'AbortError') throw e; }
    } else {
      files.forEach(download);
      toast(nameOf(files, 'Arquivo baixado', 'Arquivos baixados'));
    }
  } catch (e) {
    done();
    toast('Não foi possível compartilhar');
    console.error(e);
  }
}
