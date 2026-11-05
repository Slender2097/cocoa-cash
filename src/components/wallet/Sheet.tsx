// src/components/wallet/Sheet.tsx
// Floating holographic panel: a bottom sheet on phones, centered on wider
// screens. Escape or a tap outside closes it.
// MIT License

import React, { useEffect } from "react";

export default function Sheet({
  title,
  onClose,
  children,
  z = 50,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  z?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="anim-fade fixed inset-0 flex items-end justify-center bg-[#020806]/70 backdrop-blur-sm sm:items-center sm:p-6"
      style={{ zIndex: z }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="glass anim-rise max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] px-6 pb-8 pt-5 sm:rounded-[2rem]">
        <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#a3ffe0]/70 to-transparent" />
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#e8fff7]/15 sm:hidden" />
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
    </div>
  );
}
