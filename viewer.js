/**
 * Resume viewer — a tiny UI on top of Mozilla pdf.js.
 *
 * Used in two places:
 *   - index.html: inside the <dialog> opened by the "Resume" contact tile;
 *   - cv.html:    as a full-page viewer at https://shapoval.pro/cv
 *
 * pdf.js (vendor/pdfjs, legacy build v4.10.38 for wide browser support) is
 * loaded lazily, only when the viewer is created. If it fails to load for any
 * reason, the viewer falls back to the browser's built-in PDF viewer (<iframe>)
 * plus a direct download link, so the resume is always reachable.
 *
 * Features: loading bar, crisp HiDPI rendering, selectable text layer (so the
 * browser's own Ctrl/⌘+F search works), clickable PDF links, zoom (buttons,
 * Ctrl/⌘ + wheel, pinch, keys + − 0), fit-to-width, page navigation, print,
 * fullscreen, download.
 */

const PDFJS_URL = new URL('./vendor/pdfjs/pdf.min.mjs', import.meta.url).href;
const WORKER_URL = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.2;
/** Fit-width never upscales the page beyond this, so it stays readable on wide screens. */
const MAX_FIT_WIDTH = 920;
const PAGE_GUTTER = 32;
/** Print resolution: 2.5 × 72 dpi ≈ 180 dpi. */
const PRINT_SCALE = 2.5;

