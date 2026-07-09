"use client";

import * as React from "react";

// ── artifact drag-and-drop — the payload + the drop-target plumbing ─────────────────────────────
// An internal artifact drag carries its id(s) under a custom MIME type. A drop target can then tell an
// in-app artifact drag apart from a desktop *file* drag (which shows up as the "Files" type) DURING
// dragover — the moment the payload itself is unreadable (browser security) but the type list is not.

export const ARTIFACT_DND_TYPE = "application/x-woven-artifacts";

// write the dragged artifact id(s) onto the drag — call from a Library row's onDragStart
export function startArtifactDrag(e: React.DragEvent, ids: string[]) {
  e.dataTransfer.setData(ARTIFACT_DND_TYPE, JSON.stringify(ids));
  e.dataTransfer.setData("text/plain", ids.join(",")); // keep the drag well-formed for other surfaces
  e.dataTransfer.effectAllowed = "copyMove";
}

// read them back on drop
export function readArtifactIds(e: React.DragEvent): string[] {
  try {
    const raw = e.dataTransfer.getData(ARTIFACT_DND_TYPE);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const dragHasArtifacts = (e: React.DragEvent) => e.dataTransfer.types.includes(ARTIFACT_DND_TYPE);
export const dragHasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

// ── file → collection relay ─────────────────────────────────────────────────────────────────────
// A desktop file dropped on a collection should open Capture pre-filed to that collection. Rather than
// intercept the drop here (which would double-fire against the global capture drop zone and risk leaving
// its overlay stuck), the target just records the collection NAME on dragover; the global zone reads it
// when it opens Capture for the file. One relay value — only one collection can be under the cursor.
let pendingFileDest: string | null = null;
export const setPendingFileDest = (dest: string | null) => {
  pendingFileDest = dest;
};
export const takePendingFileDest = (): string | undefined => {
  const d = pendingFileDest;
  pendingFileDest = null;
  return d ?? undefined;
};

// ── the drop-target hook — highlight state + handlers for one collection ──────────────────────────
// Owns internal artifact drops outright; for desktop-file drops it only lights up + relays the dest and
// lets the untouched global drop zone do the actual capture (see the relay note above).
export function useCollectionDrop(opts: {
  onArtifacts: (ids: string[]) => void; // an internal artifact drag landed here
  fileDest?: string; // collection NAME to pre-file a desktop file into (undefined = don't accept files)
}) {
  const { onArtifacts, fileDest } = opts;
  const [isOver, setIsOver] = React.useState(false);
  const depth = React.useRef(0);
  const clear = React.useCallback(() => {
    depth.current = 0;
    setIsOver(false);
  }, []);

  const kinds = (e: React.DragEvent) => {
    const artifacts = dragHasArtifacts(e);
    const files = !artifacts && !!fileDest && dragHasFiles(e);
    return { artifacts, files };
  };

  const onDragEnter = (e: React.DragEvent) => {
    const { artifacts, files } = kinds(e);
    if (!artifacts && !files) return;
    e.preventDefault();
    if (files) {
      e.stopPropagation(); // keep the full-window file overlay off this target so its own cue reads
      setPendingFileDest(fileDest!);
    }
    depth.current += 1;
    setIsOver(true);
  };
  const onDragOver = (e: React.DragEvent) => {
    const { artifacts, files } = kinds(e);
    if (!artifacts && !files) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (files) {
      e.stopPropagation();
      setPendingFileDest(fileDest!);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    const { artifacts, files } = kinds(e);
    if (!artifacts && !files) return;
    if (files) e.stopPropagation();
    depth.current -= 1;
    if (depth.current <= 0) {
      clear();
      if (files) setPendingFileDest(null);
    }
  };
  const onDrop = (e: React.DragEvent) => {
    const { artifacts, files } = kinds(e);
    if (!artifacts && !files) return;
    if (artifacts) {
      e.preventDefault();
      e.stopPropagation();
      clear();
      const ids = readArtifactIds(e);
      if (ids.length) onArtifacts(ids);
    } else {
      // let the global capture drop zone handle the file — it reads the dest we relayed on dragover
      clear();
    }
  };

  return { isOver, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
