// Visualizador de foto/vídeo: swipe entre itens, pinça/duplo toque, arrastar para fechar,
// fita de miniaturas, painel de informações com "Ajustes" (data e hora).
import { S, onChange, thumbURL, fileURL, saveItem } from './state.js';
import { I } from './icons.js';
import { $, el, fmtDayLabel, fmtTime, fmtFull, fmtSize, fmtExposure, fmtF, fmtNum, clamp } from './util.js';
import { showMenu, textSheet } from './ui.js';
import { pushLayer, closeLayer } from './nav.js';
import { setFav, askTrash, openDateSheet, shareItems, duplicateItems, revertDates } from './actions.js';

const GAP = 14;
const THUMB_W = 24; // largura de cada miniatura na fita (22 + 2)

const viewer = $('#viewer');
const stage = $('#vStage');
const strip = $('#vStrip');
const stripInner = $('#vStripInner');
const info = $('#vInfo');

const V = {
  open: false, ids: [], idx: 0, W: 0, H: 0, slides: [], zoom: { s: 1, x: 0, y: 0 },
  info: false, chromeOff: false, grid: null, onClose: null, busy: false,
};

const item = (i = V.idx) => S.byId.get(V.ids[i]);

/* ------------------------------------------------------------------ ícones fixos */
$('#vBack').innerHTML = I.back;
$('#vMore').innerHTML = I.dots;
$('#vShare').innerHTML = I.share;
$('#vAdjust').innerHTML = I.sliders;
$('#vTrash').innerHTML = I.trash;

/* ------------------------------------------------------------------ layout */
function measure() {
  const r = viewer.getBoundingClientRect();
  V.W = r.width; V.H = r.height;
}

function fit(it) {
  const ar = (it.width || 1) / (it.height || 1);
  let w = V.W, h = w / ar;
  if (h > V.H) { h = V.H; w = h * ar; }
  return { w, h };
}

function infoHeight(it) {
  const { h } = fit(it);
  return Math.min(h, Math.round(V.H * 0.46));
}

function placeMedia(m, it, current) {
  const { w, h } = fit(it);
  const top = V.info && current ? 0 : (V.H - h) / 2;
  m.style.width = w + 'px'; m.style.height = h + 'px';
  m.style.left = (V.W - w) / 2 + 'px'; m.style.top = top + 'px';
}

function positionSlides(dx = 0, anim = false) {
  V.slides.forEach((s, i) => {
    s.style.transition = anim ? 'transform .32s cubic-bezier(.2,.8,.2,1)' : 'none';
    s.style.transform = `translate3d(${(i - 1) * (V.W + GAP) + dx}px,0,0)`;
  });
}

/* ------------------------------------------------------------------ slides */
async function fillSlide(slide, it, current) {
  slide.textContent = '';
  slide.dataset.id = it ? it.id : '';
  if (!it) return;
  const token = it.id;
  const turl = await thumbURL(it.id);
  if (slide.dataset.id !== token) return;
  if (it.type === 'video') {
    const poster = el('img', { alt: '', draggable: 'false', src: turl });
    poster.style.objectFit = 'cover';
    slide.append(poster);
    placeMedia(poster, it, current);
    if (current) {
      const url = await fileURL(it.id);
      if (slide.dataset.id !== token || !url) return;
      const v = el('video', { playsinline: '', preload: 'metadata', src: url, poster: turl });
      v.style.objectFit = 'contain';
      v.style.background = '#000';
      const play = el('button', { class: 'vplay glass', 'aria-label': 'Reproduzir', html: I.play });
      play.addEventListener('click', () => { v.controls = true; v.play(); play.hidden = true; });
      v.addEventListener('ended', () => { play.hidden = false; v.controls = false; });
      slide.textContent = '';
      slide.append(v, play);
      placeMedia(v, it, true);
    }
    return;
  }
  const img = el('img', { alt: '', draggable: 'false', src: turl });
  img.style.objectFit = 'cover';
  slide.append(img);
  placeMedia(img, it, current);
  const url = await fileURL(it.id);
  if (!url || slide.dataset.id !== token) return;
  const full = new Image();
  full.decoding = 'async';
  full.onload = () => {
    if (slide.dataset.id !== token || !img.isConnected) return;
    img.src = url; img.style.objectFit = 'fill';
  };
  full.src = url;
}

