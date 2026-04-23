const svg = (content: string, size = 16): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

const svgFilled = (content: string, size = 16): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor">${content}</svg>`;

export const ICONS = {
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  forward: svg('<path d="m9 18 6-6-6-6"/>'),
  reload: svg(
    '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>' +
    '<path d="M21 3v5h-5"/>' +
    '<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>' +
    '<path d="M8 16H3v5"/>',
  ),
  starEmpty: svg(
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  ),
  starFilled: svg(
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>',
  ),
  menu: svgFilled(
    '<circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>',
  ),
  float: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>'),
  sun: svg(
    '<circle cx="12" cy="12" r="4"/>' +
    '<line x1="12" y1="2" x2="12" y2="6"/>' +
    '<line x1="12" y1="18" x2="12" y2="22"/>' +
    '<line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>' +
    '<line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>' +
    '<line x1="2" y1="12" x2="6" y2="12"/>' +
    '<line x1="18" y1="12" x2="22" y2="12"/>' +
    '<line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>' +
    '<line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>',
    14,
  ),
  moon: svg('<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>', 14),
  bookmarks: svg(
    '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    14,
  ),
  history: svg(
    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    14,
  ),
  downloads: svg(
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
    '<polyline points="7 10 12 15 17 10"/>' +
    '<line x1="12" y1="15" x2="12" y2="3"/>',
    14,
  ),
  plus: svg('<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>', 14),
  bookmarkBar: svg(
    '<rect x="2" y="3" width="20" height="4" rx="1"/>' +
    '<line x1="2" y1="11" x2="22" y2="11"/>' +
    '<line x1="2" y1="15" x2="16" y2="15"/>',
    14,
  ),
  floatSearch: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>', 14),
  check: svg('<polyline points="20 6 9 17 4 12"/>', 14),
  stop: svgFilled('<rect x="6" y="6" width="12" height="12" rx="1.5"/>'),
} as const;
