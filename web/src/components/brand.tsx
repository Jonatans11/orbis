import { Link } from "react-router-dom";

/** Refined monoline ORBIS mark: an orbital ring with an offset node. */
export function Mark({ size = 26, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id="orbisMark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7aa0ff" />
          <stop offset="1" stopColor="#35d0c0" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="6.2" fill="url(#orbisMark)" />
      <ellipse cx="16" cy="16" rx="13" ry="5.4" stroke="url(#orbisMark)" strokeWidth="1.5" transform="rotate(-27 16 16)" opacity="0.9" />
      <circle cx="26.4" cy="9.6" r="2.1" fill="#eaf1ff" />
    </svg>
  );
}

export function Wordmark({ size = 15, markSize = 24, className = "" }: { size?: number; markSize?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark size={markSize} />
      <span className="font-semibold tracking-[-0.02em] text-ink" style={{ fontSize: size }}>
        ORBIS<span className="text-ink-3 font-normal">.ID</span>
      </span>
    </span>
  );
}

export function BrandLink({ to = "/", size = 15, markSize = 24 }: { to?: string; size?: number; markSize?: number }) {
  return (
    <Link to={to} className="focusable inline-flex rounded-md" aria-label="ORBIS.ID home">
      <Wordmark size={size} markSize={markSize} />
    </Link>
  );
}
