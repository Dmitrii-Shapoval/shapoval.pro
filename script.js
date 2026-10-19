/**
 * shapoval.pro — main page script (ES module, ~2 KB).
 *  - theme toggle (dark / light) persisted in localStorage;
 *  - email: click copies the address, falls back to mailto:;
 *  - resume: opens the built-in PDF viewer in a <dialog> (viewer.js is loaded on demand);
 *  - current year in the footer.
 */

import { initTheme, toast } from './common.js';

initTheme();

// ---------- Email: copy to clipboard ----------
document.querySelectorAll('[data-copy-email]').forEach((link) => {
    link.addEventListener('click', async (e) => {
        if (!navigator.clipboard?.writeText) return; // let mailto: work
        e.preventDefault();
        const email = link.dataset.copyEmail;
        try {
            await navigator.clipboard.writeText(email);
            toast(`${email} — copied!`);
        } catch {
            location.href = link.href;
        }
    });
});

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
    dialog.classList.add('is-closing');
    const done = (e) => {
        if (e && e.target !== dialog) return; // ignore animations bubbling up from children
        dialog.removeEventListener('animationend', done);
        dialog.classList.remove('is-closing');
        dialog.close();
    };
    // Reduced-motion users get no animation, so don't wait for animationend forever.
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) done();
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
