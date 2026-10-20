/**
 * Shared helpers for index.html and cv.html.
 * The initial theme is set by a tiny inline script in <head> (before first paint);
 * this module only wires up the toggle button.
 */

const THEME_KEY = 'theme';
const THEME_COLORS = { dark: '#02050b', light: '#eef3fa' };
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

/**
 * "Back" links: return to the previous page of this site when there is one
 * (keeps the scroll position), otherwise follow the link (e.g. opened from Google).
 */
export function initBackLinks() {
    document.querySelectorAll('[data-back]').forEach((link) => {
        link.addEventListener('click', (e) => {
            let fromThisSite = false;
            try { fromThisSite = new URL(document.referrer).origin === location.origin; } catch { /* no referrer */ }
            if (fromThisSite && history.length > 1) {
                e.preventDefault();
                history.back();
            }
        });
    });
}

let toastTimer = 0;

/**
 * Show a short status message at the bottom of the screen.
 * @param {string} message
 * @param {{ label: string, href: string }} [action] optional link button inside the toast
 */
export function toast(message, action) {
    const el = document.querySelector('[data-toast]');
    if (!el) return;
    el.querySelector('[data-toast-text]').textContent = message;
    const button = el.querySelector('[data-toast-action]');
    if (button) {
        button.hidden = !action;
        if (action) {
            button.textContent = action.label;
            button.href = action.href;
        }
    }
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-visible'), action ? 4200 : 2600);
}
