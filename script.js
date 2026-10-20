/**
 * shapoval.pro — main page script (ES module).
 *  - welcome intro (skippable), theme toggle;
 *  - portrait: 3D tilt + glare on hover, click to enlarge (lightbox with a shared-element zoom);
 *  - email: click copies the address (the 2020 "Click to copy" tooltip), falls back to mailto:;
 *  - share button (Web Share API or "copy link");
 *  - resume: the built-in PDF viewer in a <dialog> (viewer.js is loaded on demand);
 *  - current year in the footer.
 */

import { initTheme, toast } from './common.js';

const root = document.documentElement;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

initTheme();

// ---------- Welcome intro ----------
const intro = document.querySelector('[data-intro-screen]');
if (intro && root.dataset.intro === 'play') {
    const skip = () => { if (root.dataset.intro === 'play') root.dataset.intro = 'skip'; };
    intro.addEventListener('click', skip);
    addEventListener('keydown', skip, { once: true });
    addEventListener('wheel', skip, { once: true, passive: true });
    intro.addEventListener('animationend', (e) => {
        if (e.animationName === 'intro-out' && !e.pseudoElement) intro.remove();
    });
} else {
    intro?.remove();
}

// ---------- Email: copy to clipboard ----------
document.querySelectorAll('[data-copy-email]').forEach((link) => {
    const hint = link.querySelector('[data-copy-hint]');
    const hintDefault = hint?.innerHTML;
    let timer = 0;

    link.addEventListener('click', async (e) => {
        if (!navigator.clipboard?.writeText) return; // let mailto: work
        e.preventDefault();
        const email = link.dataset.copyEmail;
        try {
            await navigator.clipboard.writeText(email);
        } catch {
            location.href = link.href;
            return;
        }
        link.classList.add('is-copied');
        if (hint) hint.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-check"></use></svg>Copied!';
        toast(`${email} copied`, { label: 'Write', href: link.href });
        clearTimeout(timer);
        timer = setTimeout(() => {
            link.classList.remove('is-copied');
            if (hint) hint.innerHTML = hintDefault;
        }, 2400);
    });
});

// ---------- Share ----------
const shareBtn = document.querySelector('[data-share]');
if (shareBtn && (navigator.share || navigator.clipboard?.writeText)) {
    shareBtn.hidden = false;
    shareBtn.addEventListener('click', async () => {
        const url = document.querySelector('link[rel="canonical"]')?.href || location.href;
        if (navigator.share) {
            try { await navigator.share({ title: document.title, text: 'Dmitrii Shapoval — Web - developer', url }); } catch { /* cancelled */ }
            return;
        }
        try {
            await navigator.clipboard.writeText(url);
            toast('Link copied');
        } catch { /* clipboard blocked */ }
    });
}

// ---------- Portrait: tilt + glare ----------
const portrait = document.querySelector('[data-portrait]');
const thumb = portrait?.querySelector('img');
let tiltFrame = 0;

function resetTilt() {
    cancelAnimationFrame(tiltFrame);
    portrait.classList.remove('is-tilting');
    for (const prop of ['--rx', '--ry', '--gx', '--gy']) portrait.style.removeProperty(prop);
}

if (portrait && matchMedia('(hover: hover) and (pointer: fine)').matches && !reducedMotion.matches) {
    let rect = null;
    portrait.addEventListener('pointerenter', () => {
        rect = portrait.getBoundingClientRect();
        portrait.classList.add('is-tilting');
    });
    portrait.addEventListener('pointermove', (e) => {
        if (!rect) return;
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        cancelAnimationFrame(tiltFrame);
        tiltFrame = requestAnimationFrame(() => {
            const { style } = portrait;
            style.setProperty('--ry', `${(px * 12).toFixed(2)}deg`);
            style.setProperty('--rx', `${(-py * 10).toFixed(2)}deg`);
            style.setProperty('--gx', `${(px * rect.width).toFixed(1)}px`);
            style.setProperty('--gy', `${(py * rect.height).toFixed(1)}px`);
        });
    });
    portrait.addEventListener('pointerleave', () => { rect = null; resetTilt(); });
}

// ---------- Portrait: lightbox (the 2020 "zoom-in" photo, now animated) ----------
const lightbox = document.getElementById('lightbox');
const FULL_PHOTO = 'images/avatar-832.webp';
let bigPhoto = null;

