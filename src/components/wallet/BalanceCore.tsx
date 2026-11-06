// src/components/wallet/BalanceCore.tsx
// The glowing balance at the center of the wallet, plus the mint it belongs to.
//
// The core is the wallet's power core, a living instrument:
// - Energy: while awake a current runs through the rings (bright heads with
//   long tails, the rim and track one way, the dashed ring the other), the
//   rim glows, and every 16 to 18 s the rim flares once so it never looks
//   asleep.
// - Presence: the rings lean toward a nearby pointer or finger and light up
//   hard on that side, two light streaks chase it around the rim, a beam runs
//   out to it and the lens flares toward it. When it leaves, the light
//   lingers a moment and settles (useCorePointer).
// - Mood: dim until a mint is connected. Connecting, or the first touch after
//   a rest, sends one wave of light out through the rings. While an action
//   runs the current speeds up and the lens pulses tight and bright; after a
//   while without input it breathes slower and deeper. Opening a panel
//   tightens the rings and brightens the lens for a moment, then softens it;
//   closing the panel wakes it with a short flare.
// - Reactions: when the balance goes up (a mint, a claim, a tip claimed in
//   another tab) a bright wave leaves the rings and sparks run around the rim;
//   when it goes down (a melt, a send) the rings draw in and the glow dips.
//   The core only watches the `balance` prop, which every proof change already
//   flows into, so no Cashu code is involved. A change that lands while the
//   core is covered by a panel, or while the tab is hidden, is held and played
//   once the core can be seen again.
// The number itself never leans, drifts or dims (beyond a short dip when sats
// go out), so it stays readable at all times.
// MIT License

