// src/components/wallet/HeaderGlyphs.tsx
// Round header buttons around the wallet line glyphs.
// MIT License

import type { CSSProperties } from "react";
import { GlyphIcon, type GlyphName } from "./GlyphIcons";

// Every header circle is the same size: 52px, or the `--glyph` length the
// header sets so a full row still fits a narrow phone. An explicit `size`
// (px) overrides both.
const box = (size?: number): CSSProperties =>
  size ? { width: size, height: size } : { width: "var(--glyph, 52px)", height: "var(--glyph, 52px)" };

/** Round header button around one of the line glyphs in GlyphIcons. */
export function Glyph({ name, label, onClick, size }: { name: GlyphName; label: string; onClick: () => void; size?: number }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={GLYPH_CLS} style={box(size)}>
      <GlyphIcon name={name} size={glyphSize(size)} />
    </button>
  );
}

const GLYPH_CLS =
  "relative grid shrink-0 place-items-center rounded-full border border-[#4ff4c6]/15 bg-[#07110d]/40 transition hover:border-[#4ff4c6]/60 hover:shadow-[0_0_24px_-6px_#4ff4c6] active:scale-95";

// The glyph box is 70% of the button, so the middle 26 units the glyphs are
// drawn in span about 57% of the circle: at 52px every stroke stays 8px or
// more clear of the frame.
const glyphSize = (size?: number) => (size ? Math.round(size * 0.7) : "70%");
