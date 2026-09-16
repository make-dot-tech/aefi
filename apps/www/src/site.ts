import "./styles.css";

const local =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";
const demo = local ? "http://localhost:5173" : "https://demo.aefi.io";

for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-demo-href]")) {
  a.href = demo;
}

const toggle = document.querySelector<HTMLButtonElement>(".nav-toggle");
const links = document.getElementById("nav-links");
toggle?.addEventListener("click", () => {
  const open = links?.classList.toggle("is-open") ?? false;
  toggle.setAttribute("aria-expanded", String(open));
});

document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const sel = btn.getAttribute("data-copy");
    const el = sel ? document.querySelector(sel) : btn.previousElementSibling;
    const text = el?.textContent?.trim() ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    const prev = btn.textContent;
    btn.textContent = "Copied";
    window.setTimeout(() => {
      btn.textContent = prev;
    }, 1400);
  });
});

const healthEl = document.querySelector("[data-api-health]");
if (healthEl) {
  const urls = local
    ? ["http://localhost:8787/health", "https://api.aefi.io/health"]
    : ["https://api.aefi.io/health"];
  void (async () => {
    for (const url of urls) {
      try {
        const body = (await (await fetch(url)).json()) as {
          ok?: boolean;
          neo4j?: string;
        };
        const graph = body.neo4j === "ok";
        healthEl.textContent = graph ? "graph live" : "api up · graph idle";
        healthEl.classList.toggle("is-live", graph);
        healthEl.classList.toggle("is-idle", !graph);
        return;
      } catch {
        /* try next */
      }
    }
    healthEl.textContent = "api unreachable";
    healthEl.classList.add("is-idle");
  })();
}

const nav = document.querySelector(".nav");
if (nav) {
  const onScroll = () => nav.classList.toggle("is-stuck", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}
