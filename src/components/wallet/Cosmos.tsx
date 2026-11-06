// src/components/wallet/Cosmos.tsx
// Fixed deep-space backdrop: two soft light refractions and a faint organic
// circuit with a few pulses travelling along it. The whole field breathes
// very slowly and the refractions drift; now and then a distant glow crosses
// the dark or a circuit node flares and sends out a ripple. Everything stays
// dim and away from the middle, so nothing competes with the balance, and it
// goes quieter while the wallet rests. Purely decorative.
// MIT License

import type { CSSProperties } from "react";
import fx from "./Cosmos.module.css";

const TRACES = [
  "M-20 140 C 120 120, 160 260, 300 240 S 470 120, 620 180 S 820 330, 1040 260",
  "M-20 620 C 140 560, 220 700, 380 660 S 560 520, 720 600 S 900 760, 1040 700",
  "M180 -20 C 200 120, 120 220, 200 340 S 330 520, 260 700 S 300 900, 240 1040",
  "M820 -20 C 780 140, 880 260, 800 400 S 700 600, 820 760 S 760 920, 860 1040",
];
const NODES: [number, number][] = [
  [300, 240],
  [620, 180],
  [380, 660],
  [720, 600],
  [200, 340],
  [800, 400],
];

// Nodes that flare now and then: which node, cycle length (s), phase (s).
// The cycles differ so the flares never fall into a pattern.
const FLARES = [
  { node: 0, every: 13, at: -3 },
  { node: 2, every: 17, at: -11 },
  { node: 3, every: 19, at: -6 },
];

// The circuit is a 1024 square drawn "slice", centered: map a node to the
// same spot in the backdrop (cq units come from the container below).
const onNode = ([x, y]: [number, number]): CSSProperties => ({
  left: `calc(50cqw + ${(((x - 512) / 1024) * 100).toFixed(3)}cqmax)`,
  top: `calc(50cqh + ${(((y - 512) / 1024) * 100).toFixed(3)}cqmax)`,
});

export default function Cosmos({ resting = false }: { resting?: boolean }) {
  return (
    <div
      aria-hidden
      className={`${fx.cosmos} pointer-events-none fixed inset-0 -z-10 overflow-hidden`}
      data-resting={resting || undefined}
    >
      <div className={fx.space}>
        <div className={fx.driftA}>
          <div
            className="anim-breathe absolute -top-1/4 left-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(79,244,198,0.16) 0%, rgba(79,244,198,0) 60%)" }}
          />
        </div>
        <div className={fx.driftB}>
          <div
            className="absolute -bottom-1/3 -right-1/4 h-[60vmax] w-[60vmax] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(163,255,224,0.08) 0%, rgba(163,255,224,0) 60%)" }}
          />
        </div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1024 1024" preserveAspectRatio="xMidYMid slice">
          <g fill="none" strokeLinecap="round">
            {TRACES.map((d, i) => (
              <path key={i} d={d} stroke="rgba(79,244,198,0.07)" strokeWidth="1.2" />
            ))}
            {TRACES.map((d, i) => (
              <path
                key={`p${i}`}
                d={d}
                stroke="rgba(163,255,224,0.55)"
                strokeWidth="1.6"
                className="anim-trace"
                style={{ animationDelay: `${-i * 2.3}s` }}
              />
            ))}
          </g>
          {NODES.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.2" fill="rgba(163,255,224,0.35)" />
          ))}
        </svg>
        {/* distant glows and node flares */}
        <div className={fx.life}>
          <span className={`${fx.wisp} ${fx.wispA}`} />
          <span className={`${fx.wisp} ${fx.wispB}`} />
          <span className={`${fx.wisp} ${fx.wispC}`} />
          {FLARES.map((f) => (
            <span
              key={f.node}
              className={fx.flare}
              style={{ ...onNode(NODES[f.node]), "--every": `${f.every}s`, "--at": `${f.at}s` } as CSSProperties}
            />
          ))}
        </div>
      </div>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(4,10,8,0.7) 100%)" }} />
    </div>
  );
}
