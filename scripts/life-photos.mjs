/**
 * Turns a folder of photos into small tiles for the "Life lately" grid:
 * square-cropped AVIF + WebP at each width in WIDTHS, written to
 * public/images/life/ by the shared pipeline in convert-photo.mjs (which also
 * strips all metadata).
 *
 *   npm run photos -- ~/Downloads/lifeLately
 *
 * New photos are added to the top of src/life-lately.json (which vite.config.js
 * turns into the grid markup); existing entries keep their order and alt text.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, parse, resolve } from 'node:path';
import { PHOTO_EXTS, convertPhoto } from './convert-photo.mjs';

const WIDTHS = [400, 800];
const root = resolve(import.meta.dirname, '..');
const OUT = resolve(root, 'public/images/life');
const MANIFEST = resolve(root, 'src/life-lately.json');

const src = process.argv[2];
if (!src) {
  console.error('Usage: npm run photos -- <folder of photos>');
  process.exit(1);
}

const slug = (file) => parse(file).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { photos: [] };
const known = new Map(manifest.photos.map((p) => [p.file, p]));
const added = [];
const max = Math.max(...WIDTHS);

for (const file of readdirSync(src).sort()) {
  if (!PHOTO_EXTS.has(extname(file).toLowerCase())) continue;

  const name = slug(file);
  // The tone is shown behind the tile while it loads.
  const tone = await convertPhoto(join(src, file), join(OUT, name), { width: max, height: max, widths: WIDTHS });
  if (known.has(name)) known.get(name).tone = tone;
  else added.push({ file: name, alt: '', tone });
  console.log(`✓ ${file} → images/life/${name}-*`);
}

manifest.widths = WIDTHS;
manifest.photos = [...added, ...manifest.photos];
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
if (added.length) console.log(`\n${added.length} new photo(s) added to the top of src/life-lately.json — fill in their alt text.`);
