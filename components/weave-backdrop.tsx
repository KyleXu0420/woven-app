"use client";

import * as React from "react";

// WeaveBackdrop — a STATIC, very faint grid lattice behind the graph. No animation, no colour threads:
// the background stays a calm technical substrate so the network reads clearly; the life lives on the graph
// itself (the flowing edge particles). Drawn once on mount + on resize.
export function WeaveBackdrop({ className = "" }: { className?: string }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || !el.parentElement) return;
    const cv: HTMLCanvasElement = el;
    const parent: HTMLElement = el.parentElement;
    const ctx = el.getContext("2d") as CanvasRenderingContext2D;
    const GAP = 84;

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

      // a very faint grid — the calm lattice the network sits on. +0.5 keeps the 1px lines crisp.
      ctx.strokeStyle = "rgba(90,88,80,0.045)";
      ctx.lineWidth = 1;
      for (let y = GAP; y < H; y += GAP) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(W, y + 0.5);
        ctx.stroke();
      }
      for (let x = GAP; x < W; x += GAP) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, H);
        ctx.stroke();
      }
    }

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`} />;
}
