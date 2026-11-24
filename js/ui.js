// Componentes de interface: menu (popover), folhas (sheets), action sheet e avisos.
import { el, $, toDateInput, toTimeInput, fromInputs, fmtFull, fmtShort, fmtTime } from './util.js';
import { I } from './icons.js';

const root = () => $('#overlay-root');

/* ----------------------------------------------------------------- toast */
let toastTimer;
export function toast(text, sticky = false) {
  let t = $('#toast');
  if (!t) { t = el('div', { id: 'toast', class: 'toast glass' }); $('#app').append(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  return () => t.classList.remove('show');
}

/* ----------------------------------------------------------------- menu */
/**
 * items: [{label, icon, danger, checked, onClick, sep, header}]
 * anchor: elemento âncora. O menu abre abaixo (ou acima, se `up`).
 */
export function showMenu(anchor, items, { up = false, align = 'right' } = {}) {
  closeMenu();
  const back = el('div', { class: 'menu-back', id: 'menu-back' });
  const menu = el('div', { class: 'menu glass-strong' });
  for (const it of items) {
    if (it.sep) { menu.append(el('div', { class: 'menu-sep' })); continue; }
    if (it.header) { menu.append(el('div', { class: 'menu-head' }, it.header)); continue; }
    const row = el('button', { class: 'menu-item' + (it.danger ? ' danger' : '') + (it.disabled ? ' disabled' : '') },
      el('span', { class: 'menu-check', html: it.checked ? I.check : '' }),
      el('span', { class: 'menu-label' }, it.label),
      it.icon ? el('span', { class: 'menu-icon', html: I[it.icon] || '' }) : null);
    row.addEventListener('click', () => { if (it.disabled) return; closeMenu(); it.onClick && it.onClick(); });
    menu.append(row);
  }
  back.append(menu);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) closeMenu(); });
  root().append(back);

  const r = anchor.getBoundingClientRect();
  const app = $('#app').getBoundingClientRect();
  menu.style.maxWidth = Math.min(340, app.width - 24) + 'px';
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = align === 'right' ? r.right - mw : r.left;
  left = Math.max(app.left + 12, Math.min(left, app.right - mw - 12));
  let top = up ? r.top - mh - 10 : r.bottom + 10;
  top = Math.max(12, Math.min(top, window.innerHeight - mh - 12));
  menu.style.left = left - app.left + 'px';
  menu.style.top = top + 'px';
  menu.style.transformOrigin = `${align === 'right' ? 'right' : 'left'} ${up ? 'bottom' : 'top'}`;
  requestAnimationFrame(() => back.classList.add('show'));
}
export function closeMenu() { const m = $('#menu-back'); if (m) m.remove(); }

/* ----------------------------------------------------------------- sheet base */
function openSheet(content, { full = false, onClose } = {}) {
  const back = el('div', { class: 'sheet-back' });
  const sheet = el('div', { class: 'sheet' + (full ? ' full' : '') }, el('div', { class: 'sheet-grab' }), content);
  back.append(sheet);
  root().append(back);
  let closed = false;
  const close = (silent) => {
    if (closed) return;
    closed = true;
    back.classList.remove('show');
    setTimeout(() => back.remove(), 280);
    if (!silent && onClose) onClose();
  };
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  // arrastar para baixo
  let y0 = null, dy = 0;
  const grab = $('.sheet-grab', sheet);
  const nav = sheet.querySelector('.sheet-nav');
  for (const h of [grab, nav].filter(Boolean)) {
    h.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; dy = 0; sheet.style.transition = 'none'; }, { passive: true });
    h.addEventListener('touchmove', (e) => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sheet.style.transform = `translateY(${dy}px)`; }, { passive: true });
    h.addEventListener('touchend', () => {
      if (y0 == null) return;
      sheet.style.transition = '';
      if (dy > 110) close(); else sheet.style.transform = '';
      y0 = null;
    });
  }
  requestAnimationFrame(() => requestAnimationFrame(() => back.classList.add('show')));
  return { close, sheet, back };
}

