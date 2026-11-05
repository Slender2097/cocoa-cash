// src/components/wallet/BalanceCore.tsx
// The glowing balance at the center of the wallet, plus the mint it belongs to.
//
// The core reacts when the balance moves. Sats in (a mint, a claim, a tip
// claimed in another tab) send a bright wave out through the rings and light
// around the rim; sats out (a melt, a send) draw the rings in and dim the glow
// for a moment. It watches the `balance` prop only, which every proof change
// already flows into, so no Cashu code is involved. A change that lands while
// the core is covered by a panel, or while the tab is hidden, is held and
// played once the core can be seen again.
// MIT License

import React, { memo, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import fx from "./BalanceCore.module.css";
import { mintLabel } from "@/lib/utils/mintLabel";

type Flow = "in" | "out";
/** The latest reaction. A new `id` restarts its animations; `dir` is null once it has played. */
type Beat = { id: number; dir: Flow | null };

const SETTLE_MS = 80; // changes that land together play as one reaction
const REVEAL_MS = 280; // after a panel closes, let the eye find the core first
const PLAY_MS: Record<Flow, number> = { in: 2000, out: 1500 }; // longest animation, delays included

// Sparks that race along the rim when sats come in: start angle, distance, delay.
const SPARKS = [
  { from: 18, travel: 215, delay: 120 },
  { from: 138, travel: 190, delay: 170 },
  { from: 258, travel: 235, delay: 220 },
];

const REDUCE = "(prefers-reduced-motion: reduce)";
const onReduceChange = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useReducedMotion = () =>
  useSyncExternalStore(onReduceChange, () => window.matchMedia(REDUCE).matches, () => false);

const onVisibilityChange = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};
const usePageVisible = () =>
  useSyncExternalStore(onVisibilityChange, () => document.visibilityState !== "hidden", () => true);

