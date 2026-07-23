import type { Artifact } from "@/lib/types";

// A generated cover IMAGE for an artifact — a full-bleed abstract artwork, deterministic per-artifact so a
// card's cover is its own and stays stable across renders. Shared by Today's Continue hero and the Library
// grid view, so the two read as the same object in two densities.

// deterministic per-artifact seed
export function coverSeed(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

// A two-hue gradient mesh drawn from the identity palette, plus one soft composition (aurora / waves /
// orbits / facets) and a light sheen — real cover art, not gray bars. No two artifacts share a cover.
export function CoverArt({
  a,
  label = true,
  excerpt,
  large = false,
}: {
  a: Artifact;
  label?: boolean;
  excerpt?: string;
  large?: boolean; // the hero cover — bigger text + roomier padding
}) {
  const seed = coverSeed(a.id);
  const i1 = seed % 12;
  const i2 = (i1 + 3 + ((seed >> 6) % 4)) % 12; // a related-but-distinct palette hue for depth
  const hue1 = `var(--chart-${i1 + 1})`;
  const hue2 = `var(--chart-${i2 + 1})`;
  const variant = (seed >> 2) % 4;
  const uid = a.id.replace(/[^a-zA-Z0-9]/g, "");
  const r = (n: number, lo: number, hi: number) => lo + (((seed >> n) % 1000) / 1000) * (hi - lo);

  return (
    <div className="relative h-full w-full overflow-hidden bg-card">
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={hue1} />
            <stop offset="100%" stopColor={hue2} />
          </linearGradient>
          {/* a whisper of light — kept low so it reads matte, not glossy */}
          <radialGradient id={`sheen-${uid}`} cx="28%" cy="22%" r="85%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id={`blur-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
        </defs>

        {/* two-hue base + a blurred hue blob for mesh depth */}
        <rect width="400" height="260" fill={`url(#g-${uid})`} />
        <circle cx={r(3, 70, 330)} cy={r(7, 40, 220)} r={135} fill={hue2} opacity="0.34" filter={`url(#blur-${uid})`} />

        {variant === 0 ? (
          <>
            <circle cx={r(9, 0, 150)} cy={r(11, 130, 260)} r={125} fill="#ffffff" opacity="0.09" filter={`url(#blur-${uid})`} />
            <circle cx={r(13, 250, 400)} cy={r(15, 0, 110)} r={110} fill="#000000" opacity="0.1" filter={`url(#blur-${uid})`} />
          </>
        ) : variant === 1 ? (
          <g fill="none">
            <path
              d={`M-20 ${r(9, 150, 190)} C 110 ${r(11, 110, 150)}, 300 ${r(13, 190, 230)}, 420 ${r(15, 140, 180)}`}
              stroke="#ffffff"
              strokeOpacity="0.12"
              strokeWidth="10"
            />
            <path
              d={`M-20 ${r(17, 195, 225)} C 130 ${r(19, 150, 190)}, 280 ${r(21, 220, 250)}, 420 ${r(8, 185, 215)}`}
              stroke="#000000"
              strokeOpacity="0.1"
              strokeWidth="14"
            />
          </g>
        ) : variant === 2 ? (
          <g fill="none" stroke="#ffffff" strokeOpacity="0.11">
            {[60, 112, 168, 228].map((rr, k) => (
              <circle key={k} cx={r(9, 300, 400)} cy={r(11, 0, 70)} r={rr} strokeWidth={k === 1 ? 3 : 1.5} />
            ))}
          </g>
        ) : (
          <g>
            <polygon points={`0,260 ${r(9, 130, 210)},260 0,${r(11, 60, 140)}`} fill="#000000" opacity="0.09" />
            <polygon points={`400,0 ${r(13, 200, 300)},0 400,${r(15, 120, 200)}`} fill="#ffffff" opacity="0.09" />
          </g>
        )}

        <rect width="400" height="260" fill={`url(#sheen-${uid})`} />
      </svg>

      {/* text set over the art — the excerpt (MD) or the title (HTML), so no cover is a bare gradient */}
      {excerpt ? (
        <div
          className={`absolute inset-0 flex items-center bg-gradient-to-t from-black/55 via-black/25 to-black/10 ${
            large ? "px-7" : "px-5"
          }`}
        >
          <p
            className={`line-clamp-4 text-white/95 [text-shadow:0_1px_5px_rgba(0,0,0,0.35)] ${
              large ? "text-base leading-[1.6]" : "text-[14px] leading-[1.55]"
            }`}
          >
            {excerpt}
          </p>
        </div>
      ) : label ? (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent ${
            large ? "p-6 pt-16" : "p-3.5 pt-10"
          }`}
        >
          <h4
            className={`line-clamp-2 font-medium leading-tight text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.35)] ${
              large ? "text-2xl" : "text-[15px]"
            }`}
          >
            {a.title}
          </h4>
        </div>
      ) : null}
    </div>
  );
}
