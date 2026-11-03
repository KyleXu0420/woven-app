import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CAPTURE_BYTES,
  assertCaptureSize,
  captureFormatForName,
  decodeUtf8Snapshot,
  normalizeHttpUrl,
  parseLoomUrl,
  sha256Text,
  snapshotBlocks,
} from "../lib/capture-ingest.ts";

test("normalizeHttpUrl accepts only absolute HTTP URLs", () => {
  assert.equal(normalizeHttpUrl(" https://example.com/path?q=1 "), "https://example.com/path?q=1");
  assert.equal(normalizeHttpUrl("http://localhost:4322/inbox"), "http://localhost:4322/inbox");
  assert.equal(normalizeHttpUrl("ftp://example.com/file"), null);
  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("file:///tmp/capture.html"), null);
  assert.equal(normalizeHttpUrl("https://user:secret@example.com/private"), null);
  assert.equal(normalizeHttpUrl("/relative/path"), null);
  assert.equal(normalizeHttpUrl("not a url"), null);
});

test("parseLoomUrl canonicalizes share and embed URLs", () => {
  const expected = {
    href: "https://www.loom.com/share/abc_DEF-123",
    externalId: "abc_DEF-123",
    embedHref: "https://www.loom.com/embed/abc_DEF-123",
  };

  assert.deepEqual(parseLoomUrl("https://loom.com/share/abc_DEF-123?sid=ignored"), expected);
  assert.deepEqual(parseLoomUrl("https://www.loom.com/embed/abc_DEF-123"), expected);
  assert.equal(parseLoomUrl("https://example.com/share/abc_DEF-123"), null);
  assert.equal(parseLoomUrl("https://loom.com/video/abc_DEF-123"), null);
  assert.equal(parseLoomUrl("https://loom.com/share/abc_DEF-123/extra"), null);
});

test("captureFormatForName recognizes supported extensions case-insensitively", () => {
  assert.equal(captureFormatForName("prototype.HTML"), "html");
  assert.equal(captureFormatForName("archive/page.htm"), "html");
  assert.equal(captureFormatForName("decision.MD"), "markdown");
  assert.equal(captureFormatForName("notes.markdown"), "markdown");
  assert.equal(captureFormatForName("transcript.txt"), "text");
  assert.equal(captureFormatForName("README"), null);
  assert.equal(captureFormatForName("diagram.svg"), "html");
  assert.equal(captureFormatForName("capture.pdf"), null);
});

test("assertCaptureSize measures UTF-8 bytes and rejects oversized captures", () => {
  assert.doesNotThrow(() => assertCaptureSize("a".repeat(MAX_CAPTURE_BYTES)));
  assert.throws(
    () => assertCaptureSize("a".repeat(MAX_CAPTURE_BYTES + 1)),
    (error) => error instanceof RangeError && /524288-byte limit/.test(error.message),
  );
  assert.throws(() => assertCaptureSize("é".repeat(MAX_CAPTURE_BYTES / 2 + 1)), RangeError);
});

test("file snapshots preserve valid UTF-8 bytes and reject lossy decoding", () => {
  const original = Uint8Array.from([0xef, 0xbb, 0xbf, 0x68, 0xc3, 0xa9]);
  const decoded = decodeUtf8Snapshot(original);
  assert.deepEqual(new TextEncoder().encode(decoded), original);
  assert.throws(() => decodeUtf8Snapshot(Uint8Array.from([0xff])), TypeError);
  assert.throws(() => decodeUtf8Snapshot(new Uint8Array(MAX_CAPTURE_BYTES + 1)), RangeError);
});

test("sha256Text returns the standard lowercase SHA-256 digest", async () => {
  assert.equal(
    await sha256Text("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("snapshotBlocks splits text and Markdown without a DOM", () => {
  const textBlocks = snapshotBlocks({
    artifactId: "a_text",
    format: "text",
    raw: "First paragraph.\n\nSecond paragraph.",
  });
  assert.deepEqual(
    textBlocks.map(({ heading, text }) => ({ heading, text })),
    [
      { heading: "Paragraph 1", text: "First paragraph." },
      { heading: "Paragraph 2", text: "Second paragraph." },
    ],
  );

  const markdownBlocks = snapshotBlocks({
    artifactId: "a_markdown",
    format: "markdown",
    raw: "# Decision\n\nShip the cap.\n\n## Evidence\n\nDeployment run 184.",
  });
  assert.deepEqual(
    markdownBlocks.map(({ heading, text, anchor }) => ({ heading, text, anchor })),
    [
      { heading: "Decision", text: "Ship the cap.", anchor: "decision" },
      { heading: "Evidence", text: "Deployment run 184.", anchor: "evidence" },
    ],
  );
});

test("HTML capture uses the safe plain-text fallback when DOMParser is unavailable", () => {
  assert.equal(typeof globalThis.DOMParser, "undefined");
  const blocks = snapshotBlocks({
    artifactId: "a_html",
    format: "html",
    raw: "<h1>Decision</h1><p>Ship &amp; verify.</p><script>ignore()</script>",
  });
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].text, "Decision");
  assert.equal(blocks[1].text, "Ship & verify.");
  assert.equal(blocks.some((block) => block.text.includes("ignore")), false);
});
