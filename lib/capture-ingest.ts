import type { Block } from "./types";

export const MAX_CAPTURE_BYTES = 524_288;

export type CaptureFormat = "html" | "markdown" | "text";

type SnapshotInput = {
  artifactId: string;
  format: CaptureFormat;
  raw: string;
};

type SnapshotSection = {
  heading: string;
  text: string;
};

const LOOM_HOSTS = new Set(["loom.com", "www.loom.com"]);
const LOOM_PATH = /^\/(?:share|embed)\/([A-Za-z0-9_-]+)\/?$/;

export function normalizeHttpUrl(text: string): string | null {
  const candidate = text.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function parseLoomUrl(
  text: string,
): { href: string; externalId: string; embedHref: string } | null {
  const normalized = normalizeHttpUrl(text);
  if (!normalized) return null;

  const url = new URL(normalized);
  if (!LOOM_HOSTS.has(url.hostname.toLowerCase())) return null;
  const match = url.pathname.match(LOOM_PATH);
  if (!match) return null;

  const externalId = match[1];
  return {
    href: `https://www.loom.com/share/${externalId}`,
    externalId,
    embedHref: `https://www.loom.com/embed/${externalId}`,
  };
}

export function captureFormatForName(name: string): CaptureFormat | null {
  const normalized = name.trim().toLowerCase();
  if (/\.(?:html?|xhtml|svg)$/.test(normalized)) return "html";
  if (/\.(?:md|markdown|mdown|mkd)$/.test(normalized)) return "markdown";
  if (/\.(?:txt|text)$/.test(normalized)) return "text";
  return null;
}

export function assertCaptureSize(raw: string): void {
  const bytes = new TextEncoder().encode(raw).byteLength;
  if (bytes > MAX_CAPTURE_BYTES) {
    throw new RangeError(`Capture exceeds the ${MAX_CAPTURE_BYTES}-byte limit.`);
  }
}

export function decodeUtf8Snapshot(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.byteLength > MAX_CAPTURE_BYTES) {
    throw new RangeError(`Capture exceeds the ${MAX_CAPTURE_BYTES}-byte limit.`);
  }
  // Supported capture formats are text. Fatal decoding prevents a replacement character from silently
  // changing the original bytes; retaining a BOM makes TextEncoder(raw) hash the same accepted payload.
  return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(view);
}

export async function sha256Text(raw: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is unavailable in this runtime.");
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeInline(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/[ \t\f\v]+/g, " ").trim();
}

function normalizeParagraph(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(normalizeInline)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function anchorBase(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "captured-section";
}

function blocksFromSections(artifactId: string, sections: SnapshotSection[]): Block[] {
  const anchorCounts = new Map<string, number>();
  return sections.flatMap((section, index) => {
    const heading = normalizeInline(section.heading) || `Section ${index + 1}`;
    const text = normalizeParagraph(section.text);
    if (!text) return [];

    const base = anchorBase(heading);
    const count = (anchorCounts.get(base) ?? 0) + 1;
    anchorCounts.set(base, count);
    const anchor = count === 1 ? base : `${base}-${count}`;

    return [{
      id: `${artifactId}__capture_${index + 1}`,
      artifact_id: artifactId,
      anchor,
      heading,
      text,
    }];
  });
}

function textSections(raw: string): SnapshotSection[] {
  return raw
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map(normalizeParagraph)
    .filter(Boolean)
    .map((text, index) => ({ heading: `Paragraph ${index + 1}`, text }));
}

function markdownSections(raw: string): SnapshotSection[] {
  const sections: SnapshotSection[] = [];
  let heading = "Captured content";
  let paragraphs: string[] = [];
  let paragraphLines: string[] = [];
  let fence: "`" | "~" | null = null;

  function flushParagraph() {
    const paragraph = normalizeParagraph(paragraphLines.join("\n"));
    if (paragraph) paragraphs.push(paragraph);
    paragraphLines = [];
  }

  function flushSection() {
    flushParagraph();
    if (paragraphs.length) {
      sections.push({ heading, text: paragraphs.join("\n\n") });
    }
    paragraphs = [];
  }

  for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0] as "`" | "~";
      if (fence === marker) fence = null;
      else if (fence === null) fence = marker;
      paragraphLines.push(line);
      continue;
    }

    if (!fence) {
      const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
      if (headingMatch) {
        flushSection();
        heading = normalizeInline(headingMatch[1]) || "Captured content";
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        continue;
      }
    }

    paragraphLines.push(line);
  }

  flushSection();
  return sections;
}

function decodeHtmlEntities(text: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, token: string) => {
    if (token[0] !== "#") return named[token.toLowerCase()] ?? entity;
    const hex = token[1]?.toLowerCase() === "x";
    const value = Number.parseInt(token.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isFinite(value) || value < 0 || value > 0x10ffff) return entity;
    try {
      return String.fromCodePoint(value);
    } catch {
      return entity;
    }
  });
}

function htmlPlainTextFallback(raw: string): string {
  return decodeHtmlEntities(
    raw
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/?(?:article|aside|blockquote|div|footer|h[1-6]|header|li|main|nav|ol|p|pre|section|table|tr|ul)\b[^>]*>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  );
}

function htmlSections(raw: string): SnapshotSection[] {
  if (typeof DOMParser === "undefined") return textSections(htmlPlainTextFallback(raw));

  try {
    const document = new DOMParser().parseFromString(raw, "text/html");
    document.querySelectorAll("script, style, noscript, template").forEach((node) => node.remove());

    const sections: SnapshotSection[] = [];
    let heading = "Captured content";
    let paragraphs: string[] = [];

    function flushSection() {
      if (paragraphs.length) sections.push({ heading, text: paragraphs.join("\n\n") });
      paragraphs = [];
    }

    document.body.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li, blockquote, pre").forEach((element) => {
      const tag = element.tagName.toLowerCase();
      const text = normalizeParagraph(element.textContent ?? "");
      if (!text) return;
      if (/^h[1-6]$/.test(tag)) {
        flushSection();
        heading = normalizeInline(text) || "Captured content";
        return;
      }
      if (tag === "p" && element.parentElement?.closest("li, blockquote")) return;
      paragraphs.push(text);
    });
    flushSection();

    if (sections.length) return sections;
    return textSections(document.body.textContent ?? "");
  } catch {
    return textSections(htmlPlainTextFallback(raw));
  }
}

export function snapshotBlocks({ artifactId, format, raw }: SnapshotInput): Block[] {
  assertCaptureSize(raw);
  const sections = format === "html"
    ? htmlSections(raw)
    : format === "markdown"
      ? markdownSections(raw)
      : textSections(raw);
  return blocksFromSections(artifactId, sections);
}
