// Copia el worker de pdf.js a public/ para que el lector de Visbody lo cargue
// desde la misma web (funciona también sin conexión una vez cacheado).
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
];
const src = candidates.map((c) => join(root, c)).find((p) => existsSync(p));
if (!src) {
  console.warn('pdf.worker.min.mjs no encontrado: el lector de Visbody no funcionará.');
  process.exit(0);
}
mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(src, join(root, 'public/pdf.worker.min.mjs'));
console.log('pdf.worker.min.mjs copiado desde', src.replace(root + '/', ''));