/** Counts from what is on screen to `value`. Instant when motion is reduced. */
function useCountUp(value: number, instant: boolean) {
  const [shown, setShown] = useState(value);
  const onScreen = useRef(value);
  useEffect(() => {
    const start = onScreen.current;
    if (start === value) return;
    const duration = instant ? 0 : 900;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = duration ? Math.min(Math.max((t - t0) / duration, 0), 1) : 1;
      onScreen.current = Math.round(start + (value - start) * (1 - Math.pow(1 - p, 3)));
      setShown(onScreen.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, instant]);
  return shown;
}

/** The number. Kept apart so the per-frame count re-renders only this. */
const Readout = memo(function Readout({ value, beat, instant }: { value: number; beat: number; instant: boolean }) {
  const shown = useCountUp(value, instant);
  const digits = shown.toLocaleString("en-US");
  const size = digits.length > 9 ? "text-5xl" : digits.length > 6 ? "text-6xl" : "text-7xl sm:text-8xl";
  return (
    <div className="relative text-center" data-testid="balance">
      <div key={beat} className={`${fx.num} ${size} font-extralight tabular-nums tracking-tight text-[#e8fff7] glow-text`}>
        {digits}
      </div>
      <div className="mt-1 text-sm font-light uppercase tracking-[0.5em] text-[#a3ffe0]/80">sat</div>
    </div>
  );
});

export default function BalanceCore({
  balance,
  mint,
  connected,
  covered = false,
  onMints,
}: {
  balance: number;
  mint: string;
  connected: boolean;
  /** True while a panel or modal sits over the core. Reactions wait until it is gone. */
  covered?: boolean;
  onMints: () => void;
}) {
  const ringGradient = useId();
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const seen = !covered && pageVisible;

  // What the core shows follows `balance`, but only while someone can see it.
  const [shown, setShown] = useState({ balance, mint });
  const [beat, setBeat] = useState<Beat>({ id: 0, dir: null });
  const held = useRef(false);

  useEffect(() => {
    if (balance === shown.balance && mint === shown.mint) {
      held.current = false;
      return;
    }
    if (!seen) {
      held.current = true;
      return;
    }
    // Another mint is another balance, not sats moving: count to it quietly.
    const moved = mint === shown.mint;
    const t = window.setTimeout(
      () => {
        held.current = false;
        setShown({ balance, mint });
        if (moved) setBeat((b) => ({ id: b.id + 1, dir: balance > shown.balance ? "in" : "out" }));
      },
      held.current ? REVEAL_MS : moved ? SETTLE_MS : 0
    );
    return () => window.clearTimeout(t);
  }, [balance, mint, seen, shown]);

  // Back to idle once the reaction has played.
  useEffect(() => {
    if (!beat.dir) return;
    const t = window.setTimeout(() => setBeat((b) => ({ ...b, dir: null })), PLAY_MS[beat.dir]);
    return () => window.clearTimeout(t);
  }, [beat]);

  const flow = beat.dir ?? undefined;
  const wave = flow === "in" ? fx.expand : fx.collapse;

  return (
    // overflow-x-clip: the waves and spinning rings reach past the core, never past the page.
    <div className="flex w-full flex-col items-center overflow-x-clip">
      <div
        className={`${fx.core} relative grid aspect-square w-[min(78vw,330px)] sm:w-[380px] place-items-center`}
        data-flow={flow}
      >
        {/* halo */}
        <div aria-hidden className="anim-breathe absolute inset-[-12%]">
          <div
            key={beat.id}
            className={`${fx.halo} h-full w-full rounded-full blur-2xl`}
            style={{ background: "radial-gradient(circle, rgba(79,244,198,0.28) 0%, rgba(79,244,198,0) 65%)" }}
          />
        </div>
        {/* outer ring and dotted track: slow spin, slow breath */}
        <div aria-hidden className="anim-spin-slow absolute inset-0">
          <div className={`${fx.breathe} h-full w-full`}>
            <svg key={beat.id} viewBox="0 0 200 200" className={`${fx.outer} h-full w-full`}>
              <defs>
                <linearGradient id={ringGradient} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#a3ffe0" stopOpacity="0.9" />
                  <stop offset="0.5" stopColor="#4ff4c6" stopOpacity="0.05" />
                  <stop offset="1" stopColor="#4ff4c6" stopOpacity="0.6" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="97" fill="none" stroke={`url(#${ringGradient})`} strokeWidth="1.2" />
              <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(79,244,198,0.26)" strokeWidth="0.6" strokeDasharray="1 5" />
            </svg>
          </div>
        </div>
        {/* dashed segments, counter-rotating, with a soft glow under each dash */}
        <div aria-hidden className="anim-spin-rev absolute inset-[9%]">
          <svg key={beat.id} viewBox="0 0 200 200" className={`${fx.dash} h-full w-full`}>
            <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(79,244,198,0.1)" strokeWidth="3.2" strokeDasharray="40 18 6 18" />
            <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(163,255,224,0.45)" strokeWidth="0.9" strokeDasharray="40 18 6 18" />
          </svg>
        </div>
        {/* the reaction's waves and sparks, under the lens */}
        {flow && !reduced && (
          <React.Fragment key={`wave${beat.id}`}>
            <span aria-hidden className={`${fx.wave} ${wave}`} />
            <span aria-hidden className={`${fx.wave} ${wave} ${fx.echo}`} />
            {flow === "in" &&
              SPARKS.map((s) => (
                <span
                  key={s.from}
                  aria-hidden
                  className={fx.spark}
                  style={{ "--from": `${s.from}deg`, "--travel": `${s.travel}deg`, animationDelay: `${s.delay}ms` } as React.CSSProperties}
                />
              ))}
          </React.Fragment>
        )}
        {/* lens */}
        <div
          aria-hidden
          className="absolute inset-[15%] rounded-full"
          style={{
            background: "radial-gradient(circle at 35% 30%, rgba(163,255,224,0.12), rgba(20,37,31,0.85) 55%, rgba(7,17,13,0.95))",
            boxShadow: "inset 0 0 40px rgba(79,244,198,0.18), 0 0 60px -10px rgba(79,244,198,0.35)",
          }}
        />
        {flow && (
          <span
            key={`lens${beat.id}`}
            aria-hidden
            className={`absolute inset-[15%] rounded-full ${flow === "in" ? fx.charge : fx.drain}`}
          />
        )}
        <Readout value={shown.balance} beat={beat.id} instant={reduced} />
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
