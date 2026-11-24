// Fotos — controlador principal: Fototeca, Coleções, álbuns, pesquisa, seleção e importação.
import { $, $$, el, fmtCount, fmtDuration, fmtNum, norm } from './util.js';
import { I } from './icons.js';
import { S, loadAll, onChange, libraryItems, live, sorted, search, thumbURL, setPref, addItem, emit } from './state.js';
import * as A from './actions.js';
import { importFile } from './media.js';
import { openViewer } from './viewer.js';
import { showMenu, toast, actionSheet } from './ui.js';
import { pushLayer, closeLayer } from './nav.js';

const app = $('#app');
const libScroll = $('#libScroll'), libGrid = $('#libGrid');
const fileInput = $('#fileInput');

/* ------------------------------------------------------------------ ícones estáticos */
$('#btnFilter').innerHTML = I.filter;
$('#icLib').innerHTML = I.photoStack;
$('#icCol').innerHTML = I.rectStack;
$('#btnSearch').innerHTML = I.search;
$('#selShare').innerHTML = I.share;
$('#selMore').innerHTML = I.dots;
$('#selTrash').innerHTML = I.trash;
$('#albumBack').innerHTML = I.back;
$('#albumMore').innerHTML = I.dots;
$('#sfIc').innerHTML = I.search;
$('#sfClear').innerHTML = I.xmark;
$('#searchClose').innerHTML = I.xmark;

/* ------------------------------------------------------------------ grade com miniaturas preguiçosas */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const img = e.target;
    io.unobserve(img);
    thumbURL(img.dataset.id).then((u) => {
      if (!u) return;
      img.onload = () => img.classList.add('ok');
      img.src = u;
      if (img.complete) img.classList.add('ok');
    });
  }
}, { rootMargin: '900px 0px' });

function makeCell(it, selected) {
  const c = el('div', { class: 'cell' + (selected ? ' sel' : ''), 'data-id': it.id });
  const img = el('img', { alt: '', draggable: 'false' });
  img.dataset.id = it.id;
  c.append(img);
  if (it.type === 'video') c.append(el('span', { class: 'dur' }, fmtDuration(it.duration || 0)));
  if (it.fav) c.append(el('span', { class: 'fav', html: I.heartFill }));
  c.append(el('span', { class: 'chk', html: I.check }));
  io.observe(img);
  return c;
}

function renderGrid(grid, list, selected) {
  const scroller = grid.parentElement;
  const st = scroller.scrollTop;
  grid.textContent = '';
  const frag = document.createDocumentFragment();
  for (const it of list) frag.append(makeCell(it, selected && selected.has(it.id)));
  grid.append(frag);
  grid._ids = list.map((i) => i.id);
  scroller.scrollTop = st;
}

const scrollBottom = (sc) => { sc.scrollTop = sc.scrollHeight; };

/* ------------------------------------------------------------------ Fototeca */
let libFirst = true;

function renderLibrary() {
  app.style.setProperty('--cols', S.prefs.cols);
  const list = libraryItems();
  const total = live().length;
  $('#libSub').textContent = fmtCount(list.length, 'Item', 'Itens');
  const empty = $('#libEmpty');
  if (!list.length) {
    libGrid.textContent = ''; libGrid._ids = [];
    empty.hidden = false;
    empty.innerHTML = '';
    if (!total) {
      empty.append(
        el('h3', {}, 'Nenhuma Foto ou Vídeo'),
        el('p', {}, 'Importe fotos e vídeos do seu aparelho para organizar a Fototeca e ajustar a data e a hora de cada um.'),
        el('button', { class: 'cta', onclick: pickFiles }, 'Importar Fotos e Vídeos'));
    } else {
      empty.append(el('h3', {}, 'Nenhum Resultado'), el('p', {}, 'Nenhum item corresponde ao filtro atual.'),
        el('button', { class: 'cta', onclick: () => setPref('filter', 'all') }, 'Mostrar Tudo'));
    }
  } else {
    empty.hidden = true;
    renderGrid(libGrid, list, sel.ids);
    if (libFirst) { libFirst = false; scrollBottom(libScroll); }
  }
  $('#btnSelect').disabled = !list.length;
  $('#btnSelect').style.opacity = list.length ? '' : '.45';
}

/* ------------------------------------------------------------------ seleção */
const sel = { on: false, ids: new Set() };