/* Font Awesome Free 5.13 glyphs (CC BY 4.0) — same icon family as the rest of the site. */
const SPRITE = `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs><symbol id="cv-i-resume" viewBox="0 0 384 512"><path transform="matrix(1 0 0 -1 0 448)" d="M224 312c0-13.2 10.8-24 24-24h136v-328c0-13.3-10.7-24-24-24h-336c-13.3 0-24 10.7-24 24v464c0 13.3 10.7 24 24 24h200v-136zM288 76v8c0 6.6-5.4 12-12 12h-168c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12zM288 140v8c0 6.6-5.4 12-12 12h-168c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12zM288 212c0 6.6-5.4 12-12 12h-168c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12v8zM384 326.1v-6.1h-128v128h6.1c6.4 0 12.5-2.5 17-7l97.9-98c4.5-4.5 7-10.6 7-16.9z"/></symbol><symbol id="cv-i-zoom-out" viewBox="0 0 512 512"><path transform="matrix(1 0 0 -1 0 448)" d="M304 256v-32c0-6.6-5.4-12-12-12h-168c-6.6 0-12 5.4-12 12v32c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12zM505-28.7l-28.3-28.3c-9.4-9.4-24.6-9.4-33.9 0l-99.8 99.7c-4.5 4.5-7 10.6-7 17v16.3c-35.3-27.6-79.7-44-128-44c-114.9 0-208 93.1-208 208s93.1 208 208 208s208-93.1 208-208c0-48.3-16.4-92.7-44-128h16.3c6.4 0 12.5-2.5 17-7l99.7-99.7c9.3-9.4 9.3-24.6 0-34zM344 240c0 75.2-60.8 136-136 136s-136-60.8-136-136s60.8-136 136-136s136 60.8 136 136z"/></symbol><symbol id="cv-i-zoom-in" viewBox="0 0 512 512"><path transform="matrix(1 0 0 -1 0 448)" d="M304 256v-32c0-6.6-5.4-12-12-12h-56v-56c0-6.6-5.4-12-12-12h-32c-6.6 0-12 5.4-12 12v56h-56c-6.6 0-12 5.4-12 12v32c0 6.6 5.4 12 12 12h56v56c0 6.6 5.4 12 12 12h32c6.6 0 12-5.4 12-12v-56h56c6.6 0 12-5.4 12-12zM505-28.7l-28.3-28.3c-9.4-9.4-24.6-9.4-33.9 0l-99.8 99.7c-4.5 4.5-7 10.6-7 17v16.3c-35.3-27.6-79.7-44-128-44c-114.9 0-208 93.1-208 208s93.1 208 208 208s208-93.1 208-208c0-48.3-16.4-92.7-44-128h16.3c6.4 0 12.5-2.5 17-7l99.7-99.7c9.3-9.4 9.3-24.6 0-34zM344 240c0 75.2-60.8 136-136 136s-136-60.8-136-136s60.8-136 136-136s136 60.8 136 136z"/></symbol><symbol id="cv-i-prev" viewBox="0 0 448 512"><path transform="matrix(1 0 0 -1 0 448)" d="M241 317.5l194.3-194.3c9.4-9.4 9.4-24.6 0-33.9l-22.7-22.7c-9.4-9.4-24.5-9.4-33.9 0l-154.7 154l-154.7-154c-9.4-9.3-24.5-9.3-33.9 0l-22.7 22.7c-9.4 9.4-9.4 24.6 0 33.9l194.3 194.3c9.4 9.4 24.6 9.4 33.9 0z"/></symbol><symbol id="cv-i-next" viewBox="0 0 448 512"><path transform="matrix(1 0 0 -1 0 448)" d="M207 66.5l-194.3 194.3c-9.4 9.4-9.4 24.6 0 33.9l22.7 22.7c9.4 9.4 24.5 9.4 33.9 0l154.7-154l154.7 154c9.4 9.3 24.5 9.3 33.9 0l22.7-22.7c9.4-9.4 9.4-24.6 0-33.9l-194.3-194.3c-9.4-9.4-24.6-9.4-33.9 0z"/></symbol><symbol id="cv-i-print" viewBox="0 0 512 512"><path transform="matrix(1 0 0 -1 0 448)" d="M448 256c35.3 0 64-28.7 64-64v-112c0-8.8-7.2-16-16-16h-48v-96c0-17.7-14.3-32-32-32h-320c-17.7 0-32 14.3-32 32v96h-48c-8.8 0-16 7.2-16 16v112c0 35.3 28.7 64 64 64v160c0 17.7 14.3 32 32 32h274.7c8.5 0 16.6-3.4 22.6-9.4l45.3-45.2c6-6 9.4-14.1 9.4-22.6v-114.8zM384 0v96h-256v-96h256zM384 224v96h-48c-8.8 0-16 7.2-16 16v48h-192v-160h256zM432 152c13.2 0 24 10.8 24 24c0 13.3-10.8 24-24 24s-24-10.7-24-24c0-13.2 10.8-24 24-24z"/></symbol><symbol id="cv-i-fullscreen" viewBox="0 0 448 512"><path transform="matrix(1 0 0 -1 0 448)" d="M0 268v124c0 13.3 10.7 24 24 24h124c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-84v-84c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12zM288 404c0 6.6 5.4 12 12 12h124c13.3 0 24-10.7 24-24v-124c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v84h-84c-6.6 0-12 5.4-12 12v40zM436 128c6.6 0 12-5.4 12-12v-124c0-13.3-10.7-24-24-24h-124c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h84v84c0 6.6 5.4 12 12 12h40zM160-20c0-6.6-5.4-12-12-12h-124c-13.3 0-24 10.7-24 24v124c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12v-84h84c6.6 0 12-5.4 12-12v-40z"/></symbol><symbol id="cv-i-fullscreen-exit" viewBox="0 0 448 512"><path transform="matrix(1 0 0 -1 0 448)" d="M436 256h-124c-13.3 0-24 10.7-24 24v124c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12v-84h84c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12zM160 280c0-13.3-10.7-24-24-24h-124c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h84v84c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12v-124zM160-20c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v84h-84c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h124c13.3 0 24-10.7 24-24v-124zM352-20c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v124c0 13.3 10.7 24 24 24h124c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12h-84v-84z"/></symbol><symbol id="cv-i-external" viewBox="0 0 512 512"><path transform="matrix(1 0 0 -1 0 448)" d="M432 128c8.8 0 16-7.2 16-16v-128c0-26.5-21.5-48-48-48h-352c-26.5 0-48 21.5-48 48v352c0 26.5 21.5 48 48 48h160c8.8 0 16-7.2 16-16v-32c0-8.8-7.2-16-16-16h-144v-320h320v112c0 8.8 7.2 16 16 16h32zM488 448c13.2 0 24-10.8 24-24v-128c0-21.5-26-32-41-17l-35.7 35.7l-243.6-243.7c-3.9-3.9-11.5-7.1-17-7.1s-13.1 3.2-17 7.1l-22.7 22.6c-3.9 3.9-7.1 11.5-7.1 17s3.2 13.1 7.1 17l243.7 243.6l-35.7 35.7c-15 15.1-4.4 41 17 41h128z"/></symbol><symbol id="cv-i-download" viewBox="0 0 512 512"><path transform="matrix(1 0 0 -1 0 448)" d="M216 448h80c13.3 0 24-10.7 24-24v-168h87.7c17.8 0 26.7-21.5 14.1-34.1l-152.1-152.2c-7.5-7.5-19.8-7.5-27.3 0l-152.3 152.2c-12.6 12.6-3.7 34.1 14.1 34.1h87.8v168c0 13.3 10.7 24 24 24zM512 72v-112c0-13.3-10.7-24-24-24h-464c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24h146.7l49-49c20.1-20.1 52.5-20.1 72.6 0l49 49h146.7c13.3 0 24-10.7 24-24zM388-16c0 11-9 20-20 20s-20-9-20-20s9-20 20-20s20 9 20 20zM452-16c0 11-9 20-20 20s-20-9-20-20s9-20 20-20s20 9 20 20z"/></symbol><symbol id="cv-i-close" viewBox="0 0 352 512"><path transform="matrix(1 0 0 -1 0 448)" d="M242.7 192l100.1-100.1c12.3-12.3 12.3-32.2 0-44.5l-22.2-22.2c-12.3-12.3-32.2-12.3-44.5 0l-100.1 100.1l-100.1-100.1c-12.3-12.3-32.2-12.3-44.5 0l-22.2 22.2c-12.3 12.3-12.3 32.2 0 44.5l100.1 100.1l-100.1 100.1c-12.3 12.3-12.3 32.2 0 44.5l22.2 22.2c12.3 12.3 32.2 12.3 44.5 0l100.1-100.1l100.1 100.1c12.3 12.3 32.2 12.3 44.5 0l22.2-22.2c12.3-12.3 12.3-32.2 0-44.5z"/></symbol></defs></svg>`;