function renderSlides() {
  V.slides.forEach((s, i) => { fillSlide(s, item(V.idx + i - 1), i === 1); });
  positionSlides();
}

function applyZoom(anim = false) {
  const m = V.slides[1].firstChild;
  if (!m) return;
  m.style.transition = anim ? 'transform .3s cubic-bezier(.2,.8,.2,1), top .38s cubic-bezier(.2,.85,.25,1)' : '';
  m.style.transform = V.zoom.s === 1 && !V.zoom.x && !V.zoom.y ? '' : `translate(${V.zoom.x}px,${V.zoom.y}px) scale(${V.zoom.s})`;
}

function resetZoom(anim = false) { V.zoom = { s: 1, x: 0, y: 0 }; applyZoom(anim); }

/* ------------------------------------------------------------------ cabeçalho / barra / fita */
function refreshChrome() {
  const it = item();
  if (!it) return;
  const t = $('#vTitle');
  t.firstElementChild.textContent = fmtDayLabel(it.taken);
  t.lastElementChild.textContent = fmtTime(it.taken);
  $('#vFav').innerHTML = it.fav ? I.heartFill : I.heart;
  $('#vInfoBtn').innerHTML = V.info ? I.infoFill : I.info;
}

const stripIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    stripIO.unobserve(e.target);
    const id = V.ids[+e.target.dataset.i];
    thumbURL(id).then((u) => { if (u) e.target.style.backgroundImage = `url(${u})`; });
  }
}, { root: strip, rootMargin: '0px 240px' });

function buildStrip() {
  stripInner.textContent = '';
  const frag = document.createDocumentFragment();
  V.ids.forEach((id, i) => {
    const d = el('div', { class: 'st', 'data-i': i });
    frag.append(d);
  });
  stripInner.append(frag);
  $$st().forEach((d) => stripIO.observe(d));
  syncStrip(true);
}
const $$st = () => [...stripInner.children];

let stripTouch = false, stripProg = 0, stripTimer;
function syncStrip(jump = false) {
  const kids = stripInner.children;
  for (const k of stripInner.querySelectorAll('.cur')) k.classList.remove('cur');
  if (kids[V.idx]) kids[V.idx].classList.add('cur');
  if (stripTouch) return;
  stripProg = performance.now() + 160;
  strip.scrollTo({ left: V.idx * THUMB_W, behavior: jump ? 'auto' : 'auto' });
}

strip.addEventListener('touchstart', () => { stripTouch = true; }, { passive: true });
strip.addEventListener('pointerdown', () => { stripTouch = true; });
const endStripTouch = () => { clearTimeout(stripTimer); stripTimer = setTimeout(() => { stripTouch = false; }, 450); };
strip.addEventListener('touchend', endStripTouch, { passive: true });
strip.addEventListener('pointerup', endStripTouch);
strip.addEventListener('scroll', () => {
  if (!stripTouch || performance.now() < stripProg) return;
  const i = clamp(Math.round(strip.scrollLeft / THUMB_W), 0, V.ids.length - 1);
  if (i !== V.idx) goTo(i, true);
  endStripTouch();
}, { passive: true });
strip.addEventListener('click', (e) => {
  const st = e.target.closest('.st');
  if (st) goTo(+st.dataset.i);
});

/* ------------------------------------------------------------------ navegação entre itens */
function goTo(i, fromStrip = false) {
  i = clamp(i, 0, V.ids.length - 1);
  if (i === V.idx && V.slides[1].dataset.id === V.ids[i]) return;
  V.idx = i;
  stopVideos();
  resetZoom();
  renderSlides();
  refreshChrome();
  const kids = stripInner.children;
  for (const k of stripInner.querySelectorAll('.cur')) k.classList.remove('cur');
  if (kids[i]) kids[i].classList.add('cur');
  if (!fromStrip && !stripTouch) { stripProg = performance.now() + 160; strip.scrollTo({ left: i * THUMB_W, behavior: 'auto' }); }
  if (V.info) renderInfo();
}

