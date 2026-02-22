const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function trackEvent(eventName, params = {}) {
  if (!eventName) return;

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: eventName, ...params });
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
  }
}

$$('[data-reveal]').forEach((el, i) => {
  el.style.setProperty('--reveal-delay', `${i * 90}ms`);
});

$$('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

const toastEl = document.querySelector('.toast');
let toastTimer = null;

function showToast(message) {
  if (!toastEl) return;

  toastEl.textContent = message;
  toastEl.hidden = false;

  if (toastTimer) {
    window.clearTimeout(toastTimer);
  }

  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

async function copyText(text) {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = text;
    fallback.setAttribute('readonly', '');
    fallback.style.position = 'fixed';
    fallback.style.top = '-1000px';
    document.body.appendChild(fallback);
    fallback.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(fallback);
    return copied;
  }
}

$$('[data-copy]').forEach((trigger) => {
  trigger.addEventListener('click', async () => {
    const value = trigger.getAttribute('data-copy');
    const copied = await copyText(value);

    if (copied) {
      showToast('Email скопирован.');
    } else {
      showToast('Не удалось скопировать.');
    }
  });
});

$$('[data-track]').forEach((el) => {
  el.addEventListener('click', () => {
    trackEvent(el.getAttribute('data-track'));
  });
});
