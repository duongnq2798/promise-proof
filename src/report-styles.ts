import { readFileSync } from 'node:fs';
export const reportStyles = readFileSync(
  new URL('../assets/report.css', import.meta.url),
  'utf8',
);