function stopVideos() { stage.querySelectorAll('video').forEach((v) => v.pause()); }

function rotate(dir) {
  // dir: +1 = próximo, -1 = anterior
  if (dir > 0) { const s = V.slides.shift(); V.slides.push(s); } else { const s = V.slides.pop(); V.slides.unshift(s); }
  V.idx += dir;
  stopVideos();
  resetZoom();
  positionSlides();
  // slide recém-entrado nas pontas precisa de conteúdo novo; o central já está pronto
  const cur = V.slides[1];
  const it = item();
  if (cur.dataset.id !== (it && it.id)) fillSlide(cur, it, true);
  else if (it && it.type === 'video') fillSlide(cur, it, true);
  else { const m = cur.firstChild; if (m) placeMedia(m, it, true); }
  const edge = dir > 0 ? V.slides[2] : V.slides[0];
  fillSlide(edge, item(V.idx + dir), false);
  // o slide que saiu do centro volta a ser "não atual"
  const other = dir > 0 ? V.slides[0] : V.slides[2];
  const om = other.firstChild;
  if (om && om.tagName === 'VIDEO') fillSlide(other, item(V.idx - dir), false);
  refreshChrome();
  syncStrip();
  if (V.info) renderInfo();
}

/* ------------------------------------------------------------------ gestos */
const g = { ptrs: new Map(), mode: null, sx: 0, sy: 0, t0: 0, last: { t: 0, x: 0, y: 0 }, tapTimer: 0, pinch: null, pan0: null, ignoreTap: false, dx: 0, dy: 0 };

stage.addEventListener('pointerdown', (e) => {
  if (!V.open || V.info || V.busy) return;
  if (e.target.closest && e.target.closest('.vplay')) return;
  if (e.target.tagName === 'VIDEO' && e.target.controls) {
    const r = e.target.getBoundingClientRect();
    if (e.clientY > r.bottom - 70) return; // deixa os controles nativos do vídeo
  }
  stage.setPointerCapture(e.pointerId);
  g.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (g.ptrs.size === 1) {
    g.mode = null; g.sx = e.clientX; g.sy = e.clientY; g.t0 = performance.now(); g.ignoreTap = false; g.dx = g.dy = 0;
    g.pan0 = { x: V.zoom.x, y: V.zoom.y };
  } else if (g.ptrs.size === 2) {
    const [a, b] = [...g.ptrs.values()];
    const r = viewer.getBoundingClientRect();
    g.mode = 'pinch'; g.ignoreTap = true;
    g.pinch = {
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: V.zoom.s, t0: { x: V.zoom.x, y: V.zoom.y },
      p0: { x: (a.x + b.x) / 2 - r.left - V.W / 2, y: (a.y + b.y) / 2 - r.top - V.H / 2 },
    };
    positionSlides(0);
  }
});

stage.addEventListener('pointermove', (e) => {
  if (!g.ptrs.has(e.pointerId)) return;
  g.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (g.mode === 'pinch' && g.ptrs.size >= 2) {
    const [a, b] = [...g.ptrs.values()];
    const r = viewer.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const s = clamp(g.pinch.s0 * (d / g.pinch.d0), 0.8, 6);
    const p1 = { x: (a.x + b.x) / 2 - r.left - V.W / 2, y: (a.y + b.y) / 2 - r.top - V.H / 2 };
    const k = s / g.pinch.s0;
    V.zoom = { s, x: p1.x - k * (g.pinch.p0.x - g.pinch.t0.x), y: p1.y - k * (g.pinch.p0.y - g.pinch.t0.y) };
    applyZoom();
    return;
  }
  if (g.ptrs.size !== 1) return;
  const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
  g.dx = dx; g.dy = dy;
  if (!g.mode) {
    if (Math.hypot(dx, dy) < 8) return;
    if (V.zoom.s > 1.02) g.mode = 'pan';
    else g.mode = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
  }
  if (g.mode === 'h') {
    const atStart = V.idx === 0 && dx > 0, atEnd = V.idx === V.ids.length - 1 && dx < 0;
    positionSlides(atStart || atEnd ? dx / 3 : dx);
  } else if (g.mode === 'v') {
    dragVertical(dy);
  } else if (g.mode === 'pan') {
    V.zoom.x = g.pan0.x + dx; V.zoom.y = g.pan0.y + dy;
    applyZoom();
  }
});

