// src/components/wallet/Cosmos.tsx
// Fixed deep-space backdrop: two soft light refractions and a faint organic
// circuit with a few pulses travelling along it. Purely decorative.
// MIT License

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

export default function Cosmos() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="anim-breathe absolute -top-1/4 left-1/2 h-[70vmax] w-[70vmax] -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(79,244,198,0.16) 0%, rgba(79,244,198,0) 60%)" }}
      />
      <div
        className="absolute -bottom-1/3 -right-1/4 h-[60vmax] w-[60vmax] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(163,255,224,0.08) 0%, rgba(163,255,224,0) 60%)" }}
      />
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
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(4,10,8,0.7) 100%)" }} />
    </div>
  );
}
