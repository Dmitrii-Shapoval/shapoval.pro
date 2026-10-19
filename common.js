/**
 * Shared helpers for index.html and cv.html.
 * The initial theme is set by a tiny inline script in <head> (before first paint);
 * this module only wires up the toggle button.
 */

const THEME_KEY = 'theme';
const THEME_COLORS = { dark: '#06080c', light: '#f4f6f9' };
const root = document.documentElement;
const systemLight = matchMedia('(prefers-color-scheme: light)');

function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

function applyTheme(theme) {
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[theme]);
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        const next = theme === 'dark' ? 'light' : 'dark';
        btn.setAttribute('aria-label', `Switch to ${next} theme`);
        btn.title = `Switch to ${next} theme`;
    });
}

export function initTheme() {
    applyTheme(root.dataset.theme === 'light' ? 'light' : 'dark');

    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode: not persisted */ }
        });
    });

    // Follow the OS theme until the user makes an explicit choice.
    systemLight.addEventListener?.('change', (e) => {
        if (!storedTheme()) applyTheme(e.matches ? 'light' : 'dark');
    });
}

let toastTimer = 0;

/** Show a short status message at the bottom of the screen. */
export function toast(message) {
    const el = document.querySelector('[data-toast]');
    if (!el) return;
    el.querySelector('[data-toast-text]').textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}
