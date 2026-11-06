// src/components/wallet/Orbs.tsx
// The four wallet actions as glowing orbs. Each one breathes a soft glow on
// its own slow rhythm, and the glow goes quieter while the wallet rests.
// MIT License

import React from "react";
import fx from "./Orbs.module.css";

export type FlowType = "mint" | "melt" | "send" | "claim";

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<FlowType, React.ReactNode> = {
  // lightning in
  mint: <path {...stroke} d="M13 2 5 13h6l-1 9 8-11h-6l1-9z" />,
  // lightning out
  melt: (
    <>
      <path {...stroke} d="M11 3 5 12h5l-1 7 6-9h-5l1-7z" />
      <path {...stroke} d="M16 5h4v4M20 5l-4 4" />
    </>
  ),
  // ecash out
  send: (
    <>
      <circle {...stroke} cx="12" cy="13" r="7" />
      <path {...stroke} d="M12 16V9m0 0-3 3m3-3 3 3" />
    </>
  ),
  // ecash in
  claim: (
    <>
      <circle {...stroke} cx="12" cy="13" r="7" />
      <path {...stroke} d="M12 9v7m0 0-3-3m3 3 3-3" />
    </>
  ),
};

export const FLOWS: { type: FlowType; label: string; hint: string }[] = [
  { type: "mint", label: "Mint", hint: "Lightning in" },
  { type: "melt", label: "Melt", hint: "Pay Lightning" },
  { type: "send", label: "Send", hint: "Ecash out" },
  { type: "claim", label: "Claim", hint: "Ecash in" },
];

// Breath per orb: cycle length and phase (s). The cycles differ a little, so
// the row drifts in and out of step instead of pulsing together.
const BREATH = [
  { every: 5.8, at: -0.6 },
  { every: 6.6, at: -3.4 },
  { every: 6.2, at: -1.9 },
  { every: 7, at: -5.1 },
];

export default function Orbs({
  disabled,
  resting = false,
  onPick,
}: {
  disabled: boolean;
  /** True after a while without input: the glow goes quieter. */
  resting?: boolean;
  onPick: (t: FlowType) => void;
}) {
  return (
    <div className={`${resting ? fx.resting : ""} grid w-full max-w-md grid-cols-4 gap-2 sm:gap-6`}>
      {FLOWS.map((f, i) => (
        <button
          key={f.type}
          onClick={() => onPick(f.type)}
          disabled={disabled}
          className="group flex flex-col items-center gap-2 disabled:opacity-35"
          data-testid={`orb-${f.type}`}
        >
          <span
            className="relative grid h-[72px] w-[72px] place-items-center rounded-full text-[#a3ffe0] transition duration-300 group-hover:scale-105 group-active:scale-95 group-disabled:scale-100 sm:h-20 sm:w-20"
            style={{
              background: "radial-gradient(circle at 35% 28%, rgba(163,255,224,0.35), rgba(30,58,50,0.9) 55%, rgba(7,17,13,0.95))",
              boxShadow: "inset 0 0 18px rgba(79,244,198,0.35), 0 0 30px -6px rgba(79,244,198,0.55)",
              border: "1px solid rgba(163,255,224,0.35)",
            }}
          >
            {!disabled && (
              <span aria-hidden className={fx.calm}>
                <span
                  className={fx.aura}
                  style={{ "--every": `${BREATH[i].every}s`, "--at": `${BREATH[i].at}s` } as React.CSSProperties}
                />
              </span>
            )}
            <svg viewBox="0 0 24 24" className="relative h-8 w-8 drop-shadow-[0_0_6px_rgba(163,255,224,0.8)]">
              {ICONS[f.type]}
            </svg>
          </span>
          <span className="text-base font-medium text-[#e8fff7]">{f.label}</span>
          <span className="-mt-2 text-[11px] text-[#e8fff7]/45">{f.hint}</span>
        </button>
      ))}
    </div>
  );
}
