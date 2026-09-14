/* Interruptor claro/oscuro. Vive aparte porque lo usan las dos vistas; el tema
   inicial ya lo aplicó el script inline del layout, antes de pintar. */
export function initTheme() {
  const btn = document.querySelector('#theme-toggle');
  if (!btn) return;
  const apply = (t) => {
    document.documentElement.dataset.theme = t;
    btn.setAttribute('aria-pressed', String(t === 'dark'));
  };
  apply(document.documentElement.dataset.theme || 'light');
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    apply(next);
  });
}
