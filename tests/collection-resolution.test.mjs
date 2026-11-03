import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
  VIEWER,
  createCollection,
  findCollectionBySlug,
} from "../lib/api.ts";

test("strict collection lookup resolves the requested seed and never substitutes the first collection", () => {
  for (const [slug, id] of [["q4-roadmap", "co_q4"], ["growth", "co_growth"], ["research", "co_research"]]) {
    assert.equal(findCollectionBySlug(slug)?.id, id);
  }
  for (const slug of ["bogus-slug", "", "Q4-Roadmap"]) {
    assert.equal(findCollectionBySlug(slug), undefined);
  }
});

test("strict route lookup applies the existing viewer access boundary", () => {
  assert.equal(findCollectionBySlug("q4-roadmap", VIEWER)?.id, "co_q4");
  assert.equal(findCollectionBySlug("q4-roadmap", "pe_not_a_member"), undefined);
});

test("a newly created collection resolves by its own slug after hydration in a fresh process", (t) => {
  const saved = new Map();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  });

  const collection = createCollection({ name: "Route reload contract", kind: "simple", color: "var(--chart-5)" });
  assert.equal(findCollectionBySlug(collection.slug)?.id, collection.id);
  const snapshot = saved.get("woven:state:v1");
  assert.ok(snapshot, "creation must persist the browser-local collection");

  // Fresh module state proves this route cannot resolve before hydration. The persisted payload travels
  // through stdin, and only the public API restores it; the test never imports or edits seed arrays.
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import { readFileSync } from "node:fs";
    import { findCollectionBySlug, hydrateState } from ${JSON.stringify(new URL("../lib/api.ts", import.meta.url).href)};
    const { snapshot, slug, id } = JSON.parse(readFileSync(0, "utf8"));
    assert.equal(findCollectionBySlug(slug), undefined);
    globalThis.window = {};
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: key => key === "woven:state:v1" ? snapshot : null },
    });
    await hydrateState();
    assert.equal(findCollectionBySlug(slug)?.id, id);
    assert.equal(findCollectionBySlug("bogus-slug"), undefined);
    process.stdout.write("restored");
  `], {
    input: JSON.stringify({ snapshot, slug: collection.slug, id: collection.id }),
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  assert.equal(output, "restored");
});