function dragVertical(dy) {
  const cur = V.slides[1];
  if (dy > 0) {
    const k = clamp(dy / (V.H * 0.6), 0, 1);
    cur.style.transition = 'none';
    cur.style.transform = `translate3d(0,${dy}px,0) scale(${1 - k * 0.35})`;
    $('.v-bg', viewer).style.opacity = String(1 - k * 1.1);
    viewer.classList.add('dragging');
    $('#vHeader').style.opacity = $('#vToolbar').style.opacity = $('#vStrip').style.opacity = String(Math.max(0, 1 - k * 4));
  } else {
    cur.style.transition = 'none';
    cur.style.transform = `translate3d(0,${dy / 2.2}px,0)`;
  }
}

function resetVertical(anim = true) {
  const cur = V.slides[1];
  cur.style.transition = anim ? 'transform .3s cubic-bezier(.2,.8,.2,1)' : 'none';
  cur.style.transform = `translate3d(0,0,0)`;
  $('.v-bg', viewer).style.opacity = '';
  $('#vHeader').style.opacity = $('#vToolbar').style.opacity = $('#vStrip').style.opacity = '';
  viewer.classList.remove('dragging');
}

function endPointer(e) {
  if (!g.ptrs.has(e.pointerId)) return;
  const wasMode = g.mode;
  g.ptrs.delete(e.pointerId);
  const dt = Math.max(1, performance.now() - g.t0);

  if (wasMode === 'pinch') {
    if (g.ptrs.size === 0) { settleZoom(); g.mode = null; }
    else if (g.ptrs.size === 1) { // um dedo ficou: vira pan
      const [p] = [...g.ptrs.values()];
      g.sx = p.x; g.sy = p.y; g.pan0 = { x: V.zoom.x, y: V.zoom.y }; g.mode = 'pan';
    }
    return;
  }
  if (g.ptrs.size > 0) return;

  if (wasMode === 'h') {
    const vx = g.dx / dt;
    let dir = 0;
    if ((g.dx < -V.W * 0.22 || vx < -0.45) && V.idx < V.ids.length - 1) dir = 1;
    else if ((g.dx > V.W * 0.22 || vx > 0.45) && V.idx > 0) dir = -1;
    if (dir) {
      V.busy = true;
      positionSlides(-dir * (V.W + GAP), true);
      setTimeout(() => { rotate(dir); V.busy = false; }, 300);
    } else positionSlides(0, true);
  } else if (wasMode === 'v') {
    const vy = g.dy / dt;
    if (g.dy > 110 || vy > 0.7) closeViewer({ fromDrag: true, dy: g.dy });
    else if (g.dy < -70 || vy < -0.7) { resetVertical(); openInfo(); }
    else resetVertical();
  } else if (wasMode === 'pan') {
    settleZoom();
  } else if (!g.ignoreTap && Math.hypot(g.dx, g.dy) < 10 && dt < 500) {
    handleTap(e);
  }
  g.mode = null;
}
stage.addEventListener('pointerup', endPointer);
stage.addEventListener('pointercancel', endPointer);

function settleZoom() {
  if (V.zoom.s < 1.05) { resetZoom(true); return; }
  // limita o arrasto às bordas da foto ampliada
  const it = item();
  const { w, h } = fit(it);
  const maxX = Math.max(0, (w * V.zoom.s - V.W) / 2), maxY = Math.max(0, (h * V.zoom.s - V.H) / 2);
  V.zoom.x = clamp(V.zoom.x, -maxX, maxX);
  V.zoom.y = clamp(V.zoom.y, -maxY, maxY);
  if (V.zoom.s > 5) V.zoom.s = 5;
  applyZoom(true);
}

