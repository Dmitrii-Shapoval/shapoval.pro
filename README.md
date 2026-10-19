# shapoval.pro

Personal business-card site of Dmitrii Shapoval, hosted on GitHub Pages.
Pure static HTML/CSS/JS — no frameworks, no build step.

## Structure

| Path | What it is |
| --- | --- |
| `index.html`, `style.css`, `script.js`, `common.js` | Current (2026) site: dark/light theme, contacts, resume dialog |
| `cv.html` | Full-page resume viewer, served at `/cv` |
| `viewer.js` | Lightweight PDF viewer UI on top of pdf.js (zoom, pinch, text selection, links, download) |
| `vendor/pdfjs/` | Mozilla pdf.js 4.10.38 (legacy build, Apache-2.0), loaded only when the resume is opened |
| `cv.pdf` | The resume itself |
| `images/` | Avatar (`avatar-*.webp` are optimized copies used by the new site) |
| `legacy/` | Original 2020 version of the site, available at `/legacy/` (marked `noindex`) |
| `other/` | Previous versions of the resume |

## Local preview

Any static server works, e.g.:

```bash
python3 -m http.server 8000
```

GitHub Pages maps `/cv` to `cv.html`; a plain local server needs `/cv.html` instead.

## Updating the resume

Replace `cv.pdf` (keep the file name) and update `<lastmod>` in `sitemap.xml`.
