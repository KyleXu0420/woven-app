// The Woven mark — the woven signal-wave (the "w" of the wordmark, lifted out): scattered sources flow in as
// one line and converge to a single output. The line is `currentColor` so it themes with its context (inks in
// light, whitens in dark — one component, no second file); the trailing output dot is the ONE forest accent
// (`var(--primary)`), matching the product's single-accent rule. The brand lockup and every public "Published
// with Woven" footer render this same glyph. Wide by nature — size it by height (`h-* w-auto`).
export function WovenMark({ className = "h-3 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="180 168 892 360" className={className} fill="none" aria-hidden="true">
      <path
        d="M220 210H310C350 210 370 236 382 282L420 422C430 458 448 478 474 478C500 478 518 458 528 422L566 282C578 236 598 210 638 210C678 210 698 236 710 282L748 422C758 458 776 478 802 478C828 478 846 458 856 422L894 282C906 236 926 210 966 210H1030"
        stroke="currentColor"
        strokeWidth="54"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="980" cy="478" r="30" fill="var(--primary)" />
    </svg>
  );
}

// The full "woven." wordmark — continuous single-stroke line (the "e" stylized toward a 2, per the brand
// board). Same theming contract: line = currentColor, the node dot + output dot = the forest accent.
export function WovenWordmark({ className = "h-6 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1503 228" className={className} fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="35" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.5 22.9092H38C61.75 22.9092 88 42.909 98 82.909L120.5 172.909C126.75 197.909 135.25 208.5 151.5 208.5C167.75 208.5 177.5 196.659 183.75 171.659L206.25 82.909C216.25 42.909 236.75 22.9092 260.5 22.9092H273C296.75 22.9092 316 42.909 326 82.909L348.5 172.909C354.75 197.909 363.25 208.5 379.5 208.5C395.75 208.5 405.5 196.659 411.75 171.659L434.25 82.909C444.25 42.909 481.75 22.9092 505.5 22.9092L713.5 17.5C734.75 17.5 748.5 32.5 758.5 57.5L802.25 171.25C808.5 190 819.75 208.5 836 208.5C852.25 208.5 863.5 190 869.75 171.25L914.747 57.5C924.747 32.5 938.497 17.8018 959.747 17.8018H1010" />
        <path d="M1009.5 17.8018H1124.5C1160.75 17.8018 1182 35.4541 1182 66.7041C1182 97.9544 1160.75 113.704 1124.5 113.704H1057C1025.75 113.704 1009.5 136.954 1009.5 160.704C1009.5 186.954 1028.25 208.802 1060.75 208.802H1182" />
        <path d="M1251.5 208.5V95.8017C1251.5 54.5517 1280.76 22.8994 1328.5 22.8994C1376.24 22.8994 1405.5 54.5517 1405.5 95.8017V208.5" />
        <path d="M576.5 208.899C627.31 208.899 668.5 166.814 668.5 114.9C668.5 62.9845 627.31 20.8994 576.5 20.8994" />
      </g>
      <circle cx="552.5" cy="114.5" r="24" fill="var(--primary)" />
      <circle cx="1478.5" cy="203.5" r="24" fill="var(--primary)" />
    </svg>
  );
}