function setSelecting(on) {
  sel.on = on;
  sel.ids.clear();
  document.body.classList.toggle('selecting', on);
  libGrid.classList.toggle('selecting', on);
  $('#btnSelect').textContent = on ? 'Cancelar' : 'Selecionar';
  $$('.cell.sel', libGrid).forEach((c) => c.classList.remove('sel'));
  updateSelUI();
}

function selectedItems() { return [...sel.ids].map((id) => S.byId.get(id)).filter(Boolean); }

function updateSelUI() {
  const items = selectedItems();
  const n = items.length;
  const label = !n ? 'Selecionar Itens'
    : items.every((i) => i.type === 'photo') ? fmtCount(n, 'Foto Selecionada', 'Fotos Selecionadas')
      : fmtCount(n, 'Item Selecionado', 'Itens Selecionados');
  $('#selLabel').textContent = label;
  for (const b of ['#selShare', '#selTrash']) $(b).disabled = !n;
  $('#selMore').disabled = !n;
  $('#selMore').style.opacity = n ? '' : '.35';
}

$('#btnSelect').addEventListener('click', () => setSelecting(!sel.on));
$('#selShare').addEventListener('click', () => A.shareItems(selectedItems()));
$('#selTrash').addEventListener('click', () => A.askTrash(selectedItems(), () => setSelecting(false)));
$('#selMore').addEventListener('click', (e) => {
  const items = selectedItems();
  if (!items.length) return;
  const allFav = items.every((i) => i.fav);
  showMenu(e.currentTarget, [
    { label: 'Ajustar Data e Hora', icon: 'calendar', onClick: () => A.openDateSheet(items, () => setSelecting(false)) },
    { label: allFav ? 'Remover dos Favoritos' : 'Favoritar', icon: allFav ? 'heart' : 'heartFill', onClick: async () => { await A.setFav(items, !allFav); } },
    { label: 'Duplicar', icon: 'copy', onClick: async () => { await A.duplicateItems(items); setSelecting(false); } },
    ...(items.some((i) => i.edited) ? [{ label: 'Reverter Data e Hora', icon: 'revert', onClick: () => A.revertDates(items) }] : []),
  ], { up: true });
});

function onGridClick(e, grid, opts = {}) {
  const c = e.target.closest('.cell');
  if (!c) return;
  const id = c.dataset.id;
  if (grid === libGrid && sel.on) {
    if (sel.ids.has(id)) sel.ids.delete(id); else sel.ids.add(id);
    c.classList.toggle('sel', sel.ids.has(id));
    updateSelUI();
    return;
  }
  if (opts.onPick) { opts.onPick(S.byId.get(id)); return; }
  const ids = grid._ids || [];
  openViewer({ ids, index: ids.indexOf(id), grid });
}
libGrid.addEventListener('click', (e) => onGridClick(e, libGrid));

/* ------------------------------------------------------------------ menu de filtros */
$('#btnFilter').addEventListener('click', (e) => {
  const p = S.prefs;
  showMenu(e.currentTarget, [
    { label: 'Importar Fotos e Vídeos…', icon: 'plus', onClick: pickFiles },
    { sep: true },
    { header: 'Ordenar por' },
    { label: 'Data de Captura', checked: p.sort === 'taken', onClick: () => { libFirst = true; setPref('sort', 'taken'); } },
    { label: 'Data de Adição', checked: p.sort === 'added', onClick: () => { libFirst = true; setPref('sort', 'added'); } },
    { sep: true },
    { header: 'Filtrar' },
    { label: 'Todos os Itens', checked: p.filter === 'all', onClick: () => { libFirst = true; setPref('filter', 'all'); } },
    { label: 'Favoritos', checked: p.filter === 'fav', icon: 'heart', onClick: () => { libFirst = true; setPref('filter', 'fav'); } },
    { label: 'Fotos', checked: p.filter === 'photo', onClick: () => { libFirst = true; setPref('filter', 'photo'); } },
    { label: 'Vídeos', checked: p.filter === 'video', icon: 'play', onClick: () => { libFirst = true; setPref('filter', 'video'); } },
    { label: 'Data Ajustada', checked: p.filter === 'edited', icon: 'calendar', onClick: () => { libFirst = true; setPref('filter', 'edited'); } },
    { sep: true },
    { header: 'Exibição' },
    { label: 'Grade de 5 colunas', checked: p.cols === 5, onClick: () => setPref('cols', 5) },
    { label: 'Grade de 3 colunas', checked: p.cols === 3, onClick: () => setPref('cols', 3) },
  ]);
});

/* ------------------------------------------------------------------ importar */
function pickFiles() { fileInput.click(); }
fileInput.addEventListener('change', () => { const f = [...fileInput.files]; fileInput.value = ''; importFiles(f); });

