// src/components/wallet/GlyphIcons.tsx
// The four header glyphs as one family of neon line icons: the palenque hut
// (mints), the glyph clock (history), the guardian with spear and shield
// (seed vault) and the heart with a bolt (tip board).
// MIT License
//
// Every glyph is drawn on the same 32×32 grid with the same 1.4 stroke and
// round ends, centred and kept inside the middle 26×26 units. Rendered at one
// size they carry the same weight, keep the same padding inside their round
// buttons and share one glow. Detail is kept to what still reads at 36px.

import React from "react";

export type GlyphName = "mints" | "history" | "vault" | "tips";

const GLYPHS: Record<GlyphName, React.ReactNode> = {
  // Hut: conical roof flaring past the walls, one ring on the roof, arched door.
  mints: (
    <>
      <path d="M6.4 17.6L4 16.4Q11 12.6 14.6 4.9Q16 3.3 17.4 4.9Q21 12.6 28 16.4L25.6 17.6L25.9 24.6C25.9 26.7 20.2 27.6 16 27.6C11.8 27.6 6.1 26.7 6.1 24.6Z" />
      <path d="M10.3 12.6Q16 14.9 21.7 12.6" />
      <path d="M13.3 27.4V22.9A2.7 2.7 0 0 1 18.7 22.9V27.4" />
    </>
  ),
  // Clock: a ring broken at 12, 3, 6 and 9 with a tick in each gap, arrow hands at 10:10.
  history: (
    <>
      <path d="M19.11 4.41A12 12 0 0 1 27.59 12.89M27.59 19.11A12 12 0 0 1 19.11 27.59M12.89 27.59A12 12 0 0 1 4.41 19.11M4.41 12.89A12 12 0 0 1 12.89 4.41" />
      <path d="M16 3V6.6M29 16H25.4M16 29V25.4M3 16H6.6" />
      <path d="M9.76 12.4L16 16L24.23 11.25M11.93 12.02L9.76 12.4L10.52 14.47M23.47 13.32L24.23 11.25L22.06 10.87" />
    </>
  ),
  // Guardian: spear in one hand, conical hat, round shield held in front of the
  // body (the body lines stop short of the shield instead of crossing it).
  vault: (
    <>
      <path d="M7 3.6L8.5 6.9L7 9.2L5.5 6.9ZM7 9.2V28.4" />
      <path d="M10.8 9.4L14.6 5.2Q15.4 4.4 16.2 5.2L20 9.4Q15.4 10.6 10.8 9.4Z" />
      <circle cx="15.4" cy="12.4" r="2.4" />
      <path d="M16.6 16.2H12.6L15.4 22L12.9 28.4M15.4 22L17.9 28.4M12.6 16.2L7.9 19.6" />
      <circle cx="22" cy="19.8" r="4.6" />
      <circle cx="22" cy="19.8" r="1.5" />
    </>
  ),
  // Heart with a lightning bolt.
  tips: (
    <>
      <path d="M16 26C16 26 5.2 20.2 5.2 12.9C5.2 9.4 7.8 6.9 11 6.9C13.1 6.9 14.9 8 16 9.9C17.1 8 18.9 6.9 21 6.9C24.2 6.9 26.8 9.4 26.8 12.9C26.8 20.2 16 26 16 26Z" />
      <path d="M17.3 11.8L13.9 17.2H18.1L14.7 22" />
    </>
  ),
};

/** The same glow on every glyph: a tight halo plus a soft bloom. */
const GLOW = "drop-shadow(0 0 1.5px rgba(79,244,198,0.85)) drop-shadow(0 0 5px rgba(79,244,198,0.45))";

/** One header glyph, `size` px square. Decorative: the button around it carries the label. */
export function GlyphIcon({ name, size }: { name: GlyphName; size: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className="shrink-0 text-[#4ff4c6]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: GLOW }}
    >
      {GLYPHS[name]}
    </svg>
  );
}