function handleTap(e) {
  const now = performance.now();
  const l = g.last;
  if (now - l.t < 320 && Math.hypot(e.clientX - l.x, e.clientY - l.y) < 40) {
    clearTimeout(g.tapTimer);
    g.last = { t: 0, x: 0, y: 0 };
    doubleTap(e);
    return;
  }
  g.last = { t: now, x: e.clientX, y: e.clientY };
  clearTimeout(g.tapTimer);
  g.tapTimer = setTimeout(() => {
    if (e.target && e.target.tagName === 'VIDEO') return;
    toggleChrome();
  }, 260);
}

function doubleTap(e) {
  const it = item();
  if (!it || it.type === 'video') return;
  if (V.zoom.s > 1.05) { resetZoom(true); return; }
  const r = viewer.getBoundingClientRect();
  const s = 2.6;
  const px = e.clientX - r.left - V.W / 2, py = e.clientY - r.top - V.H / 2;
  V.zoom = { s, x: (1 - s) * px, y: (1 - s) * py };
  settleZoom();
}

function toggleChrome() {
  V.chromeOff = !V.chromeOff;
  viewer.classList.toggle('chrome-off', V.chromeOff);
}

stage.addEventListener('wheel', (e) => { // desktop: rolagem horizontal troca de foto
  if (!V.open || V.info) return;
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 30 && !V.busy) { e.preventDefault(); step(e.deltaX > 0 ? 1 : -1); }
}, { passive: false });

function step(dir) {
  if (V.busy) return;
  if (dir > 0 && V.idx >= V.ids.length - 1) return;
  if (dir < 0 && V.idx <= 0) return;
  V.busy = true;
  positionSlides(-dir * (V.W + GAP), true);
  setTimeout(() => { rotate(dir); V.busy = false; }, 300);
}

document.addEventListener('keydown', (e) => {
  if (!V.open) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'Escape') closeViewer();
});

/* ------------------------------------------------------------------ FLIP (abrir/fechar a partir da miniatura) */
function cellRectFor(id) {
  if (!V.grid) return null;
  const c = V.grid.querySelector(`.cell[data-id="${CSS.escape(id)}"]`);
  return c || null;
}

function flip(media, it, cellRect, reverse, done) {
  const app = $('#app').getBoundingClientRect();
  const { w, h } = fit(it);
  const fx = app.left + (V.W - w) / 2 + w / 2;
  const fy = app.top + (V.info ? 0 : (V.H - h) / 2) + h / 2;
  const side = Math.min(w, h);
  const s = cellRect.width / side;
  const dx = cellRect.left + cellRect.width / 2 - fx;
  const dy = cellRect.top + cellRect.height / 2 - fy;
  const ix = (w - side) / 2, iy = (h - side) / 2;
  const from = { transform: `translate(${dx}px,${dy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px)` };
  const to = { transform: 'translate(0px,0px) scale(1)', clipPath: 'inset(0px 0px)' };
  const anim = media.animate(reverse ? [to, from] : [from, to], { duration: 420, easing: 'cubic-bezier(.2,.85,.25,1)', fill: 'both' });
  anim.onfinish = () => { anim.cancel(); done && done(); };
}

/* ------------------------------------------------------------------ abrir / fechar */
export function openViewer({ ids, index, grid, onClose }) {
  viewer.hidden = false;
  measure();
  V.ids = [...ids]; V.idx = index; V.grid = grid || null; V.onClose = onClose || null;
  V.info = false; V.chromeOff = false; V.busy = false;
  viewer.classList.remove('info-on', 'chrome-off', 'dragging');
  $('#vHeader').style.opacity = $('#vToolbar').style.opacity = $('#vStrip').style.opacity = '';
  stage.style.clipPath = ''; stage.style.transform = '';
  $('.v-bg', viewer).style.opacity = '';
  stage.textContent = '';
  V.slides = [0, 1, 2].map(() => stage.appendChild(el('div', { class: 'slide' })));
  viewer.hidden = false;
  V.open = true;
  document.body.classList.add('in-viewer');
  resetZoom();
  renderSlides();
  refreshChrome();
  buildStrip();

  // animação de entrada a partir da miniatura
  const it = item();
  const cell = cellRectFor(it.id);
  const bg = $('.v-bg', viewer);
  bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
  const chrome = [$('#vHeader'), $('#vToolbar'), $('#vStrip')];
  chrome.forEach((c) => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 120, easing: 'ease-out', fill: 'backwards' }));
  if (cell) {
    const r = cell.getBoundingClientRect();
    requestAnimationFrame(() => {
      const m = V.slides[1].firstChild;
      if (m) flip(m, it, r, false);
    });
  } else {
    V.slides[1].animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'ease-out' });
  }
  pushLayer('viewer', hideViewer);
}