/* ----------------------------------------------------------------- action sheet */
export function actionSheet({ title, actions }) {
  const back = el('div', { class: 'as-back' });
  const wrap = el('div', { class: 'as-wrap' });
  const group = el('div', { class: 'as-group glass-strong' });
  if (title) group.append(el('div', { class: 'as-title' }, title));
  const close = () => { back.classList.remove('show'); setTimeout(() => back.remove(), 250); };
  for (const a of actions) {
    group.append(el('button', { class: 'as-btn' + (a.danger ? ' danger' : ''), onclick: () => { close(); a.onClick && a.onClick(); } }, a.label));
  }
  const cancel = el('button', { class: 'as-btn cancel glass-strong', onclick: close }, 'Cancelar');
  wrap.append(group, cancel);
  back.append(wrap);
  back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
  root().append(back);
  requestAnimationFrame(() => requestAnimationFrame(() => back.classList.add('show')));
}

/* ----------------------------------------------------------------- texto (legenda, local, palavras-chave) */
export function textSheet({ title, label, value = '', placeholder = '', apply = 'OK', multiline = false, onSave }) {
  const input = multiline ? el('textarea', { rows: 3, placeholder }) : el('input', { type: 'text', placeholder, autocapitalize: 'sentences' });
  input.value = value;
  const cancel = el('button', { class: 'nav-btn' }, 'Cancelar');
  const ok = el('button', { class: 'nav-btn strong' }, apply);
  const content = el('div', { class: 'sheet-inner' },
    el('div', { class: 'sheet-nav' }, cancel, el('div', { class: 'sheet-title' }, title), ok),
    el('div', { class: 'sheet-body' },
      label ? el('p', { class: 'hint' }, label) : null,
      el('div', { class: 'group single' }, input)));
  const { close } = openSheet(content);
  cancel.addEventListener('click', () => close());
  const save = () => { onSave(input.value.trim()); close(); };
  ok.addEventListener('click', save);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !multiline) { e.preventDefault(); save(); } });
  setTimeout(() => input.focus(), 350);
}

/* ----------------------------------------------------------------- Ajustar Data e Hora */
/**
 * items: itens selecionados. Com 1 item, define a data dele. Com vários, define a data do mais antigo
 * e desloca os demais pelo mesmo intervalo (mantém a distância entre eles), como no app Fotos.
 */
export function dateSheet({ items, onApply, onRevert }) {
  const list = [...items].sort((a, b) => a.taken - b.taken);
  const base = list[0].taken;
  const dateIn = el('input', { type: 'date', value: toDateInput(base) });
  const timeIn = el('input', { type: 'time', value: toTimeInput(base), step: 60 });
  const preview = el('p', { class: 'date-preview' });

  const current = () => {
    if (!dateIn.value || !timeIn.value) return base;
    return fromInputs(dateIn.value, timeIn.value, base);
  };
  const refresh = () => {
    const v = current();
    preview.textContent = list.length === 1
      ? fmtFull(v)
      : `${list.length} itens · o mais antigo passa para ${fmtShort(v)} às ${fmtTime(v)}; os outros mantêm o mesmo intervalo entre si.`;
  };
  dateIn.addEventListener('input', refresh);
  timeIn.addEventListener('input', refresh);
  refresh();

  const cancel = el('button', { class: 'nav-btn' }, 'Cancelar');
  const ok = el('button', { class: 'nav-btn strong' }, 'Ajustar');
  const edited = list.some((i) => i.edited);

  const body = el('div', { class: 'sheet-body' },
    el('p', { class: 'hint' }, list.length === 1
      ? `Data original: ${fmtFull(list[0].origTaken ?? list[0].taken)}`
      : 'Escolha a nova data e hora do item mais antigo da seleção.'),
    el('div', { class: 'group' },
      el('div', { class: 'row' }, el('span', { class: 'row-label' }, 'Data'), dateIn),
      el('div', { class: 'row' }, el('span', { class: 'row-label' }, 'Hora'), timeIn)),
    preview);

  let revertBtn = null;
  if (edited && onRevert) {
    revertBtn = el('button', { class: 'row-btn' }, 'Reverter ao Original');
    body.append(el('div', { class: 'group single' }, revertBtn));
  }

  const content = el('div', { class: 'sheet-inner' },
    el('div', { class: 'sheet-nav' }, cancel, el('div', { class: 'sheet-title' }, 'Ajustar Data e Hora'), ok), body);
  const { close } = openSheet(content);
  cancel.addEventListener('click', () => close());
  ok.addEventListener('click', () => {
    const delta = current() - base;
    close();
    onApply(delta, current());
  });
  if (revertBtn) revertBtn.addEventListener('click', () => { close(); onRevert(); });
}

/* ----------------------------------------------------------------- confirmação simples */
export function confirmDelete({ title, label, onConfirm }) {
  actionSheet({ title, actions: [{ label, danger: true, onClick: onConfirm }] });
}
