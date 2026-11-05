// src/components/wallet/HeaderGlyphs.tsx
// Round header buttons around the wallet line glyphs.
// MIT License

import Link from "next/link";
import { GlyphIcon, type GlyphName } from "./GlyphIcons";

/** Round header button around one of the line glyphs in GlyphIcons. */
export function Glyph({ name, label, onClick, size = 52 }: { name: GlyphName; label: string; onClick: () => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={GLYPH_CLS}
      style={{ width: size, height: size }}
    >
      <GlyphIcon name={name} size={glyphSize(size)} />
    </button>
  );
}

const GLYPH_CLS =
  "relative grid shrink-0 place-items-center rounded-full border border-[#4ff4c6]/15 bg-[#07110d]/40 transition hover:border-[#4ff4c6]/60 hover:shadow-[0_0_24px_-6px_#4ff4c6] active:scale-95";

// The glyph box is 70% of the button, so the middle 26 units the glyphs are
// drawn in span about 57% of the circle: at 52px every stroke stays 8px or
// more clear of the frame.
const glyphSize = (size: number) => Math.round(size * 0.7);

/** Header link to the tip board (/creator), drawn in the same glyph family. */
export function TipsGlyph({ size = 52 }: { size?: number }) {
  return (
    <Link href="/creator" aria-label="Tip board" title="Tip board" className={GLYPH_CLS} style={{ width: size, height: size }}>
      <GlyphIcon name="tips" size={glyphSize(size)} />
    </Link>
  );
}
