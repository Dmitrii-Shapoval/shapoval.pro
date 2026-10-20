# shapoval.pro

Personal business-card site of Dmitrii Shapoval, hosted on GitHub Pages.
Pure static HTML/CSS/JS — no frameworks, no build step.

The 2026 design is built on the visual identity of the 2020 version: a black sky with a Dodgerblue light fan
on the "floor", metallic gradient type, and Font Awesome glyphs on tiles with Material shadows.

## Structure

| Path | What it is |
| --- | --- |
| `index.html`, `style.css`, `script.js`, `common.js` | Current (2026) site |
| `cv.html` | Full-page resume viewer, served at `/cv` |
| `viewer.js` | PDF viewer UI on top of pdf.js |
| `vendor/pdfjs/` | Mozilla pdf.js 4.10.38 (legacy build, Apache-2.0), loaded only when the resume is opened |
| `cv.pdf` | The resume itself |
| `dmitrii-shapoval.vcf` | Contact card behind the "Save contact" button |
| `images/` | Avatar. The new site uses the optimized `avatar-320/640/832.webp` copies; the JPEGs stay for `og:image` and the 2020 version |
| `legacy/` | Original 2020 version, available at `/legacy/` (marked `noindex`) |
| `other/` | Previous versions of the resume |

## Features

**Home page**
- Dark and light themes. The choice is saved in `localStorage`; until then the site follows the OS setting.
- "Hello!" welcome intro, a reworked version of the 2020 one. It plays once per session, can be skipped with a click or a key, and is off under `prefers-reduced-motion`.
- Stage effects: a light fan, a horizon line and a moving perspective grid. They are CSS-only and animate only `transform`/`opacity`.

**Portrait**
- 3D tilt and glare on hover.
- Click to enlarge: a lightbox with a shared-element zoom loads the full-size photo.

**Contacts**
- Telegram, LinkedIn, Facebook, Email and Resume tiles, each with a tooltip.
- Email copies the address on click. Without clipboard access it falls back to `mailto:`.
- Secondary buttons: "Save contact" (vCard) and "Share" (Web Share API, or copies the link).

**Resume viewer**
- Loading bar, page navigation, zoom (buttons, Ctrl/⌘ + wheel, pinch, keys `+` `−` `0`) and fit-to-width.
- Selectable text, so the browser's own Ctrl/⌘ + F search works, and clickable links.
- Print, fullscreen and download.
- Falls back to the browser's PDF viewer if pdf.js can't load.

**Version switch:** `/` ⇄ `/legacy/` and `/cv` ⇄ `/legacy/cv`. The `/cv` page has a Back button.

## Icons

All icons are Font Awesome Free 5.13 glyphs (CC BY 4.0), the same family as the 2020 version. They are inlined as
SVG `<symbol>`s instead of loading the icon font. The path data was taken from the fonts in
`legacy/libraries/webfonts/*.svg`, flipped to SVG coordinates and rounded to 0.1 unit.

## Local preview

Any static server works, e.g.:

```bash
python3 -m http.server 8000
```

GitHub Pages maps `/cv` to `cv.html`; a plain local server needs `/cv.html` instead.

## Updating the resume

Replace `cv.pdf` (keep the file name) and update `<lastmod>` in `sitemap.xml`.
