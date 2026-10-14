# personal-website-evo

A static, two-page personal site (Home, Contact) with a
fluid WebGL background, built with [Vite](https://vite.dev).

## Develop

```sh
npm install
npm run dev       # http://localhost:5173 with hot reload
```

## Build & deploy

```sh
npm run build     # outputs plain HTML/CSS/JS to dist/
npm run preview   # serve dist/ locally to check it
```

The site is hosted on Cloudflare at https://sathira.world as an assets-only Worker
(`wrangler.jsonc`, free tier). To publish changes:

```sh
npm run deploy    # vite build, then wrangler deploy (first time: npx wrangler login)
```

`public/_headers` sets cache lifetimes, and `public/robots.txt` / `public/sitemap.xml`
tell search engines and AI agents what to read. `dist/` also works on any other
static host (Netlify, GitHub Pages, S3, nginx…): all asset and page links are
relative, so it works from a domain root or a sub-folder. Pages use folder URLs
(`/contact/`), linked as `contact/index.html` so they also work when opened
straight from disk.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html`, `contact/index.html` | Page content |
| `partials/header.html`, `partials/footer.html` | Shared header and the script tag, injected at build time (see `vite.config.js`) |
| `partials/og-image.html` | Link-preview image tags (`public/images/og.jpg`, a 1200×630 screenshot of the hero) |
| `docs/` | Not part of the site: GitHub Pages serves it at https://sghmk12.github.io (Pages source: `master` `/docs`) to redirect old links to sathira.world |
| `src/style.css` | All styles; colour and type tokens at the top |
| `src/main.js` | Header hide/show, mobile menu, scroll reveals, marquee, contact form |
| `src/fluid.js` | WebGL shader for the animated background |
| `src/life-lately.json` | "Life lately" photos: order, alt text, placeholder colour — rendered into `<!-- @life-lately -->` at build time |
| `scripts/life-photos.mjs` | Converts photos into the grid's AVIF/WebP tiles (see below) |
| `public/` | Copied as-is: favicon, images (`images/life/` holds the generated tiles) |

## Customising

- **Name / copy:** edit the page HTML and `partials/header.html`.
- **Life lately photos:** unzip your photos into a folder (HEIC, JPEG, PNG… straight
  off a phone is fine), then run `npm run photos -- path/to/folder`. Each photo is
  cropped square and saved at 400px and 800px as AVIF + WebP in `public/images/life/`,
  with all metadata (including GPS location) stripped. New photos are added to the
  top of `src/life-lately.json` — write their `alt` text there, and reorder or delete
  entries to change the grid (delete a photo's files in `public/images/life/` too).
  HEIC conversion uses macOS's built-in `sips`, so run this on a Mac. Keep the
  originals out of this folder; only the converted tiles belong in the site.
- **Interest (or any single) photo:** `npm run photo -- path/to/photo.heic interests/cycling 1200x1500`
  crops to 1200×1500 and writes `public/images/interests/cycling-{600,1200}.{avif,webp}`
  with metadata stripped, printing a placeholder colour for the `<picture>` in `index.html`.
  Add a position (`top`, `bottom`, `left`, `right`, `centre`) to anchor the crop instead
  of the automatic choice, e.g. `… interests/cycling 1200x1200 bottom`. Interest cards take
  their shape from the image's `width`/`height`.
  The Music interest is a Spotify embed (`<iframe>` in `index.html`).
- **Work timeline:** each role is an `<li class="timeline__item">` in the `<ol class="timeline">`
  in `index.html` (newest first); copy one to add a role.
- **Portrait:** `npm run photo -- path/to/photo.jpg portrait 468x531` (use the photo's own
  size, or larger if you have it), then update the `<picture>` and `"image"` in `index.html`.
- **Enlarged photos:** both photo commands also write an uncropped `-full.{avif,webp}`
  copy (up to 1600px). Wrapping a `<picture>` in
  `<a class="zoom" href="…-full.webp" data-avif="…-full.avif">` makes it open in the
  click-to-enlarge view (`src/main.js`); Life lately tiles get this automatically.
- **Colours:** `--bg` / `--ink` in `src/style.css`, plus `uBase` / `uGlow` / `uStrength` in `src/fluid.js`.
- **Contact form:** static hosting can't receive form posts. Set `data-endpoint` on the
  `<form>` in `contact/index.html` to a form service URL (e.g. Formspree) to POST
  submissions as JSON. Left empty, the form opens the visitor's email app addressed to
  `data-mailto`.
