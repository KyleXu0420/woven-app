"use client";

import * as React from "react";

// WeaveBackdrop — a STATIC woven texture behind the graph: a faint grid lattice with a few colour threads
// woven over/under along it. No animation — motion behind the content distracts from it; the life lives on
// the graph itself (flowing particles). Drawn once on mount + on resize.
export function WeaveBackdrop({ className = "" }: { className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return;
    const cv: HTMLCanvasElement = el;
    const parent: HTMLElement = el.parentElement;
    const ctx = el.getContext("2d") as CanvasRenderingContext2D;

    const COLORS = ["#3d5c47", "#4b6981", "#8a7440"];
    const rgba = (hex: string, a: number) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    };
    const GAP = 76;

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const W = parent.clientWidth;
      const H = parent.clientHeight;
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const hLines: number[] = [];
      const vLines: number[] = [];
      for (let y = GAP; y < H; y += GAP) hLines.push(y);
      for (let x = GAP; x < W; x += GAP) vLines.push(x);

      // faint grid lattice
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

      // a few static colour threads, woven over/under at each crossing — subtle texture, no motion
      const thread = (axis: "h" | "v", track: number, color: string, phase: number) => {
        const perp = axis === "h" ? vLines : hLines;
        const span = axis === "h" ? W : H;
        const pts = [0, ...perp, span];
        for (let s = 0; s < pts.length - 1; s++) {
          const over = (s + phase) % 2 === 0;
          ctx.strokeStyle = rgba(color, over ? 0.13 : 0.035);
          ctx.lineWidth = over ? 1.2 : 0.6;
          ctx.beginPath();
          if (axis === "h") {
            ctx.moveTo(pts[s], track);
            ctx.lineTo(pts[s + 1], track);
          } else {
            ctx.moveTo(track, pts[s]);
            ctx.lineTo(track, pts[s + 1]);
          }
          ctx.stroke();
        }
      };
      if (hLines.length) thread("h", hLines[Math.floor(hLines.length * 0.34)], COLORS[0], 0);
      if (hLines.length > 2) thread("h", hLines[Math.floor(hLines.length * 0.72)], COLORS[1], 1);
      if (vLines.length) thread("v", vLines[Math.floor(vLines.length * 0.28)], COLORS[1], 0);
      if (vLines.length > 2) thread("v", vLines[Math.floor(vLines.length * 0.56)], COLORS[0], 1);
      if (vLines.length > 3) thread("v", vLines[Math.floor(vLines.length * 0.82)], COLORS[2], 0);
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} />;
}
