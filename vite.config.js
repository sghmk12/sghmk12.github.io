import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';

const root = import.meta.dirname;
const partial = (name) => readFileSync(resolve(root, 'partials', `${name}.html`), 'utf8');
const attr = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/**
 * The "Life lately" mosaic, built from src/life-lately.json (written by
 * scripts/life-photos.mjs). Browsers pick AVIF, falling back to WebP, at the
 * smallest width that covers the tile: 3 columns on phones, 6 above.
 */
function lifeLately() {
  const { widths, photos } = JSON.parse(readFileSync(resolve(root, 'src/life-lately.json'), 'utf8'));
  const max = Math.max(...widths);
  const sizes = 'auto, (max-width: 767px) 34vw, 17vw';
  const srcset = (file, ext) => widths.map((w) => `{{root}}images/life/${file}-${w}.${ext} ${w}w`).join(', ');
  return photos
    .map(({ file, alt, tone }) =>
      `<li class="reveal" style="background-color:${tone}">` +
      `<a class="zoom" href="{{root}}images/life/${file}-full.webp" data-avif="{{root}}images/life/${file}-full.avif"><picture>` +
      `<source type="image/avif" srcset="${srcset(file, 'avif')}" sizes="${sizes}" />` +
      `<img src="{{root}}images/life/${file}-${max}.webp" srcset="${srcset(file, 'webp')}" sizes="${sizes}" ` +
      `alt="${attr(alt)}" width="${max}" height="${max}" loading="lazy" decoding="async" />` +
      `</picture></a></li>`)
    .join('\n        ');
}

/**
 * Replaces <!-- @header --> / <!-- @footer --> / <!-- @og-image --> with shared partials,
 * <!-- @life-lately --> with the photo mosaic, and {{root}} with a relative
 * path back to the site root so the build works whether it's served from a
 * domain root or a sub-folder.
 */
function partials() {
  return {
    name: 'html-partials',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const depth = relative(root, dirname(ctx.filename)).split(/[\\/]/).filter(Boolean).length;
        const rootPath = depth ? '../'.repeat(depth) : './';
        const page = relative(root, dirname(ctx.filename)) || 'home';
        return html
          .replace('<!-- @header -->', partial('header'))
          .replace('<!-- @footer -->', partial('footer'))
          .replace('<!-- @og-image -->', partial('og-image'))
          .replace('<!-- @life-lately -->', lifeLately)
          .replaceAll('{{root}}', rootPath)
          .replaceAll('{{page}}', page);
      },
    },
  };
}

/**
 * Makes the build openable straight from disk (file://) as well as from a
 * server. Chrome refuses module scripts and `crossorigin` requests on file://,
 * so the bundle (which has no imports/exports) is wrapped in an IIFE and
 * loaded as a classic deferred script.
 */
function fileProtocolFriendly() {
  return {
    name: 'file-protocol-friendly',
    apply: 'build',
    // Runs after Vite has dropped the empty per-page facade chunks, so only
    // the real bundle(s) remain.
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        for (const chunk of Object.values(bundle)) {
          if (chunk.type !== 'chunk') continue;
          if (chunk.imports.length || chunk.exports.length) {
            this.error(`${chunk.fileName} uses imports/exports and can't run as a classic script`);
          }
          chunk.code = `(()=>{${chunk.code}\n})();`;
        }
      },
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html) => html.replace(/\s+type="module"/g, ' defer').replace(/\s+crossorigin(?=[\s>])/g, ''),
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [partials(), fileProtocolFriendly()],
  build: {
    rollupOptions: {
      input: {
        home: resolve(root, 'index.html'),
        contact: resolve(root, 'contact/index.html'),
      },
    },
  },
});