import React, { memo, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import fx from "./BalanceCore.module.css";
import { mintLabel } from "@/lib/utils/mintLabel";
import useCorePointer from "@/hooks/useCorePointer";

type Flow = "in" | "out";
/** The latest reaction. A new `id` restarts its animations; `dir` is null once it has played. */
type Beat = { id: number; dir: Flow | null };
/** How alive the core looks when nothing else is going on. */
type Mood = "asleep" | "awake" | "resting";
/** A wake-up moment: a wave out through the rings, or a short flare. */
type WakeKind = "surge" | "flare";

const SETTLE_MS = 80; // changes that land together play as one reaction
const REVEAL_MS = 420; // after a panel closes, let the core wake before it reacts
const WAKE_MS: Record<WakeKind, number> = { surge: 1800, flare: 1000 }; // wake-up moments, longest animation
const PLAY_MS: Record<Flow, number> = { in: 2000, out: 1500 }; // longest animation, delays included

// Sparks that race along the rim when sats come in: start angle, distance, delay.
const SPARKS = [
  { from: 18, travel: 215, delay: 120 },
  { from: 138, travel: 190, delay: 170 },
  { from: 258, travel: 235, delay: 220 },
];

const LENS_STYLE = {
  background: "radial-gradient(circle at 35% 30%, rgba(163,255,224,0.12), rgba(20,37,31,0.85) 55%, rgba(7,17,13,0.95))",
  boxShadow: "inset 0 0 40px rgba(79,244,198,0.18), 0 0 60px -10px rgba(79,244,198,0.35)",
};

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
  processing = false,
  covered = false,
  resting = false,
  onMints,
}: {
  balance: number;
  mint: string;
  connected: boolean;
  /** True while a wallet action is running. The core pulses, tight and focused. */
  processing?: boolean;
  /** True while a panel or modal sits over the core. It dims, and reactions wait until it is gone. */
  covered?: boolean;
  /** True after a while without input. The core breathes slower and deeper. */
  resting?: boolean;
  onMints: () => void;
}) {
  const ringGradient = useId();
  const coreRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const seen = !covered && pageVisible;

  // The rings follow a nearby pointer, except under a panel or with reduced motion.
  useCorePointer(coreRef, !reduced, !covered);

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

  // Waking up. The mint coming online, or someone returning after a rest,
  // sends a wave out through the rings; a panel closing gets a short flare.
  const [was, setWas] = useState({ covered, resting, connected });
  const [wake, setWake] = useState<{ id: number; kind: WakeKind | null }>({ id: 0, kind: null });
  if (was.covered !== covered || was.resting !== resting || was.connected !== connected) {
    const surge = (was.resting && !resting) || (!was.connected && connected);
    const flare = was.covered && !covered;
    setWas({ covered, resting, connected });
    if (surge || flare) setWake((w) => ({ id: w.id + 1, kind: surge ? "surge" : "flare" }));
  }
  useEffect(() => {
    if (!wake.kind) return;
    const t = window.setTimeout(() => setWake((w) => ({ ...w, kind: null })), WAKE_MS[wake.kind]);
    return () => window.clearTimeout(t);
  }, [wake]);

  const flow = beat.dir ?? undefined;
  const wave = flow === "in" ? fx.expand : fx.collapse;
  // A reaction briefly wakes a resting core; a panel on top is handled by data-covered.
  const mood: Mood = resting && !flow && !covered && !processing ? "resting" : connected ? "awake" : "asleep";

  return (
    // The glow, waves and rings reach past the core; the page clips them at its
    // own edge (see index.tsx), so they fade out instead of stopping short.
    <div className="flex w-full flex-col items-center">
      <div
        ref={coreRef}
        className={`${fx.core} relative grid aspect-square w-[min(78vw,330px)] sm:w-[380px] place-items-center`}
        data-mood={mood}
        data-flow={flow}
        data-busy={processing || undefined}
        data-covered={covered || undefined}
        data-waking={wake.kind ?? undefined}
      >
        {/* Everything but the number: dims and focuses with the mood. */}
        <div aria-hidden className={fx.stage}>
          <div className={fx.focus}>
            {/* halo, drifting against the pointer for depth */}
            <div className={`${fx.haloDepth} absolute inset-[-12%]`}>
              <div className="anim-breathe h-full w-full">
                <div
                  key={beat.id}
                  className={`${fx.halo} h-full w-full rounded-full blur-2xl`}
                  style={{ background: "radial-gradient(circle, rgba(79,244,198,0.28) 0%, rgba(79,244,198,0) 65%)" }}
                />
              </div>
            </div>
            {/* deep breath, only while resting */}
            <div className={fx.deep} />
            {/* the rim lights up as a panel opens */}
            <span className={fx.ack} />

            {/* rings: lean toward the pointer, and drift on their own */}
            <div className={fx.tilt}>
              <div className={fx.drift}>
                {/* outer ring and dotted track: slow spin, slow breath */}
                <div className="anim-spin-slow absolute inset-0">
                  <div className={`${fx.breathe} h-full w-full`}>
                    {/* the powered rim: a steady glow along the outer ring */}
                    <span className={fx.rimGlow} />
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
                {/* breathing that shows as the pointer comes close */}
                <div className={fx.near}>
                  <span className={fx.aura} />
                </div>
                {/* the energy current: rim and track clockwise, dashed ring the other way */}
                <span className={fx.current}>
                  <span className={fx.head} />
                </span>
                <span className={fx.counter} />
                {/* a faster current while an action runs */}
                <span className={fx.rush} />
                {/* the rim flares once every 16 to 18 s */}
                <span className={fx.ringFlare} />
                {/* the side facing the pointer lights up: rings, a beam, the lens rim */}
                <span className={fx.arc}>
                  <span className={fx.beam} />
                  <span className={fx.lensFlare} />
                </span>
                {/* light streaks that chase the pointer around the rim */}
                <span className={`${fx.streak} ${fx.streakA}`} />
                <span className={`${fx.streak} ${fx.streakB}`} />
                {/* dashed segments, counter-rotating, with a soft glow under each dash */}
                <div className="anim-spin-rev absolute inset-[9%]">
                  <svg key={beat.id} viewBox="0 0 200 200" className={`${fx.dash} h-full w-full`}>
                    <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(79,244,198,0.1)" strokeWidth="3.2" strokeDasharray="40 18 6 18" />
                    <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(163,255,224,0.45)" strokeWidth="0.9" strokeDasharray="40 18 6 18" />
                  </svg>
                </div>
                {/* connecting or returning after a rest: one wave of light out through the rings */}
                {wake.kind === "surge" && !reduced && <span key={`surge${wake.id}`} className={fx.surge} />}
                {/* the reaction's waves and sparks, under the lens */}
                {flow && !reduced && (
                  <React.Fragment key={`wave${beat.id}`}>
                    <span className={`${fx.wave} ${wave}`} />
                    <span className={`${fx.wave} ${wave} ${fx.echo}`} />
                    {flow === "in" &&
                      SPARKS.map((s) => (
                        <span
                          key={s.from}
                          className={fx.spark}
                          style={{ "--from": `${s.from}deg`, "--travel": `${s.travel}deg`, animationDelay: `${s.delay}ms` } as React.CSSProperties}
                        />
                      ))}
                  </React.Fragment>
                )}
              </div>
            </div>

            {/* lens, a touch closer than the rings */}
            <div className={`${fx.lensDepth} absolute inset-[15%]`}>
              <div className="absolute inset-0 rounded-full" style={LENS_STYLE} />
              <div className={fx.glow} />
              <div className={fx.glintClip}>
                <span className={fx.glint} />
              </div>
              {flow && <span key={`lens${beat.id}`} className={`absolute inset-0 rounded-full ${flow === "in" ? fx.charge : fx.drain}`} />}
              <span className={fx.pulse} />
              <span className={fx.pulse} />
              {/* the lens brightens for a moment: a panel opening, a wake-up */}
              <span key={`flash${wake.id}`} className={fx.lensFlash} />
              <span key={`wake${wake.id}`} className={fx.wake} />
            </div>
          </div>
        </div>

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
