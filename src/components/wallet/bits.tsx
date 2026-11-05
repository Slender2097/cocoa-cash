// src/components/wallet/bits.tsx
// Small shared pieces: glyph buttons (existing artwork), QR plate, copy button.
// MIT License

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

/** Round button showing one of the existing glyph images (wide PNGs, art centered). */
export function Glyph({ src, label, onClick, size = 52 }: { src: string; label: string; onClick: () => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={GLYPH_CLS}
      style={{ width: size, height: size }}
    >
      <Image src={src} alt="" fill sizes={`${size * 2}px`} className="scale-[1.55] object-cover drop-shadow-[0_0_8px_rgba(79,244,198,0.6)]" />
    </button>
  );
}

const GLYPH_CLS =
  "relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-[#4ff4c6]/15 bg-[#07110d]/40 transition hover:border-[#4ff4c6]/60 hover:shadow-[0_0_24px_-6px_#4ff4c6] active:scale-95";

/** Header link to the tip board (/creator), drawn to match the glyph images. */
export function TipsGlyph({ size = 52 }: { size?: number }) {
  return (
    <Link href="/creator" aria-label="Tip board" title="Tip board" className={GLYPH_CLS} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" className="h-8 w-8 text-[#4ff4c6] drop-shadow-[0_0_8px_rgba(79,244,198,0.7)]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
        <path d="M12 20.5s-7.5-4.4-7.5-10.1A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 7.5 2.8c0 5.7-7.5 10.1-7.5 10.1z" />
        <path d="m12.8 9.5-2.3 3.4h2.6l-1 3" />
      </svg>
    </Link>
  );
}

export function QrPlate({ value }: { value: string }) {
  return (
    <div className="mx-auto w-fit rounded-3xl bg-white p-3 shadow-[0_0_60px_-12px_rgba(79,244,198,0.8)]">
      <QRCodeSVG value={value} size={232} level="L" marginSize={1} />
    </div>
  );
}

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}

export function CopyButton({ text, label = "Copy", primary = false }: { text: string; label?: string; primary?: boolean }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      className={primary ? "btn-neon" : "btn-ghost w-full"}
      onClick={async () => {
        setState((await copyText(text)) ? "ok" : "fail");
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "ok" ? "Copied ✓" : state === "fail" ? "Copy blocked: select the text" : label}
    </button>
  );
}

export function Check({ tone = "ok" }: { tone?: "ok" | "error" | "wait" }) {
  const color = tone === "error" ? "#ff8a8a" : "#a3ffe0";
  return (
    <div
      className="mx-auto grid h-20 w-20 place-items-center rounded-full"
      style={{ boxShadow: `0 0 50px -8px ${color}`, border: `1px solid ${color}66`, background: "rgba(7,17,13,0.6)" }}
    >
      {tone === "wait" ? (
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#a3ffe0]/20 border-t-[#a3ffe0]" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {tone === "ok" ? <path d="m5 12 5 5 9-10" /> : <path d="M7 7l10 10M17 7 7 17" />}
        </svg>
      )}
    </div>
  );
}
