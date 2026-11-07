// src/components/wallet/Sheet.tsx
// Floating holographic panel: a bottom sheet on phones, centered on wider
// screens. A soft light runs along its top edge as it opens, and again now
// and then. Escape or a tap outside closes it. While an action runs (busy),
// the veil thins so the working core shows through it.
// With `keyboard`, a phone gets a centered panel instead: it lives inside the
// visible area (above the on-screen keyboard) and follows it as the keyboard
// opens and closes, so the field being typed in stays in view.
// MIT License

import React, { useEffect, useRef } from "react";
import useVisibleArea from "@/hooks/useVisibleArea";

export default function Sheet({
  title,
  onClose,
  children,
  z = 50,
  busy = false,
  keyboard = false,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  z?: number;
  busy?: boolean;
  /** Phones: center the panel in the area left above the keyboard. Desktop is unaffected. */
  keyboard?: boolean;
}) {
  const visible = useVisibleArea();
  const area = keyboard ? visible : null;
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // When the visible area shrinks, keep the focused field in view inside the panel.
  useEffect(() => {
    const p = panel.current;
    const el = document.activeElement as HTMLElement | null;
    if (!area || !p || !el || el === p || !p.contains(el)) return;
    const pr = p.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top < pr.top || er.bottom > pr.bottom) {
      p.scrollTop += er.top - pr.top - (pr.height - er.height) / 2;
    }
  }, [area]);

  const content = (
    <div
      ref={panel}
      className={`glass anim-rise w-full max-w-md overflow-y-auto px-6 pt-5 ${
        area ? "rounded-[2rem] pb-6" : "max-h-[92dvh] rounded-t-[2rem] pb-8 sm:rounded-[2rem]"
      }`}
      style={area ? { maxHeight: area.height - 24 } : undefined}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px overflow-hidden bg-gradient-to-r from-transparent via-[#a3ffe0]/70 to-transparent">
        <span className="anim-sheen absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-[#e8fff7] to-transparent" />
      </div>
      {!area && <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e8fff7]/15 sm:hidden" />}
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-medium tracking-wide text-[#e8fff7]">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-2xl leading-none text-[#4ff4c6]/80 transition hover:bg-white/5 hover:text-[#a3ffe0]"
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );

  return (
    <div
      className="anim-fade fixed inset-0 flex items-end justify-center backdrop-blur-sm sm:items-center sm:p-6"
      style={{ zIndex: z }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      {/* the veil's tint, on its own layer so it can thin with opacity alone */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-[#020806]/70 transition-opacity duration-700 motion-reduce:transition-none ${busy ? "opacity-50" : ""}`}
      />
      {area ? (
        // positioned to the visible area; a tap on its empty space still closes
        <div
          className="absolute inset-x-0 flex items-center justify-center p-3 transition-[top,height] duration-200 ease-out motion-reduce:transition-none"
          style={{ top: area.top, height: area.height }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
}
