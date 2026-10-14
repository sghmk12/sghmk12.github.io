/**
 * The site's photo pipeline: decode (HEIC via macOS `sips`), turn upright,
 * crop to width×height around the most detailed region, and write AVIF + WebP
 * at each of `widths`. Also writes an uncropped `-full` copy (longest edge up
 * to FULL_EDGE) for the click-to-enlarge view. Only pixels are kept — GPS,
 * camera and date metadata are dropped.
 *
 * Also a CLI for one-off images (interests, portrait…):
 *
 *   npm run photo -- ~/Downloads/bike.heic interests/cycling 1200x1500 [position]
 *
 * writes public/images/interests/cycling-{600,1200,full}.{avif,webp} (half,
 * full width, uncropped) and prints the dominant colour for use as a loading
 * placeholder.
 * `position` anchors the crop instead of the automatic choice: top, bottom,
 * left, right, centre, or a corner such as "left bottom".
 */
import sharp from 'sharp';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';

export const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.heic', '.heif']);
const HEIC = new Set(['.heic', '.heif']);
const FULL_EDGE = 1600;

const hex = ({ r, g, b }) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;

/** Writes `${outBase}-${w}.avif|webp` for each width plus `-full`; returns the dominant colour. */
export async function convertPhoto(input, outBase, { width, height, widths, position = sharp.strategy.attention }) {
  const tmp = mkdtempSync(join(tmpdir(), 'photo-'));
  try {
    if (HEIC.has(extname(input).toLowerCase())) {
      // sharp's prebuilt binaries can't read HEVC, so decode to a high-quality,
      // size-capped JPEG first; sips keeps the EXIF rotation flag.
      const jpeg = join(tmp, 'decoded.jpg');
      execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '95', '-Z', '2400', input, '--out', jpeg], { stdio: 'ignore' });
      input = jpeg;
    }

    // By default `attention` keeps the most detailed region instead of the dead
    // centre. Raw pixels carry no metadata into the encoders below.
    const { data, info } = await sharp(input)
      .autoOrient()
      .resize(width, height, { fit: 'cover', position })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = () => sharp(data, { raw: info });

    mkdirSync(dirname(outBase), { recursive: true });
    for (const w of widths) {
      await pixels().resize(w).avif({ quality: 50 }).toFile(`${outBase}-${w}.avif`);
      await pixels().resize(w).webp({ quality: 78 }).toFile(`${outBase}-${w}.webp`);
    }

    // The whole photo, never enlarged, for the click-to-enlarge view.
    const full = await sharp(input)
      .autoOrient()
      .resize(FULL_EDGE, FULL_EDGE, { fit: 'inside', withoutEnlargement: true })
      .raw()
      .toBuffer({ resolveWithObject: true });
    const fullPixels = () => sharp(full.data, { raw: full.info });
    await fullPixels().avif({ quality: 50 }).toFile(`${outBase}-full.avif`);
    await fullPixels().webp({ quality: 78 }).toFile(`${outBase}-full.webp`);

    return hex((await pixels().stats()).dominant);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [photo, name, size = '1200x1500', position] = process.argv.slice(2);
  if (!photo || !name) {
    console.error('Usage: npm run photo -- <photo> <name, e.g. interests/cycling> [WIDTHxHEIGHT] [position]');
    process.exit(1);
  }
  const [width, height] = size.split('x').map(Number);
  const widths = [Math.round(width / 2), width];
  const tone = await convertPhoto(resolve(photo), resolve(import.meta.dirname, '../public/images', name), { width, height, widths, position });
  console.log(`✓ images/${name}-{${widths.join(',')},full}.{avif,webp}  placeholder colour ${tone}`);
}
