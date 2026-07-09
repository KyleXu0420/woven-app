"use client";

import * as React from "react";

// WeaveBackdrop — the landing page's woven-thread canvas, brought behind the graph. Coloured weft
// (horizontal) + warp (vertical) threads travel along an implicit grid with an over/under weave, trailed
// by slow drifting dots. Ambient and very quiet: it gives the canvas life (the "Woven" metaphor) without
// competing with the node-link graph painted on top. Honours prefers-reduced-motion (one static frame).
export function WeaveBackdrop({ className = "" }: { className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return;
    const cv: HTMLCanvasElement = el;
    const parent: HTMLElement = el.parentElement;
    const ctx = el.getContext("2d") as CanvasRenderingContext2D;

    // muted, on-brand thread tones (forest · slate · ochre) — subtle enough to read on either ground
    const COLORS = ["#3d5c47", "#4b6981", "#8a7440"];
    const rgba = (hex: string, a: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let W = 0;
    let H = 0;
    let hLines: number[] = [];
    let vLines: number[] = [];
    type Thread = {
      axis: "h" | "v";
      track: number;
      head: number;
      speed: number;
      color: string;
      phase: number;
      ao: number;
      au: number;
      pause: number;
    };
    let threads: Thread[] = [];

    const GAP = 76;
    function build() {
      hLines = [];
      vLines = [];
      for (let y = GAP; y < H; y += GAP) hLines.push(y);
      for (let x = GAP; x < W; x += GAP) vLines.push(x);
      threads = [];
      // weft (horizontal) — few, slow
      const hN = Math.min(3, hLines.length);
      for (let i = 0; i < hN; i++) {
        const track = hLines[Math.floor((i + 0.5) * (hLines.length / Math.max(1, hN)))];
        threads.push({ axis: "h", track, head: Math.random() * W, speed: 24 + Math.random() * 20, color: COLORS[i % COLORS.length], phase: i % 2, ao: 0.22, au: 0.055, pause: Math.random() * 2 });
      }
      // warp (vertical) — more, to lean the weave vertical like the landing tuning
      const vN = Math.min(6, vLines.length);
      for (let i = 0; i < vN; i++) {
        const track = vLines[Math.floor((i + 0.5) * (vLines.length / Math.max(1, vN)))];
        threads.push({ axis: "v", track, head: Math.random() * H, speed: 18 + Math.random() * 16, color: COLORS[(i + 1) % COLORS.length], phase: i % 2, ao: 0.19, au: 0.05, pause: Math.random() * 2 });
      }
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = parent.clientWidth;
      H = parent.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    let raf = 0;
    let last = performance.now();
    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, W, H);

      // the woven grid — a faint constant lattice the threads travel along (the landing's "graph paper")
      ctx.strokeStyle = "rgba(72,70,62,0.05)";
      ctx.lineWidth = 1;
      for (const y of hLines) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      for (const x of vLines) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      for (const t of threads) {
        if (t.pause > 0) {
          t.pause -= dt;
          continue;
        }
        t.head += t.speed * dt;
        const span = t.axis === "h" ? W : H;
        if (t.head > span + 30) {
          t.head = -30;
          t.pause = 1.5 + Math.random() * 2.5;
          continue;
        }
        const perp = t.axis === "h" ? vLines : hLines;
        const pts = [0, ...perp.filter((p) => p > 0 && p < t.head), t.head];
        let fade = 1;
        if (t.head < 90) fade = Math.max(0, t.head / 90);
        else if (t.head > span - 60) fade = Math.max(0, (span + 30 - t.head) / 90);
        ctx.lineCap = "butt";
        for (let s = 0; s < pts.length - 1; s++) {
          const p0 = pts[s];
          const p1 = pts[s + 1];
          if (p0 >= p1) continue;
          const over = (s + t.phase) % 2 === 0;
          ctx.strokeStyle = rgba(t.color, (over ? t.ao : t.au) * fade);
          ctx.lineWidth = over ? 1.3 : 0.6;
          ctx.beginPath();
          if (t.axis === "h") {
            ctx.moveTo(p0, t.track);
            ctx.lineTo(p1, t.track);
          } else {
            ctx.moveTo(t.track, p0);
            ctx.lineTo(t.track, p1);
          }
          ctx.stroke();
        }
      }

      if (!reduce) raf = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    if (reduce) frame(performance.now());
    else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} />;
}
