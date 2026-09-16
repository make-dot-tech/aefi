export type NavPage = "home" | "docs" | "legal";

const DEMO = "https://demo.aefi.io";
const API = "https://api.aefi.io";

export function navHtml(page: NavPage): string {
  const docsCurrent = page === "docs" ? " aria-current=\"page\"" : "";
  const homeCurrent = page === "home" ? " aria-current=\"page\"" : "";
  return `
<a class="skip" href="#content">Skip to content</a>
<header class="nav">
  <a class="nav-brand" href="/"${homeCurrent} aria-label="aefi home">
    <img src="/brand/aefi-icon.png" alt="" width="36" height="36" />
    <span>aefi</span>
  </a>
  <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-links">
    Menu
  </button>
  <nav class="nav-links" id="nav-links">
    <a href="/docs/"${docsCurrent}>Docs</a>
    <a href="/#product">Product</a>
    <a data-demo-href href="${DEMO}">Studio</a>
    <a href="/docs/api.html">API</a>
    <a class="nav-cta" data-demo-href href="${DEMO}">Open studio</a>
  </nav>
</header>`;
}

export function footerHtml(): string {
  return `
<footer class="foot">
  <div class="foot-brand">
    <img src="/brand/aefi-icon.png" alt="" width="28" height="28" />
    <div>
      <strong>aefi</strong>
      <p>Evidence for agent commerce. Settlement is not enough.</p>
    </div>
  </div>
  <div class="foot-cols">
    <div>
      <h2>Product</h2>
      <a href="/#product">What aefi does</a>
      <a data-demo-href href="${DEMO}">Evidence Studio</a>
      <a href="/docs/mcp.html">MCP</a>
      <a href="${API}/health">API health</a>
    </div>
    <div>
      <h2>Docs</h2>
      <a href="/docs/">Overview</a>
      <a href="/docs/quickstart.html">Quickstart</a>
      <a href="/docs/api.html">HTTP API</a>
      <a href="/docs/arc.html">Arc</a>
    </div>
    <div>
      <h2>Company</h2>
      <a href="mailto:augustine@aefi.io">augustine@aefi.io</a>
      <a href="/legal/privacy.html">Privacy</a>
      <a href="/legal/terms.html">Terms</a>
    </div>
  </div>
  <p class="foot-note">
    aefi indexes public Arc evidence. It is not a wallet, registry, escrow, or marketplace.
    Live graph is Arc testnet today; the model is chain-scoped for mainnet.
  </p>
</footer>`;
}

export const DOCS_ITEMS: { href: string; label: string; id: string }[] = [
  { href: "/docs/", label: "Overview", id: "overview" },
  { href: "/docs/quickstart.html", label: "Quickstart", id: "quickstart" },
  { href: "/docs/product.html", label: "Product", id: "product" },
  { href: "/docs/evidence.html", label: "Evidence model", id: "evidence" },
  { href: "/docs/api.html", label: "HTTP API", id: "api" },
  { href: "/docs/mcp.html", label: "MCP", id: "mcp" },
  { href: "/docs/studio.html", label: "Evidence Studio", id: "studio" },
  { href: "/docs/arc.html", label: "Arc", id: "arc" },
  { href: "/docs/architecture.html", label: "Architecture", id: "architecture" },
  { href: "/docs/limits.html", label: "Coverage &amp; limits", id: "limits" },
];

export function docsNavHtml(currentId: string): string {
  const items = DOCS_ITEMS.map((item) => {
    const current = item.id === currentId ? " aria-current=\"page\"" : "";
    return `<a href="${item.href}"${current}>${item.label}</a>`;
  }).join("");
  return `
<aside class="docs-side" aria-label="Documentation">
  <p class="docs-kicker">Documentation</p>
  <nav>${items}</nav>
</aside>`;
}

export function headExtras(): string {
  return `
<meta name="theme-color" content="#0a0a0a" />
<link rel="icon" type="image/png" href="/brand/aefi-icon.png" />
<link rel="apple-touch-icon" href="/brand/aefi-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;1,400&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;1,400&display=swap"
  rel="stylesheet"
/>
<meta property="og:site_name" content="aefi" />
<meta property="og:image" content="https://aefi.io/brand/aefi-logo.png" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:image" content="https://aefi.io/brand/aefi-logo.png" />
`;
}
