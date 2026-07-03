"use client";

// components/home/AmbientBackground.tsx
// ✅ "use client" — color reacts to active hero item via prop

interface AmbientBackgroundProps {
  /** Hex color (e.g. "#e94560") from the active hero's coverImage.color */
  color?: string | null;
}

/**
 * Fixed-position ambient mesh background.
 * Renders soft animated gradient blobs that subtly tint the page with the
 * active hero's cover color. Sits behind all content (z -10).
 */
export function AmbientBackground({ color = "#e94560" }: AmbientBackgroundProps) {
  const safeColor = color && color.startsWith("#") ? color : "#e94560";

  return (
    <div
      aria-hidden
      className="fixed inset-0 -z-10 overflow-hidden bg-xan-dark pointer-events-none"
    >
      {/* Base radial vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(255,255,255,0.04), transparent 70%)",
        }}
      />

      {/* Primary color blob — top right */}
      <div
        className="absolute -top-32 -right-32 w-[55vw] h-[55vw] rounded-full blur-[120px] opacity-30 animate-mesh transition-colors duration-[2000ms]"
        style={{ background: safeColor }}
      />

      {/* Secondary violet blob — bottom left */}
      <div className="absolute -bottom-40 -left-32 w-[55vw] h-[55vw] rounded-full blur-[120px] opacity-25 animate-mesh-2 bg-xan-violet" />

      {/* Tertiary crimson blob — center */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[40vw] h-[40vw] rounded-full blur-[140px] opacity-15 animate-mesh bg-xan-crimson" />

      {/* Bottom fade to solid for content legibility */}
      <div
        className="absolute inset-x-0 bottom-0 h-1/3"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(10,10,10,0.6) 60%, #0a0a0a 100%)",
        }}
      />

      {/* Subtle grain */}
      <div className="absolute inset-0 grain-overlay" />
    </div>
  );
}
