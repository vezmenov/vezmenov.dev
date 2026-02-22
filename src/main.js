const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function trackEvent(eventName, params = {}) {
  if (!eventName) return;

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: eventName, ...params });
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

$$('[data-reveal]').forEach((el, i) => {
  el.style.setProperty('--reveal-delay', `${i * 95}ms`);
});

$$('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

$$('[data-track]').forEach((el) => {
  el.addEventListener('click', () => {
    trackEvent(el.getAttribute('data-track'));
  });
});
