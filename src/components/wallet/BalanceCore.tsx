// src/components/wallet/BalanceCore.tsx
// The glowing balance at the center of the wallet, plus the mint it belongs to.
// MIT License

import React, { useEffect, useRef, useState } from "react";

function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - t0) / 900, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

export const mintLabel = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

export default function BalanceCore({
  balance,
  mint,
  connected,
  onMints,
}: {
  balance: number;
  mint: string;
  connected: boolean;
  onMints: () => void;
}) {
  const shown = useCountUp(balance);
  const digits = shown.toLocaleString("en-US");
  const size = digits.length > 9 ? "text-5xl" : digits.length > 6 ? "text-6xl" : "text-7xl sm:text-8xl";

  return (
    <div className="flex flex-col items-center">
      <div className="relative grid aspect-square w-[min(78vw,330px)] sm:w-[380px] place-items-center">
        {/* halo */}
        <div
          aria-hidden
          className="anim-breathe absolute inset-[-12%] rounded-full blur-2xl"
          style={{ background: "radial-gradient(circle, rgba(79,244,198,0.28) 0%, rgba(79,244,198,0) 65%)" }}
        />
        {/* rings */}
        <svg aria-hidden viewBox="0 0 200 200" className="anim-spin-slow absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#a3ffe0" stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#4ff4c6" stopOpacity="0.05" />
              <stop offset="1" stopColor="#4ff4c6" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="97" fill="none" stroke="url(#ring)" strokeWidth="1.2" />
          <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(79,244,198,0.18)" strokeWidth="0.6" strokeDasharray="1 5" />
        </svg>
        <svg aria-hidden viewBox="0 0 200 200" className="anim-spin-rev absolute inset-[9%] h-[82%] w-[82%]">
          <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(163,255,224,0.25)" strokeWidth="0.8" strokeDasharray="40 18 6 18" />
        </svg>
        {/* lens */}
        <div
          aria-hidden
          className="absolute inset-[15%] rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 30%, rgba(163,255,224,0.12), rgba(20,37,31,0.85) 55%, rgba(7,17,13,0.95))",
            boxShadow: "inset 0 0 40px rgba(79,244,198,0.18), 0 0 60px -10px rgba(79,244,198,0.35)",
          }}
        />
        <div className="relative text-center" data-testid="balance">
          <div className={`${size} font-extralight tabular-nums tracking-tight text-[#e8fff7] glow-text`}>{digits}</div>
          <div className="mt-1 text-sm font-light uppercase tracking-[0.5em] text-[#a3ffe0]/80">sat</div>
        </div>
      </div>

      <button
        onClick={onMints}
        className="mt-4 flex min-h-11 max-w-[90vw] items-center gap-2 rounded-full border border-[#4ff4c6]/20 bg-[#07110d]/40 px-4 py-2 text-sm text-[#e8fff7]/80 transition hover:border-[#4ff4c6]/60"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-[#4ff4c6] shadow-[0_0_10px_#4ff4c6]" : "bg-[#e8fff7]/25"}`}
        />
        <span className="truncate">{mint ? mintLabel(mint) : "Choose a mint"}</span>
      </button>
    </div>
  );
}