/** Transform that maps the box `to` onto the box `from` (both DOMRects), origin top-left. */
const flip = (from, to) =>
    `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;

function preloadFullPhoto() {
    const img = new Image();
    img.src = FULL_PHOTO;
}

function openLightbox() {
    if (!bigPhoto) {
        bigPhoto = new Image(832, 1181);
        bigPhoto.className = 'lightbox__img';
        bigPhoto.alt = thumb.alt;
        bigPhoto.decoding = 'async';
        bigPhoto.src = thumb.currentSrc || thumb.src; // already decoded: shows instantly
        const full = new Image();
        full.onload = () => { bigPhoto.src = FULL_PHOTO; };
        full.src = FULL_PHOTO;
        bigPhoto.addEventListener('click', closeLightbox);
        lightbox.querySelector('[data-lightbox-frame]').append(bigPhoto);
    }
    resetTilt();
    const from = thumb.getBoundingClientRect();
    lightbox.showModal();
    portrait.classList.add('is-lifted');
    const to = bigPhoto.getBoundingClientRect();
    bigPhoto.animate([{ transform: flip(from, to) }, { transform: 'none' }], {
        duration: reducedMotion.matches ? 0 : 560,
        easing: 'cubic-bezier(.16, 1, .3, 1)',
    }).finished.then(() => lightbox.classList.add('is-ready'));
}

function closeLightbox() {
    if (!lightbox.open || lightbox.classList.contains('is-closing')) return;
    lightbox.classList.remove('is-ready');
    lightbox.classList.add('is-closing');
    const from = bigPhoto.getBoundingClientRect();
    const to = thumb.getBoundingClientRect();
    const anim = bigPhoto.animate([{ transform: 'none' }, { transform: flip(to, from) }], {
        duration: reducedMotion.matches ? 0 : 420,
        easing: 'cubic-bezier(.65, 0, .35, 1)',
        fill: 'forwards',
    });
    anim.finished.then(() => {
        portrait.classList.remove('is-lifted');
        lightbox.close();
        lightbox.classList.remove('is-closing');
        anim.cancel();
    });
}

if (portrait && lightbox && typeof lightbox.showModal === 'function') {
    portrait.addEventListener('pointerenter', preloadFullPhoto, { once: true });
    portrait.addEventListener('focus', preloadFullPhoto, { once: true });
    portrait.addEventListener('click', openLightbox);
    lightbox.querySelector('[data-lightbox-close]').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    lightbox.addEventListener('cancel', (e) => { e.preventDefault(); closeLightbox(); }); // Esc
} else if (portrait) {
    // Very old browsers: just open the photo.
    portrait.addEventListener('click', () => { location.href = FULL_PHOTO; });
}

// ---------- Resume dialog ----------
const dialog = document.getElementById('cvDialog');
const mount = dialog?.querySelector('[data-cv-mount]');
let viewer = null;
let pushedHistory = false; // true while our "#resume" history entry is on top

async function openResume() {
    if (!viewer) {
        const { createViewer } = await import('./viewer.js');
        viewer = createViewer(mount, {
            url: 'cv.pdf',
            fileName: 'Dmitrii_Shapoval_CV.pdf',
            openPageHref: 'cv',
            onClose: requestClose,
        });
    }
    if (!dialog.open) dialog.showModal();
    viewer.refit();
    viewer.focus();
}

/** Close via history when we added an entry, so "back" and the close button behave the same. */
function requestClose() {
    if (pushedHistory) {
        history.back(); // -> popstate -> closeResume()
    } else {
        history.replaceState(null, '', location.pathname + location.search);
        closeResume();
    }
}

function closeResume() {
    if (!dialog.open || dialog.classList.contains('is-closing')) return;
    viewer?.exitFullscreen();
    dialog.classList.add('is-closing');
    const done = (e) => {
        if (e && e.target !== dialog) return; // ignore animations bubbling up from children
        dialog.removeEventListener('animationend', done);
        dialog.classList.remove('is-closing');
        dialog.close();
    };
    if (reducedMotion.matches) done();
    else dialog.addEventListener('animationend', done);
}

if (dialog && typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-open-cv]').forEach((link) => {
        link.addEventListener('click', (e) => {
            // Respect Ctrl/⌘/Shift/middle-click: open the /cv page as usual.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            // A history entry lets the phone's "back" gesture close the viewer.
            if (!pushedHistory) {
                history.pushState({ cv: true }, '', '#resume');
                pushedHistory = true;
            }
            openResume().catch(() => { location.href = link.href; });
        });
    });

    dialog.addEventListener('cancel', (e) => { // Esc
        e.preventDefault();
        requestClose();
    });
    dialog.addEventListener('click', (e) => { // click on the backdrop
        if (e.target === dialog) requestClose();
    });
    addEventListener('popstate', () => {
        if (location.hash === '#resume') return;
        pushedHistory = false;
        closeResume();
    });

    // A direct link to https://shapoval.pro/#resume opens the viewer right away.
    if (location.hash === '#resume') openResume();
}

// ---------- Year ----------
document.querySelectorAll('.copyright__this-year').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
});
