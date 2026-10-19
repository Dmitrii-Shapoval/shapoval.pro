/**
 * Resume viewer — a tiny UI on top of Mozilla pdf.js.
 *
 * Used in two places:
 *   - index.html: inside the <dialog> opened by the "Resume" contact button;
 *   - cv.html:    as a full-page viewer at https://shapoval.pro/cv
 *
 * pdf.js (vendor/pdfjs, legacy build v4.10.38 for wide browser support) is
 * loaded lazily, only when the viewer is created. If it fails to load for any
 * reason, the viewer falls back to the browser's built-in PDF viewer (<iframe>)
 * plus a direct download link, so the resume is always reachable.
 *
 * Features: crisp HiDPI rendering, selectable text layer, clickable PDF links,
 * zoom (buttons, Ctrl/⌘ + wheel, pinch, keyboard + − 0), fit-to-width,
 * current page indicator, download.
 */

const PDFJS_URL = new URL('./vendor/pdfjs/pdf.min.mjs', import.meta.url).href;
const WORKER_URL = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.2;
/** Fit-width never upscales the page beyond this, so it stays readable on wide screens. */
const MAX_FIT_WIDTH = 920;
const PAGE_GUTTER = 32;

const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#i-${id}"></use></svg>`;

/**
 * Mount a viewer into `root`.
 * @param {HTMLElement} root
 * @param {{ url: string, fileName?: string, onClose?: () => void, openPageHref?: string }} options
 */
export function createViewer(root, { url, fileName = 'cv.pdf', onClose, openPageHref } = {}) {
  root.classList.add('cv');
  root.innerHTML = `
    <div class="cv__toolbar" role="toolbar" aria-label="Resume viewer controls">
      <div class="cv__group">
        <span class="cv__title">${icon('file')}<span>Resume</span></span>
        <span class="cv__pages" aria-live="polite"><span data-page>–</span> / <span data-total>–</span></span>
      </div>
      <div class="cv__group cv__group--zoom">
        <button class="cv__btn" type="button" data-action="zoom-out" aria-label="Zoom out" title="Zoom out (−)">${icon('minus')}</button>
        <button class="cv__btn cv__zoom" type="button" data-action="fit" aria-label="Fit to width" title="Fit to width (0)"><span data-zoom>100%</span></button>
        <button class="cv__btn" type="button" data-action="zoom-in" aria-label="Zoom in" title="Zoom in (+)">${icon('plus')}</button>
      </div>
      <div class="cv__group">
        ${openPageHref ? `<a class="cv__btn" href="${openPageHref}" target="_blank" rel="noopener" aria-label="Open in a new tab" title="Open in a new tab">${icon('external')}</a>` : ''}
        <a class="cv__btn cv__btn--accent" href="${url}" download="${fileName}" aria-label="Download PDF" title="Download PDF">${icon('download')}<span class="cv__btn-label">Download</span></a>
        ${onClose ? `<button class="cv__btn" type="button" data-action="close" aria-label="Close" title="Close (Esc)">${icon('close')}</button>` : ''}
      </div>
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

  /** @type {{ pdfjs: any, doc: any, pages: Array<{ page: any, base: any, el: HTMLElement, canvas: HTMLCanvasElement, text: HTMLElement, task: any }>, zoom: number, fit: boolean, renderTimer: number, destroyed: boolean }} */
  const state = { pdfjs: null, doc: null, pages: [], zoom: 1, fit: true, renderTimer: 0, destroyed: false };

  // ---------- Toolbar ----------
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'zoom-in') setZoom(state.zoom * ZOOM_STEP);
    else if (action === 'zoom-out') setZoom(state.zoom / ZOOM_STEP);
    else if (action === 'fit') fitWidth();
    else if (action === 'close') onClose?.();
  });

  // Keyboard: + / − / 0 while focus is inside the viewer.
  root.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
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

  // Current page indicator.
  const pageObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) pageLabel.textContent = entry.target.dataset.pageNumber;
    }
  }, { root: stage, threshold: 0.5 });

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
    await renderText(p, viewport);
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

  // ---------- Loading ----------
  async function load() {
    try {
      const pdfjs = await import(PDFJS_URL);
      pdfjs.GlobalWorkerOptions.workerSrc = WORKER_URL;
      state.pdfjs = pdfjs;
      state.doc = await pdfjs.getDocument({ url, isEvalSupported: false, verbosity: 0 }).promise;
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
        pageObserver.observe(el);
        renderLinks(p).catch(() => {});
      }
      pageLabel.textContent = '1';
      statusEl.hidden = true;
      state.zoom = fitScale();
      fitWidth();
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
    root.classList.add('is-fallback');
    $('.cv__group--zoom').hidden = true;
    stage.innerHTML = `
      <iframe class="cv__frame" src="${url}#view=FitH" title="Resume — Dmitrii Shapoval (PDF)"></iframe>
      <p class="cv__fallback-note">Can't see the document? <a href="${url}" download="${fileName}">Download the PDF</a>.</p>`;
  }

  load();

  return {
    focus: () => stage.focus({ preventScroll: true }),
    refit: () => { if (state.fit) fitWidth(); },
    destroy() {
      state.destroyed = true;
      clearTimeout(state.renderTimer);
      resizeObserver.disconnect();
      pageObserver.disconnect();
      state.pages.forEach((p) => p.task?.cancel());
      state.doc?.destroy();
      root.innerHTML = '';
    },
  };
}
