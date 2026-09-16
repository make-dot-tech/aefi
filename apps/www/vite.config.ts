import { defineConfig } from "vite";
import { readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import { docsNavHtml, footerHtml, headExtras, navHtml, type NavPage } from "./src/chrome";

const root = resolve(__dirname);

function htmlFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === "public") continue;
    const p = resolve(dir, name);
    if (statSync(p).isDirectory()) htmlFiles(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

function pageKind(rel: string): NavPage {
  if (rel.startsWith("docs/")) return "docs";
  if (rel.startsWith("legal/")) return "legal";
  return "home";
}

function docsId(rel: string): string {
  if (rel === "docs/index.html") return "overview";
  const m = rel.match(/^docs\/([a-z0-9-]+)\.html$/);
  return m?.[1] ?? "overview";
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  appType: "mpa",
  server: { port: 5174 },
  plugins: [
    {
      name: "aefi-chrome",
      transformIndexHtml(html, ctx) {
        const file = ctx.filename
          ? ctx.filename
          : resolve(root, (ctx.path ?? "").replace(/^\//, ""));
        const rel = relative(root, file).replaceAll("\\", "/");
        const kind = pageKind(rel);
        let out = html
          .replace("<!--AEFI_HEAD-->", headExtras())
          .replace("<!--AEFI_NAV-->", navHtml(kind))
          .replace("<!--AEFI_FOOTER-->", footerHtml());
        if (out.includes("<!--AEFI_DOCS_NAV-->")) {
          out = out.replace("<!--AEFI_DOCS_NAV-->", docsNavHtml(docsId(rel)));
        }
        return out;
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        htmlFiles(root).map((file) => {
          const rel = relative(root, file).replaceAll("\\", "/").replace(/\.html$/, "");
          return [rel === "index" ? "main" : rel.replaceAll("/", "-"), file];
        }),
      ),
    },
  },
});
