// Real artifact export — turns an artifact (+ its graph neighborhood) into a downloadable file. Three
// formats: Markdown (portable prose), HTML (self-contained styled microsite), and JSON — the last carries
// the knowledge-graph neighborhood (nodes + edges), so a Woven export leaves with its context, not just its
// text. Pure builders (testable, no DOM) + one `downloadFile` that does the Blob dance.

import { getArtifact, getBlocks, getNeighborhood, primaryCollection } from "./api";
import type { Block } from "./types";

export type ExportFormat = "markdown" | "html" | "json";
export type ExportFile = { filename: string; mime: string; content: string };

export const EXPORT_FORMATS: { key: ExportFormat; label: string; hint: string }[] = [
  { key: "markdown", label: "Markdown", hint: ".md" },
  { key: "html", label: "HTML", hint: ".html" },
  { key: "json", label: "JSON + graph", hint: ".json" },
];

function fileSlug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "artifact"
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function metaLine(id: string): string {
  const a = getArtifact(id);
  if (!a) return "";
  const coll = primaryCollection(id)?.name;
  return [a.type, coll, a.state].filter(Boolean).join(" · ");
}

// ——————————————————————————————————————————— Markdown

function blockToMarkdown(b: Block): string {
  const head = b.heading ? `## ${b.heading}\n\n` : "";
  const body = (b.text ?? "").trim();
  const quoted = b.callout ? body.replace(/^/gm, "> ") : body;
  const img = b.image ? `\n\n![${b.image.alt}](${b.image.src})${b.image.caption ? `\n*${b.image.caption}*` : ""}` : "";
  return `${head}${quoted}${img}`;
}

export function artifactToMarkdown(id: string): string {
  const a = getArtifact(id);
  if (!a) return "";
  const parts = [
    `# ${a.title}`,
    a.gist ? `\n*${a.gist}*` : "",
    `\n> ${metaLine(id)}`,
    `\n\n---\n`,
    getBlocks(id).map(blockToMarkdown).join("\n\n"),
  ];
  return parts.join("") + "\n";
}

// ——————————————————————————————————————————— HTML (self-contained, light, echoes the /a hub)

const HTML_CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f7f6f2;color:#1c1b18;font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:44rem;margin:0 auto;padding:4rem 1.5rem 6rem}
.eyebrow{font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#7a776e;margin:0}
h1{font-size:2.5rem;line-height:1.05;letter-spacing:-.02em;font-weight:600;margin:.75rem 0 0}
.gist{font-size:1.15rem;color:rgba(28,27,24,.8);margin:1.25rem 0 0}
article{margin-top:2.5rem;border-top:1px solid rgba(28,27,24,.12);padding-top:2.5rem;display:flex;flex-direction:column;gap:2rem}
h2{font-size:1.3rem;line-height:1.3;font-weight:600;margin:0}
section p{margin:.5rem 0 0;color:rgba(28,27,24,.85);white-space:pre-wrap}
.callout{background:#fff;border:1px solid rgba(28,27,24,.1);border-radius:12px;padding:1rem 1.25rem}
figure{margin:.75rem 0 0}figure img{max-width:100%;border-radius:10px}figcaption{font-size:.85rem;color:#7a776e;margin-top:.4rem}
footer{margin-top:4rem;border-top:1px solid rgba(28,27,24,.12);padding-top:1.5rem;font-size:.8rem;color:#7a776e}
`;

function blockToHTML(b: Block): string {
  const head = b.heading ? `<h2>${esc(b.heading)}</h2>` : "";
  const body = b.text ? `<p>${esc(b.text)}</p>` : "";
  const img = b.image
    ? `<figure><img src="${esc(b.image.src)}" alt="${esc(b.image.alt)}">${b.image.caption ? `<figcaption>${esc(b.image.caption)}</figcaption>` : ""}</figure>`
    : "";
  const inner = `${head}${body}${img}`;
  return `<section${b.callout ? ' class="callout"' : ""}>${inner}</section>`;
}

export function artifactToHTML(id: string): string {
  const a = getArtifact(id);
  if (!a) return "";
  const body = getBlocks(id).map(blockToHTML).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(a.title)}</title>
<style>${HTML_CSS}</style>
</head>
<body>
<div class="wrap">
<p class="eyebrow">${esc(metaLine(id))}</p>
<h1>${esc(a.title)}</h1>
${a.gist ? `<p class="gist">${esc(a.gist)}</p>` : ""}
<article>
${body}
</article>
<footer>Exported from Woven · privacy-friendly</footer>
</div>
</body>
</html>
`;
}

// ——————————————————————————————————————————— JSON (the graph-bearing format)

export function artifactToJSON(id: string): string {
  const a = getArtifact(id);
  if (!a) return "{}";
  const hood = getNeighborhood(id, 1);
  const payload = {
    woven_export: 1,
    exported_at: new Date().toISOString(),
    artifact: {
      id: a.id,
      title: a.title,
      type: a.type,
      state: a.state,
      gist: a.gist,
      collection: primaryCollection(id)?.name ?? null,
      public: a.public,
      hub_slug: a.hub_slug ?? null,
    },
    blocks: getBlocks(id).map((b) => ({ id: b.id, anchor: b.anchor, heading: b.heading, text: b.text })),
    // the differentiator — the artifact's place in the graph travels with it
    graph: { center: hood.centerId, nodes: hood.nodes, edges: hood.edges },
  };
  return JSON.stringify(payload, null, 2);
}

// ——————————————————————————————————————————— assemble + download

const EXT: Record<ExportFormat, { ext: string; mime: string }> = {
  markdown: { ext: "md", mime: "text/markdown" },
  html: { ext: "html", mime: "text/html" },
  json: { ext: "json", mime: "application/json" },
};

function buildOne(id: string, format: ExportFormat): string {
  return format === "markdown" ? artifactToMarkdown(id) : format === "html" ? artifactToHTML(id) : artifactToJSON(id);
}

// one artifact → one file; N artifacts → one combined file (MD/HTML joined, JSON as an array)
export function buildExport(ids: string[], format: ExportFormat): ExportFile {
  const { ext, mime } = EXT[format];
  if (ids.length === 1) {
    const a = getArtifact(ids[0]);
    return { filename: `${fileSlug(a?.title ?? "artifact")}.${ext}`, mime, content: buildOne(ids[0], format) };
  }
  const name = `woven-export-${ids.length}-artifacts.${ext}`;
  if (format === "json") {
    const content = JSON.stringify(
      {
        woven_export: 1,
        exported_at: new Date().toISOString(),
        artifacts: ids.map((id) => JSON.parse(artifactToJSON(id))),
      },
      null,
      2,
    );
    return { filename: name, mime, content };
  }
  if (format === "html") {
    // stitch each artifact's <article> region into one page — cheapest is to join full docs by a divider
    const content = ids.map((id) => buildOne(id, "html")).join('\n<hr style="margin:4rem 0">\n');
    return { filename: name, mime, content };
  }
  const content = ids.map((id) => buildOne(id, "markdown")).join("\n\n---\n\n");
  return { filename: name, mime, content };
}

export function downloadFile(f: ExportFile): void {
  const blob = new Blob([f.content], { type: f.mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = f.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// convenience — build + download in one call, returns the filename for the toast
export function exportArtifacts(ids: string[], format: ExportFormat): string {
  const f = buildExport(ids, format);
  downloadFile(f);
  return f.filename;
}