let importing = false;
async function importFiles(files) {
  files = files.filter((f) => /^(image|video)\//.test(f.type) || /\.(heic|heif|jpe?g|png|webp|gif|mov|mp4|m4v)$/i.test(f.name));
  if (!files.length || importing) return;
  importing = true;
  let ok = 0, hide = () => {};
  for (let i = 0; i < files.length; i++) {
    hide = toast(`Importando ${i + 1} de ${files.length}…`, true);
    try {
      const it = await importFile(files[i], i);
      addItem(it, true); ok++;
      if (i % 5 === 4) emit();
    } catch (err) { console.error('Falha ao importar', files[i].name, err); }
  }
  hide();
  emit();
  importing = false;
  toast(ok ? `${fmtCount(ok, 'item importado', 'itens importados')}` : 'Não foi possível importar');
  if (ok) { switchTab('library', true); scrollBottom(libScroll); }
}

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => { e.preventDefault(); importFiles([...(e.dataTransfer ? e.dataTransfer.files : [])]); });

/* ------------------------------------------------------------------ abas */
let tab = 'library';
function switchTab(t, force = false) {
  if (t === tab && !force) {
    if (t === 'library') libScroll.scrollTo({ top: libScroll.scrollHeight, behavior: 'smooth' });
    else $('#colScroll').scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  if (sel.on) setSelecting(false);
  tab = t;
  $('#library').hidden = t !== 'library';
  $('#collections').hidden = t !== 'collections';
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  if (t === 'collections') renderCollections();
}
$$('.tab').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

/* ------------------------------------------------------------------ Coleções */
function albumDefs() {
  return [
    { id: 'recent', title: 'Recentes', icon: 'photoStack', get: () => live() },
    { id: 'fav', title: 'Favoritos', icon: 'heart', get: () => live().filter((i) => i.fav) },
    { id: 'video', title: 'Vídeos', icon: 'play', get: () => live().filter((i) => i.type === 'video') },
    { id: 'edited', title: 'Datas Ajustadas', icon: 'calendar', get: () => live().filter((i) => i.edited) },
  ];
}
const utilDefs = () => [
  { id: 'imports', title: 'Importações', icon: 'save', get: () => live(), by: 'added' },
  { id: 'trash', title: 'Apagados Recentemente', icon: 'trash', get: () => S.items.filter((i) => i.deleted), trash: true },
];

function renderCollections() {
  const sc = $('#colScroll');
  sc.textContent = '';
  const albums = el('div', { class: 'albums' });
  for (const a of albumDefs()) {
    const list = sorted(a.get());
    const cover = el('div', { class: 'album-cover' });
    if (list.length) thumbURL(list[list.length - 1].id).then((u) => { cover.style.backgroundImage = `url(${u})`; });
    else cover.innerHTML = I[a.icon] || '';
    albums.append(el('button', { class: 'album-card', onclick: () => openAlbum(a) }, cover, el('div', { class: 't' }, a.title), el('div', { class: 'n' }, fmtNum(list.length))));
  }
  const util = el('div', { class: 'util' });
  for (const u of utilDefs()) {
    util.append(el('button', { class: 'util-row', onclick: () => openAlbum(u) },
      el('span', { class: 'ic', html: I[u.icon] }), el('span', { class: 't' }, u.title),
      el('span', { class: 'n' }, fmtNum(u.get().length)), el('span', { class: 'ch', html: I.chevR })));
  }
  sc.append(
    el('div', { class: 'col-section' }, el('h2', {}, 'Álbuns'), albums),
    el('div', { class: 'col-section' }, el('h2', {}, 'Utilitários'), util));
}

/* ------------------------------------------------------------------ álbum / detalhe */
const album = $('#album'), albumGrid = $('#albumGrid'), albumScroll = $('#albumScroll');
let curAlbum = null;

function renderAlbum() {
  if (!curAlbum) return;
  const list = sorted(curAlbum.get(), curAlbum.by || 'taken');
  $('#albumTitle').textContent = curAlbum.title;
  const empty = $('#albumEmpty');
  empty.hidden = !!list.length;
  if (!list.length) empty.replaceChildren(el('h3', {}, curAlbum.trash ? 'Nenhum Item Apagado' : 'Nenhum Item'), el('p', {}, curAlbum.trash ? 'Os itens apagados ficam aqui por 30 dias.' : 'Este álbum está vazio.'));
  renderGrid(albumGrid, list);
  $('#albumMore').hidden = !curAlbum.trash || !list.length;
}

function openAlbum(def) {
  curAlbum = def;
  album.hidden = false;
  document.body.classList.add('in-page');
  renderAlbum();
  scrollBottom(albumScroll);
  pushLayer('album', hideAlbum);
}
function hideAlbum() { album.hidden = true; curAlbum = null; document.body.classList.remove('in-page'); }
function closeAlbum() { hideAlbum(); closeLayer('album'); }
$('#albumBack').addEventListener('click', closeAlbum);

albumGrid.addEventListener('click', (e) => {
  if (curAlbum && curAlbum.trash) {
    onGridClick(e, albumGrid, { onPick: (it) => actionSheet({
      title: `${it.name} · apagado`,
      actions: [
        { label: 'Recuperar', onClick: () => A.restoreItems([it]) },
        { label: 'Apagar de Vez', danger: true, onClick: () => A.deleteForever([it]) },
      ],
    }) });
    return;
  }
  onGridClick(e, albumGrid);
});
$('#albumMore').addEventListener('click', (e) => {
  const all = S.items.filter((i) => i.deleted);
  showMenu(e.currentTarget, [
    { label: 'Recuperar Tudo', icon: 'revert', onClick: () => A.restoreItems(all) },
    { label: 'Apagar Tudo de Vez', danger: true, icon: 'trash', onClick: () => actionSheet({ title: 'Esta ação não pode ser desfeita.', actions: [{ label: `Apagar ${fmtCount(all.length, 'Item', 'Itens')}`, danger: true, onClick: () => A.deleteForever(all) }] }) },
  ]);
});

/* ------------------------------------------------------------------ pesquisa */
const searchView = $('#search'), searchInput = $('#searchInput'), searchGrid = $('#searchGrid');

function renderSearch() {
  const q = searchInput.value.trim();
  $('#sfClear').hidden = !q;
  const empty = $('#searchEmpty'), head = $('#searchH');
  if (!q) {
    searchGrid.textContent = ''; searchGrid._ids = [];
    head.hidden = false; head.textContent = 'Sugestões';
    empty.hidden = false;
    empty.className = 'search-sugg';
    empty.replaceChildren(...[['Favoritos', 'heart'], ['Vídeos', 'play'], ['Fotos', 'photoStack'], ['Data Ajustada', 'calendar']].map(([t, ic]) =>
      el('button', { class: 'sugg-row', onclick: () => { searchInput.value = t.toLowerCase(); renderSearch(); } }, el('span', { class: 'ic', html: I[ic] }), t)));
    return;
  }
  const list = search(q);
  head.hidden = true;
  empty.className = 'empty';
  empty.hidden = !!list.length;
  if (!list.length) empty.replaceChildren(el('h3', {}, 'Nenhum Resultado'), el('p', {}, `Nenhum resultado para “${q}”.`));
  renderGrid(searchGrid, list);
}

function openSearch() {
  searchView.hidden = false;
  document.body.classList.add('in-page');
  searchInput.value = '';
  renderSearch();
  pushLayer('search', hideSearch);
  setTimeout(() => searchInput.focus(), 120);
}
function hideSearch() { searchView.hidden = true; document.body.classList.remove('in-page'); searchInput.blur(); }
function closeSearch() { hideSearch(); closeLayer('search'); }
$('#btnSearch').addEventListener('click', openSearch);
$('#searchClose').addEventListener('click', closeSearch);
$('#sfClear').addEventListener('click', () => { searchInput.value = ''; renderSearch(); searchInput.focus(); });
searchInput.addEventListener('input', renderSearch);
searchGrid.addEventListener('click', (e) => onGridClick(e, searchGrid));

/* ------------------------------------------------------------------ atualização em tempo real */
onChange(() => {
  renderLibrary();
  if (tab === 'collections') renderCollections();
  if (!album.hidden) renderAlbum();
  if (!searchView.hidden) renderSearch();
  if (sel.on) {
    for (const id of [...sel.ids]) { const it = S.byId.get(id); if (!it || it.deleted) sel.ids.delete(id); }
    updateSelUI();
  }
});

/* ------------------------------------------------------------------ inicialização */
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => { if (!/INPUT|TEXTAREA/.test(e.target.tagName)) e.preventDefault(); });

(async function init() {
  updateSelUI();
  try { await loadAll(); } catch (err) { console.error(err); emit(); toast('Armazenamento indisponível neste navegador'); }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  document.documentElement.dataset.ready = '1';
})();
