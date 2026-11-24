// Ícones SVG (traço, estilo SF Symbols). Desenhados à mão; usam currentColor.
const s = (body, w = 24, extra = '') =>
  `<svg viewBox="0 0 ${w} ${w}" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const I = {
  share: s('<path d="M12 14.5V3.5M8 7l4-4 4 4M8.5 10H7a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2h-1.5"/>'),
  heart: s('<path d="M12 20.6S3.2 15.4 3 9.2C2.9 6.3 5 4.3 7.5 4.3c1.9 0 3.5 1 4.5 2.7 1-1.7 2.6-2.7 4.5-2.7C19 4.3 21.1 6.3 21 9.2c-.2 6.2-9 11.4-9 11.4z"/>'),
  heartFill: s('<path d="M12 20.6S3.2 15.4 3 9.2C2.9 6.3 5 4.3 7.5 4.3c1.9 0 3.5 1 4.5 2.7 1-1.7 2.6-2.7 4.5-2.7C19 4.3 21.1 6.3 21 9.2c-.2 6.2-9 11.4-9 11.4z" fill="currentColor"/>'),
  info: s('<circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.6"/><circle cx="12" cy="7.7" r=".6" fill="currentColor"/>'),
  infoFill: s('<circle cx="12" cy="12" r="10.4" fill="currentColor" stroke="none"/><path d="M12 11v5.6" stroke="#2c2c2e"/><circle cx="12" cy="7.7" r=".6" fill="#2c2c2e" stroke="#2c2c2e"/>'),
  sliders: s('<path d="M4 7h4M16.5 7H20M4 17h9M19 17h1"/><circle cx="12.2" cy="7" r="2.6"/><circle cx="16" cy="17" r="2.6"/><path d="M4 12h1M11 12h9"/><circle cx="8" cy="12" r="2.6"/>'),
  trash: s('<path d="M4 6.8h16M9.2 6.8V4.4a.9.9 0 0 1 .9-.9h3.8a.9.9 0 0 1 .9.9v2.4M6.2 6.8l.9 12.3a1.8 1.8 0 0 0 1.8 1.7h6.2a1.8 1.8 0 0 0 1.8-1.7l.9-12.3M10 10.6v6.2M14 10.6v6.2"/>'),
  back: s('<path d="M14.8 4.5 7.3 12l7.5 7.5"/>', 24, 'stroke-width="2.4"'),
  chevR: s('<path d="M9 5l7 7-7 7"/>', 24, 'stroke-width="2.4"'),
  dots: s('<circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/>'),
  filter: s('<path d="M4 7h16M7 12h10M10 17h4"/>', 24, 'stroke-width="2.2"'),
  search: s('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 20 20"/>', 24, 'stroke-width="2.4"'),
  cloud: s('<path d="M7.2 18.5h9.6a4 4 0 0 0 .6-7.95A5.6 5.6 0 0 0 6.6 9.4 4.5 4.5 0 0 0 7.2 18.5z"/><path d="M9.6 14.2l1.7 1.7 3.2-3.5"/>', 24, 'stroke-width="1.7"'),
  check: s('<path d="M5 12.6l4.4 4.4L19 7.2"/>', 24, 'stroke-width="3"'),
  xmark: s('<path d="M6 6l12 12M18 6 6 18"/>', 24, 'stroke-width="2.4"'),
  plus: s('<path d="M12 5v14M5 12h14"/>', 24, 'stroke-width="2.4"'),
  play: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor"><path d="M7 4.6v14.8a1 1 0 0 0 1.5.9l12-7.4a1 1 0 0 0 0-1.7l-12-7.4A1 1 0 0 0 7 4.6z"/></svg>',
  calendar: s('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  copy: s('<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 6.5V13a2.5 2.5 0 0 0 2.5 2.5h2"/>'),
  save: s('<path d="M12 3.5v11M7.8 10.8 12 15l4.2-4.2M4.5 15.5v2.5a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-2.5"/>'),
  revert: s('<path d="M4.5 9.5h9a5 5 0 0 1 0 10H9M4.5 9.5 8.5 5.5M4.5 9.5l4 4"/>'),
  pin: s('<path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0C5.5 15 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/>'),
  tag: s('<path d="M3.8 12.4V5.6c0-1 .8-1.8 1.8-1.8h6.8l8.2 8.2a1.8 1.8 0 0 1 0 2.5l-6.8 6.8a1.8 1.8 0 0 1-2.5 0z"/><circle cx="8.3" cy="8.3" r="1.2" fill="currentColor"/>'),
  // abas
  photoStack: '<svg viewBox="0 0 32 32" width="1em" height="1em"><path d="M8 3.6h16a2.4 2.4 0 0 1 2.4 2.4v.4H5.6V6A2.4 2.4 0 0 1 8 3.6z" fill="currentColor" opacity=".6"/><path d="M5.6 8h20.8a2.6 2.6 0 0 1 2.6 2.6v14a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 24.6v-14A2.6 2.6 0 0 1 5.6 8z" fill="currentColor"/><path d="M3 24.6l6.6-7a1.6 1.6 0 0 1 2.3 0l3.2 3.4 4.4-5.2a1.6 1.6 0 0 1 2.5.1L29 21.4v3.2a2.6 2.6 0 0 1-2.6 2.6H5.6A2.6 2.6 0 0 1 3 24.6z" fill="#000" opacity=".38"/><circle cx="21.6" cy="13.8" r="2.2" fill="#000" opacity=".38"/></svg>',
  rectStack: '<svg viewBox="0 0 32 32" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M8 5h16M5.6 9h20.8"/><rect x="3.6" y="12.6" width="24.8" height="15.6" rx="3.2"/></svg>',
};