const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#cv-i-${id}"></use></svg>`;

function injectSprite() {
  if (document.getElementById('cv-i-resume')) return;
  document.body.insertAdjacentHTML('afterbegin', SPRITE);
}

/**
 * Mount a viewer into `root`.
 * @param {HTMLElement} root
 * @param {{ url: string, fileName?: string, onClose?: () => void, openPageHref?: string }} options
 */
export function createViewer(root, { url, fileName = 'cv.pdf', onClose, openPageHref } = {}) {
  injectSprite();
  const canFullscreen = Boolean(document.fullscreenEnabled && root.requestFullscreen);

  root.classList.add('cv');
  root.innerHTML = `
    <div class="cv__toolbar" role="toolbar" aria-label="Resume viewer controls">
      <div class="cv__group">
        <span class="cv__title">${icon('resume')}<span>Resume</span></span>
        <button class="cv__btn cv__btn--page" type="button" data-action="prev" aria-label="Previous page" title="Previous page">${icon('prev')}</button>
        <span class="cv__pages" aria-live="polite"><span data-page>–</span> / <span data-total>–</span></span>
        <button class="cv__btn cv__btn--page" type="button" data-action="next" aria-label="Next page" title="Next page">${icon('next')}</button>
      </div>
      <div class="cv__group" data-zoom-group>
        <button class="cv__btn" type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out (−)">${icon('zoom-out')}</button>
        <button class="cv__btn cv__zoom" type="button" data-action="fit" aria-label="Fit to width" title="Fit to width (0)"><span data-zoom>100%</span></button>
        <button class="cv__btn" type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in (+)">${icon('zoom-in')}</button>
      </div>
      <div class="cv__group">
        <button class="cv__btn cv__btn--wide" type="button" data-action="print" aria-label="Print" title="Print">${icon('print')}</button>
        ${canFullscreen ? `<button class="cv__btn cv__btn--wide" type="button" data-action="fullscreen" aria-label="Fullscreen" title="Fullscreen">${icon('fullscreen')}</button>` : ''}
        ${openPageHref ? `<a class="cv__btn cv__btn--page" href="${openPageHref}" target="_blank" rel="noopener" aria-label="Open in a new tab" title="Open in a new tab">${icon('external')}</a>` : ''}
        <a class="cv__btn cv__btn--accent" href="${url}" download="${fileName}" aria-label="Download PDF" title="Download PDF">${icon('download')}<span class="cv__btn-label">Download</span></a>
        ${onClose ? `<button class="cv__btn" type="button" data-action="close" aria-label="Close" title="Close (Esc)">${icon('close')}<span class="cv__btn-label">Close</span></button>` : ''}
      </div>
      <span class="cv__progress" aria-hidden="true"></span>
    </div>
    <div class="cv__stage" tabindex="0" aria-label="Resume pages">
      <div class="cv__status" data-status><span class="spinner" aria-hidden="true"></span><span>Loading resume…</span></div>
      <div class="cv__pages-wrap" data-pages></div>
    </div>`;

  const $ = (sel) => root.querySelector(sel);
  const stage = $('.cv__stage');
  const pagesWrap = $('[data-pages]');
  const statusEl = $('[data-status]');
  const zoomLabel = $('[data-zoom]');
  const pageLabel = $('[data-page]');
  const totalLabel = $('[data-total]');
  const prevBtn = $('[data-action="prev"]');
  const nextBtn = $('[data-action="next"]');
  const fullscreenBtn = $('[data-action="fullscreen"]');

  /** @type {{ pdfjs: any, doc: any, pages: Array<{ page: any, base: any, el: HTMLElement, canvas: HTMLCanvasElement, text: HTMLElement, task: any }>, zoom: number, fit: boolean, current: number, renderTimer: number, destroyed: boolean }} */
  const state = { pdfjs: null, doc: null, pages: [], zoom: 1, fit: true, current: 1, renderTimer: 0, destroyed: false, themed: false };

  // ---------- Toolbar ----------
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'zoom-in') setZoom(state.zoom * ZOOM_STEP);
    else if (action === 'zoom-out') setZoom(state.zoom / ZOOM_STEP);
    else if (action === 'fit') fitWidth();
    else if (action === 'prev') goToPage(state.current - 1);
    else if (action === 'next') goToPage(state.current + 1);
    else if (action === 'print') print();
    else if (action === 'fullscreen') toggleFullscreen();
    else if (action === 'close') onClose?.();
  });

  // Keyboard: + / − / 0 while focus is inside the viewer.
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(state.zoom * ZOOM_STEP); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(state.zoom / ZOOM_STEP); }
    else if (e.key === '0') { e.preventDefault(); fitWidth(); }
  });

  // Ctrl/⌘ + wheel (and trackpad pinch, which browsers report as ctrl+wheel).
  stage.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(state.zoom * Math.exp(-e.deltaY * 0.01), { x: e.clientX, y: e.clientY });
  }, { passive: false });

  // Two-finger pinch on touch screens.
  let pinch = null;
  const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) pinch = { dist: touchDist(e.touches), zoom: state.zoom };
  }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    setZoom(pinch.zoom * (touchDist(e.touches) / pinch.dist), { x: cx, y: cy });
  }, { passive: false });
  stage.addEventListener('touchend', (e) => { if (e.touches.length < 2) pinch = null; }, { passive: true });

  // Keep "fit to width" mode in sync with the container size.
  const resizeObserver = new ResizeObserver(() => { if (state.fit && state.pages.length) fitWidth(); });
  resizeObserver.observe(stage);

  // Current page = the last page whose top has passed 40% of the visible area.
  let scrollFrame = 0;
  stage.addEventListener('scroll', () => {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = requestAnimationFrame(updateCurrentPage);
  }, { passive: true });

  function updateCurrentPage() {
    const line = stage.scrollTop + stage.clientHeight * 0.4;
    let current = 1;
    for (const p of state.pages) if (p.el.offsetTop <= line) current = Number(p.el.dataset.pageNumber);
    state.current = current;
    pageLabel.textContent = String(current);
    if (prevBtn) prevBtn.disabled = current <= 1;
    if (nextBtn) nextBtn.disabled = current >= state.pages.length;
  }

  function goToPage(n) {
    const p = state.pages[n - 1];
    if (!p) return;
    stage.scrollTo({ top: p.el.offsetTop - 16, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  // ---------- Zoom ----------
  function fitScale() {
    const first = state.pages[0];
    if (!first) return 1;
    const available = Math.min(stage.clientWidth - PAGE_GUTTER, MAX_FIT_WIDTH);
    return Math.max(MIN_ZOOM, available / first.base.width);
  }

  function fitWidth() {
    state.fit = true;
    applyZoom(fitScale());
  }

  function setZoom(next, anchor) {
    state.fit = false;
    applyZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)), anchor);
  }

  /**
   * Resize page boxes immediately (cheap, CSS only — the canvas just stretches),
   * then re-render canvases at the new resolution after a short pause.
   */
  function applyZoom(zoom, anchor) {
    if (!state.pages.length) return;
    const prev = state.zoom;
    const rect = stage.getBoundingClientRect();
    const ax = anchor ? anchor.x - rect.left : stage.clientWidth / 2;
    const ay = anchor ? anchor.y - rect.top : stage.clientHeight / 2;
    const contentX = (stage.scrollLeft + ax) / prev;
    const contentY = (stage.scrollTop + ay) / prev;

    state.zoom = zoom;
    for (const p of state.pages) sizePage(p);
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;

    // Keep the point under the cursor / fingers in place.
    stage.scrollLeft = contentX * zoom - ax;
    stage.scrollTop = contentY * zoom - ay;

    clearTimeout(state.renderTimer);
    state.renderTimer = setTimeout(renderAll, 160);
  }

  function sizePage(p) {
    p.el.style.width = `${Math.floor(p.base.width * state.zoom)}px`;
    p.el.style.height = `${Math.floor(p.base.height * state.zoom)}px`;
    p.el.style.setProperty('--scale-factor', String(state.zoom));
  }

  // ---------- Rendering ----------
  async function renderAll() {
    await Promise.all(state.pages.map(renderPage));
  }

  async function renderPage(p) {
    if (state.destroyed) return;
    p.task?.cancel();
    const viewport = p.page.getViewport({ scale: state.zoom });
    const ratio = Math.min(window.devicePixelRatio || 1, 3);
    // Render into an off-screen canvas, then swap — avoids a blank flash while re-rendering.
    const canvas = document.createElement('canvas');
    canvas.className = 'cv__canvas';
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    p.task = p.page.render({
      canvasContext: canvas.getContext('2d', { alpha: false }),
      viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
    });
    try {
      await p.task.promise;
    } catch (err) {
      if (err?.name === 'RenderingCancelledException') return;
      throw err;
    }
    p.canvas.replaceWith(canvas);
    p.canvas = canvas;
    if (p === state.pages[0] && !state.themed) adoptDocumentColors(canvas);
    await renderText(p, viewport);
  }

  /**
   * Make the backdrop continue the resume: sample the page's left edge (top,
   * middle, bottom) and use those colours for the stage gradient. Light pages
   * (a future white resume) keep the default dark-blue backdrop.
   */
  function adoptDocumentColors(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      const pick = (fy) => {
        const [r, g, b] = ctx.getImageData(Math.floor(canvas.width * 0.015), Math.floor(canvas.height * fy), 1, 1).data;
        return { r, g, b, lum: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 };
      };
      const top = pick(0.01), mid = pick(0.55), bottom = pick(0.985);
      if (Math.max(top.lum, mid.lum, bottom.lum) > 0.45) return;
      // Slightly darker than the page itself, so the document stays the brightest thing on screen.
      const css = (c, k = 0.82) => `rgb(${Math.round(c.r * k)} ${Math.round(c.g * k)} ${Math.round(c.b * k)})`;
      root.style.setProperty('--cv-top', css(top));
      root.style.setProperty('--cv-mid', css(mid));
      root.style.setProperty('--cv-bottom', css(bottom));
      root.style.setProperty('--cv-glow', `rgb(${bottom.r} ${bottom.g} ${bottom.b} / .5)`);
      state.themed = true;
    } catch { /* keep the default backdrop */ }
  }

  async function renderText(p, viewport) {
    const { TextLayer } = state.pdfjs;
    if (!TextLayer) return;
    const layer = document.createElement('div');
    layer.className = 'textLayer';
    const textLayer = new TextLayer({
      textContentSource: p.page.streamTextContent(),
      container: layer,
      viewport,
    });
    await textLayer.render();
    p.text.replaceWith(layer);
    p.text = layer;
  }

  /** Real <a> elements over PDF link annotations (scaled with the page via percentages). */
  async function renderLinks(p) {
    const annotations = await p.page.getAnnotations({ intent: 'display' });
    const layer = document.createElement('div');
    layer.className = 'cv__links';
    for (const a of annotations) {
      if (a.subtype !== 'Link' || !a.url) continue;
      const [x1, y1, x2, y2] = p.base.convertToViewportRectangle(a.rect);
      const link = document.createElement('a');
      link.href = a.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.title = a.url;
      link.style.left = `${(Math.min(x1, x2) / p.base.width) * 100}%`;
      link.style.top = `${(Math.min(y1, y2) / p.base.height) * 100}%`;
      link.style.width = `${(Math.abs(x2 - x1) / p.base.width) * 100}%`;
      link.style.height = `${(Math.abs(y2 - y1) / p.base.height) * 100}%`;
      layer.append(link);
    }
    if (layer.childElementCount) p.el.append(layer);
  }

  // ---------- Print: high-resolution page images in a print-only container ----------
  let printing = false;
  async function print() {
    if (printing || !state.pages.length) return;
    printing = true;
    const sheet = document.createElement('div');
    sheet.className = 'cv-print';
    try {
      for (const p of state.pages) {
        const viewport = p.page.getViewport({ scale: PRINT_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await p.page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport, intent: 'print' }).promise;
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
        const img = new Image();
        img.alt = `Resume, page ${p.el.dataset.pageNumber}`;
        img.src = URL.createObjectURL(blob);
        await img.decode().catch(() => {});
        sheet.append(img);
      }
      document.body.append(sheet);
      const cleanup = () => {
        sheet.querySelectorAll('img').forEach((img) => URL.revokeObjectURL(img.src));
        sheet.remove();
        printing = false;
      };
      addEventListener('afterprint', cleanup, { once: true });
      window.print();
    } catch (err) {
      console.warn('[cv] print failed, opening the PDF instead:', err);
      sheet.remove();
      printing = false;
      window.open(url, '_blank', 'noopener');
    }
  }

  // ---------- Fullscreen ----------
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.requestFullscreen().catch(() => {});
  }
  const onFullscreenChange = () => {
    if (!fullscreenBtn) return;
    const active = document.fullscreenElement === root;
    fullscreenBtn.innerHTML = icon(active ? 'fullscreen-exit' : 'fullscreen');
    fullscreenBtn.setAttribute('aria-label', active ? 'Exit fullscreen' : 'Fullscreen');
    fullscreenBtn.title = active ? 'Exit fullscreen' : 'Fullscreen';
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);

  // ---------- Loading ----------
  async function load() {
    try {
      const pdfjs = await import(PDFJS_URL);
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
      state.pdfjs = pdfjs;
      root.style.setProperty('--progress', '0.15');
      const task = pdfjs.getDocument({ url, isEvalSupported: false, verbosity: 0 });
      task.onProgress = ({ loaded, total }) => {
        if (total) root.style.setProperty('--progress', String(0.15 + 0.85 * Math.min(1, loaded / total)));
      };
      state.doc = await task.promise;
      root.style.setProperty('--progress', '1');
      if (state.destroyed) return;

      totalLabel.textContent = state.doc.numPages;
      for (let n = 1; n <= state.doc.numPages; n++) {
        const page = await state.doc.getPage(n);
        const el = document.createElement('div');
        el.className = 'cv__page';
        el.dataset.pageNumber = String(n);
        el.setAttribute('role', 'img');
        el.setAttribute('aria-label', `Resume, page ${n} of ${state.doc.numPages}`);
        const canvas = document.createElement('canvas');
        canvas.className = 'cv__canvas';
        const text = document.createElement('div');
        el.append(canvas, text);
        pagesWrap.append(el);
        const p = { page, base: page.getViewport({ scale: 1 }), el, canvas, text, task: null };
        state.pages.push(p);
        renderLinks(p).catch(() => {});
      }
      statusEl.hidden = true;
      state.zoom = fitScale();
      fitWidth();
      updateCurrentPage();
      await renderAll();
      root.classList.add('is-ready');
    } catch (err) {
      console.warn('[cv] pdf.js unavailable, using native viewer:', err);
      fallback();
    }
  }

  /** Native browser PDF viewer as a safety net. */
  function fallback() {
    if (state.destroyed) return;
    root.classList.add('is-fallback', 'is-ready');
    root.querySelectorAll('[data-zoom-group], .cv__btn--page[data-action], [data-action="print"]').forEach((el) => { el.hidden = true; });
    stage.innerHTML = `
      <iframe class="cv__frame" src="${url}#view=FitH" title="Resume — Dmitrii Shapoval (PDF)"></iframe>
      <p class="cv__fallback-note">Can't see the document? <a href="${url}" download="${fileName}">Download the PDF</a>.</p>`;
  }

  load();

  return {
    focus: () => stage.focus({ preventScroll: true }),
    refit: () => { if (state.fit) fitWidth(); },
    exitFullscreen: () => { if (document.fullscreenElement === root) document.exitFullscreen(); },
    destroy() {
      state.destroyed = true;
      clearTimeout(state.renderTimer);
      resizeObserver.disconnect();
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      state.pages.forEach((p) => p.task?.cancel());
      state.doc?.destroy();
      root.innerHTML = '';
    },
  };
}
