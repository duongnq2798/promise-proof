const paths = {
  check: '<path d="m5 10 3 3 7-7"/>',
  cross: '<path d="m6 6 8 8m0-8-8 8"/>',
  minus: '<path d="M5 10h10"/>',
  alert: '<path d="m10 3 8 14H2L10 3Z"/><path d="M10 7v4m0 3v.1"/>',
  grid: '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/>',
  workflow:
    '<circle cx="5" cy="4" r="2"/><circle cx="15" cy="10" r="2"/><circle cx="5" cy="16" r="2"/><path d="M5 6v8m2-10h3a5 5 0 0 1 5 4"/>',
  image:
    '<rect x="3" y="3" width="14" height="14" rx="2"/><circle cx="7" cy="7" r="1"/><path d="m3 14 4-4 3 3 3-4 4 5"/>',
  document:
    '<path d="M12 2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"/><path d="M12 2v5h5M7 11h6m-6 3h4"/>',
  arrow: '<path d="M5 15 15 5M6 5h9v9"/>',
  chevron: '<path d="m7 5 5 5-5 5"/>',
  clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/>',
  shield:
    '<path d="m10 2 7 3v5c0 4-7 8-7 8s-7-4-7-8V5l7-3Z"/><path d="m7 10 2 2 4-4"/>',
  sun: '<circle cx="10" cy="10" r="3"/><path d="M10 1v2m0 14v2M1 10h2m14 0h2M4 4l1 1m10 10 1 1M4 16l1-1M15 5l1-1"/>',
  moon: '<path d="M17 11a7 7 0 0 1-8-8 7 7 0 1 0 8 8Z"/>',
  monitor:
    '<rect x="2" y="3" width="16" height="11" rx="2"/><path d="M10 14v4m-4 0h8"/>',
  terminal: '<path d="m4 5 5 5-5 5m7 0h5"/>',
  layers: '<path d="m10 2 8 4-8 4-8-4 8-4Zm-8 9 8 4 8-4m-16 5 8 4 8-4"/>',
} as const;
export type ReportIcon = keyof typeof paths;
export function icon(name: ReportIcon): string {
  return (
    '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    paths[name] +
    '</svg>'
  );
}