export function viewerIsOpen() { return V.open; }

function hideViewer() {
  if (!V.open) return;
  V.open = false;
  stopVideos();
  // limpa animações/estilos deixados pela animação de fechar (senão a próxima abertura fica transparente)
  $('.v-bg', viewer).getAnimations().forEach((a) => a.cancel());
  for (const sel of ['#vHeader', '#vToolbar', '#vStrip']) {
    const c = $(sel);
    c.getAnimations().forEach((a) => a.cancel());
    c.style.transition = ''; c.style.opacity = '';
  }
  viewer.hidden = true;
  viewer.classList.remove('info-on', 'chrome-off', 'dragging');
  document.body.classList.remove('in-viewer');
  stage.textContent = '';
  info.textContent = '';
  V.onClose && V.onClose();
}

export function closeViewer({ fromDrag = false, dy = 0 } = {}) {
  if (!V.open || V.closing) return;
  V.closing = true;
  stopVideos();
  const it = item();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    V.closing = false;
    hideViewer();
    closeLayer('viewer');
  };
  setTimeout(finish, 800); // garantia caso a animação não termine
  // garante que a miniatura de destino esteja visível
  let cell = it && cellRectFor(it.id);
  if (cell && V.grid) {
    const r = cell.getBoundingClientRect();
    const app = $('#app').getBoundingClientRect();
    if (r.bottom < app.top + 80 || r.top > app.bottom - 80) cell.scrollIntoView({ block: 'center' });
  }
  const rect = cell && cell.getBoundingClientRect();
  const m = V.slides[1] && V.slides[1].firstChild;
  const bg = $('.v-bg', viewer);
  const off = rect && rect.bottom > 0 && rect.top < window.innerHeight;
  if (V.info) { V.info = false; viewer.classList.remove('info-on'); }
  if (off && m) {
    resetZoom();
    V.slides[1].style.transition = 'none'; V.slides[1].style.transform = 'translate3d(0,0,0)';
    bg.animate([{ opacity: parseFloat(getComputedStyle(bg).opacity) || 1 }, { opacity: 0 }], { duration: 340, easing: 'ease-in', fill: 'forwards' });
    ['#vHeader', '#vToolbar', '#vStrip'].forEach((s) => { const c = $(s); c.style.transition = 'opacity .15s'; c.style.opacity = '0'; });
    flip(m, it, rect, true, finish);
    m.style.visibility = 'visible';
  } else {
    const cur = V.slides[1];
    cur.style.transition = 'transform .28s ease-in, opacity .28s ease-in';
    cur.style.transform = `translate3d(0,${fromDrag ? Math.max(dy, 200) : 120}px,0) scale(.8)`;
    cur.style.opacity = '0';
    bg.animate([{ opacity: parseFloat(getComputedStyle(bg).opacity) || 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
    ['#vHeader', '#vToolbar', '#vStrip'].forEach((s) => { const c = $(s); c.style.transition = 'opacity .15s'; c.style.opacity = '0'; });
    setTimeout(finish, 290);
  }
}

/* ------------------------------------------------------------------ painel de informações */
function camLine(c) {
  const f35 = c.focal35 || c.focal;
  let name = '';
  const lens = (c.lens || '').toLowerCase();
  if (lens.includes('front') || lens.includes('frontal')) name = 'Câmera Frontal';
  else if (f35) {
    if (f35 < 18) name = 'Câmera Ultra-Angular';
    else if (f35 < 40) name = 'Câmera Principal';
    else name = 'Câmera Teleobjetiva';
  }
  const parts = [];
  if (f35) parts.push(`${Math.round(f35)} mm`);
  if (c.fnumber) parts.push(fmtF(c.fnumber));
  if (!name && !parts.length) return '';
  return `${name}${name && parts.length ? ' — ' : ''}${parts.join(' ')}`;
}

function modelName(c) {
  const make = (c.make || '').trim(), model = (c.model || '').trim();
  if (!model) return make;
  if (make && model.toLowerCase().startsWith(make.toLowerCase())) return model;
  return `${make} ${model}`.trim();
}

function megapixels(it) {
  const mp = (it.width * it.height) / 1e6;
  return mp < 1 ? `${mp.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MP` : `${Math.round(mp)} MP`;
}

function renderInfo() {
  const it = item();
  if (!it) return;
  info.textContent = '';
  const H = infoHeight(it);
  viewer.style.setProperty('--info-h', H + 'px');

  const cap = el('input', { class: 'cap-field', type: 'text', placeholder: 'Adicione uma Legenda', value: it.caption || '', enterkeyhint: 'done' });
  cap.addEventListener('change', async () => { it.caption = cap.value.trim(); await saveItem(it); });
  cap.addEventListener('keydown', (e) => { if (e.key === 'Enter') cap.blur(); });

  const adj = el('button', { class: 'adj', onclick: () => openDateSheet([it]) }, 'Ajustes');
  const card = el('div', { class: 'info-card' },
    el('div', { class: 'irow head' },
      el('div', {},
        el('div', { class: 'date' }, fmtFull(it.taken)),
        el('div', { class: 'file' }, el('span', { html: I.cloud }), it.name)),
      adj));

  const c = it.camera;
  const kind = it.type === 'video' ? 'Vídeo' : 'Foto';
  card.append(el('div', { class: 'irow cam' }, el('b', {}, c && modelName(c) ? modelName(c) : kind), el('span', { class: 'badge' }, it.format || 'IMG')));
  const specs = `${megapixels(it)} · ${fmtNum(it.width)} × ${fmtNum(it.height)} · ${fmtSize(it.size)}`;
  const line = c ? camLine(c) : '';
  card.append(el('div', { class: 'irow lens' }, line ? el('div', {}, line) : null,
    el('div', {}, it.type === 'video' && it.duration ? `${specs} · ${Math.round(it.duration)} s` : specs)));
  if (c && (c.iso || c.exposure || c.fnumber)) {
    const mm = c.focal35 || c.focal;
    card.append(el('div', { class: 'irow exif' },
      el('div', {}, c.iso ? `ISO ${c.iso}` : 'ISO —'),
      el('div', {}, mm ? `${Math.round(mm)} mm` : '— mm'),
      el('div', {}, `${(+(c.ev || 0).toFixed(1)).toLocaleString('pt-BR')} ev`),
      el('div', {}, fmtF(c.fnumber)),
      el('div', {}, fmtExposure(c.exposure))));
  }

  const loc = el('div', { class: 'info-card' },
    el('button', { class: 'ilink', onclick: () => textSheet({
      title: 'Local', label: 'Digite o nome do local desta foto.', value: it.location || '', placeholder: 'Ex.: Rio de Janeiro, RJ', apply: 'OK',
      onSave: async (v) => { it.location = v; await saveItem(it); },
    }) }, it.location ? el('span', {}, el('span', { class: 'val' }, it.location)) : 'Adicionar uma localização...'));

  const kws = it.keywords || [];
  const kwCard = el('div', { class: 'info-card' });
  if (kws.length) kwCard.append(el('div', { style: 'height:14px' }), el('div', { class: 'chips' }, kws.map((k) => el('span', { class: 'chip' }, k))));
  kwCard.append(el('button', { class: 'ilink', onclick: () => textSheet({
    title: 'Palavras-Chave', label: 'Separe as palavras-chave por vírgula.', value: kws.join(', '), placeholder: 'praia, família, viagem', apply: 'OK',
    onSave: async (v) => { it.keywords = v.split(',').map((s) => s.trim()).filter(Boolean); await saveItem(it); },
  }) }, kws.length ? 'Editar Palavras-Chave' : 'Adicionar Palavras-Chave'));

  info.append(el('div', { class: 'pad' }), cap, card, loc, kwCard);
}

function openInfo() {
  const it = item();
  if (!it || V.info) return;
  resetZoom(true);
  V.info = true;
  renderInfo();
  info.scrollTop = 0;
  viewer.classList.add('info-on');
  const H = infoHeight(it);
  stage.style.clipPath = `inset(0px 0px ${V.H - H}px 0px)`;
  const m = V.slides[1].firstChild;
  if (m) m.style.top = '0px';
  $('#vInfoBtn').innerHTML = I.infoFill;
}

function closeInfo() {
  if (!V.info) return;
  V.info = false;
  viewer.classList.remove('info-on');
  stage.style.clipPath = ''; stage.style.transform = '';
  const it = item();
  const m = V.slides[1].firstChild;
  if (m && it) m.style.top = (V.H - fit(it).h) / 2 + 'px';
  $('#vInfoBtn').innerHTML = I.info;
  document.activeElement && document.activeElement.blur();
}

info.addEventListener('scroll', () => {
  stage.style.transform = `translateY(${-info.scrollTop}px)`;
}, { passive: true });

// puxar para baixo no topo fecha o painel
let iy0 = null;
info.addEventListener('touchstart', (e) => { iy0 = e.touches[0].clientY; }, { passive: true });
info.addEventListener('touchend', (e) => {
  if (iy0 == null) return;
  const dy = e.changedTouches[0].clientY - iy0;
  if (dy > 90 && info.scrollTop <= 0) closeInfo();
  iy0 = null;
});

/* ------------------------------------------------------------------ botões */
$('#vBack').addEventListener('click', () => closeViewer());
$('#vInfoBtn').addEventListener('click', () => (V.info ? closeInfo() : openInfo()));
$('#vAdjust').addEventListener('click', () => { const it = item(); if (it) openDateSheet([it]); });
$('#vShare').addEventListener('click', () => { const it = item(); if (it) shareItems([it]); });
$('#vFav').addEventListener('click', async () => {
  const it = item(); if (!it) return;
  await setFav([it], !it.fav);
  const b = $('#vFav');
  b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 260 });
});
$('#vTrash').addEventListener('click', () => {
  const it = item(); if (!it) return;
  askTrash([it], () => removeCurrent());
});
$('#vMore').addEventListener('click', (e) => {
  const it = item(); if (!it) return;
  showMenu(e.currentTarget, [
    { label: 'Ajustar Data e Hora', icon: 'calendar', onClick: () => openDateSheet([it]) },
    { label: 'Duplicar', icon: 'copy', onClick: () => duplicateItems([it]) },
    { label: 'Salvar no Aparelho', icon: 'save', onClick: () => shareItems([it], { forceDownload: true }) },
    ...(it.edited ? [{ label: 'Reverter Data e Hora', icon: 'revert', onClick: () => revertDates([it]) }] : []),
    { sep: true },
    { label: V.info ? 'Ocultar Informações' : 'Informações', icon: 'info', onClick: () => (V.info ? closeInfo() : openInfo()) },
  ]);
});

function removeCurrent() {
  V.ids.splice(V.idx, 1);
  if (!V.ids.length) { closeViewer(); return; }
  V.idx = Math.min(V.idx, V.ids.length - 1);
  if (V.info) closeInfo();
  resetZoom();
  renderSlides();
  refreshChrome();
  buildStrip();
}

onChange(() => {
  if (!V.open) return;
  refreshChrome();
  if (V.info) {
    // mantém o foco/rolagem do painel enquanto atualiza os dados
    if (document.activeElement === info.querySelector('.cap-field')) return;
    const st = info.scrollTop;
    renderInfo();
    info.scrollTop = st;
  }
});

window.addEventListener('resize', () => {
  if (!V.open) return;
  measure();
  V.slides.forEach((s, i) => { const m = s.firstChild; const it = item(V.idx + i - 1); if (m && it) placeMedia(m, it, i === 1); });
  positionSlides();
  if (V.info) { const it = item(); stage.style.clipPath = `inset(0px 0px ${V.H - infoHeight(it)}px 0px)`; }
});
