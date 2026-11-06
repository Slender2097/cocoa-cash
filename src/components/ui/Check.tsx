// src/components/ui/Check.tsx
// Round status mark: ok, error or waiting. Waiting pulses on the same tight
// beat as the balance core while an action runs.
// MIT License

import fx from "./Check.module.css";

export function Check({ tone = "ok" }: { tone?: "ok" | "error" | "wait" }) {
  const color = tone === "error" ? "#ff8a8a" : "#a3ffe0";
  return (
    <div
      className="relative mx-auto grid h-20 w-20 place-items-center rounded-full"
      style={{ boxShadow: `0 0 50px -8px ${color}`, border: `1px solid ${color}66`, background: "rgba(7,17,13,0.6)" }}
    >
      {tone === "wait" ? (
        <>
          <span aria-hidden className={fx.ring} />
          <span aria-hidden className={fx.ring} />
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#a3ffe0]/20 border-t-[#a3ffe0]" />
        </>
      ) : (
        <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {tone === "ok" ? <path d="m5 12 5 5 9-10" /> : <path d="M7 7l10 10M17 7 7 17" />}
        </svg>
      )}
    </div>
  );
}
