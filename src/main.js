const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Stagger reveal animations (keeps layout simple, makes the page feel alive).
$$("[data-reveal]").forEach((el, i) => {
  el.style.setProperty("--d", `${i * 90}ms`);
});

// Current year.
$$("[data-year]").forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});

const toastEl = document.querySelector(".toast");
let toastTimer = null;

function toast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.hidden = false;

  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2200);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

$$("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const value = btn.getAttribute("data-copy");
    if (!value) return;

    const ok = await copyToClipboard(value);
    if (ok) {
      toast("Скопировано.");
      return;
    }

    // Fallback (older browsers / blocked clipboard permission).
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    toast("Скопировано.");
  });
});

// Placeholder links: keep them visible, but don't send users to nowhere by accident.
$$("a[data-placeholder]").forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    toast("Надо обновить ссылку.");
  });
});

const sceneCanvas = document.getElementById("scene");
if (sceneCanvas instanceof HTMLCanvasElement) {
  const boot = async () => {
    try {
      const { initThreeBackgroundCrane } = await import("./scene.js");
      initThreeBackgroundCrane(sceneCanvas);
    } catch {
      // If WebGL/Three fails for any reason, keep the page usable.
    }
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => void boot(), { timeout: 1200 });
  } else {
    window.setTimeout(() => void boot(), 350);
  }
}
