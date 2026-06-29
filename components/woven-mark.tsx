// The Woven loom mark — three warps crossed by two wefts. Shared so the brand lockup
// and the agent's avatar render the *same* glyph: in Woven, the agent is the brand.
export function WovenMark({ className = "size-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 26 26"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M8 7v12M13 7v12M18 7v12" opacity=".55" />
      <path d="M6 10h14M6 16h14" />
    </svg>
  );
}
