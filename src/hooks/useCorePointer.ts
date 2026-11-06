// src/hooks/useCorePointer.ts
// How a pointer or finger near an element pulls on it, written straight to
// CSS variables on that element so the browser can move layers without a
// React render:
//   --px, --py   lean toward the pointer, -1..1 (full within ~1.15 radii)
//   --lean       length of that lean, 0..1
//   --angle      direction of the pointer in degrees, 0 at the top, clockwise
//   --near       closeness, 0..1 (1 near the middle, 0 past ~2.4 radii)
// Values ease toward the pointer every frame and the loop stops once they
// settle. With `enabled` false nothing is attached; with `active` false the
// values ease back to rest (a panel is open, say).
// MIT License

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const EASE = 0.12; // share of the remaining distance covered per frame
const VARS = ["--px", "--py", "--lean", "--angle", "--near"];

/** 0 at `from`, 1 at `to`, smooth in between (either direction). */
const smooth = (from: number, to: number, x: number) => {
  const t = Math.min(Math.max((x - from) / (to - from), 0), 1);
  return t * t * (3 - 2 * t);
};

export default function useCorePointer(ref: RefObject<HTMLElement | null>, enabled: boolean, active: boolean) {
  const kickRef = useRef<() => void>(() => {});
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
    kickRef.current(); // ease to the new target (or back to rest)
  }, [active]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let pointer: { x: number; y: number } | null = null;
    let x = 0, y = 0, near = 0; // eased values
    let raf = 0;

    const target = () => {
      if (!pointer || !activeRef.current) return { x: 0, y: 0, near: 0 };
      const r = el.getBoundingClientRect();
      const radius = r.width / 2 || 1;
      const dx = (pointer.x - (r.left + radius)) / radius;
      const dy = (pointer.y - (r.top + r.height / 2)) / radius;
      const d = Math.hypot(dx, dy);
      const k = smooth(2.6, 1.15, d) / Math.max(d, 1);
      return { x: dx * k, y: dy * k, near: smooth(2.4, 0.5, d) };
    };

    const write = () => {
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
      el.style.setProperty("--lean", Math.min(Math.hypot(x, y), 1).toFixed(3));
      el.style.setProperty("--angle", ((Math.atan2(x, -y) * 180) / Math.PI).toFixed(1));
      el.style.setProperty("--near", near.toFixed(3));
    };

    const frame = () => {
      const t = target();
      x += (t.x - x) * EASE;
      y += (t.y - y) * EASE;
      near += (t.near - near) * EASE;
      const settled = Math.abs(t.x - x) + Math.abs(t.y - y) + Math.abs(t.near - near) < 0.002;
      if (settled) ({ x, y, near } = t);
      write();
      raf = settled ? 0 : requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kickRef.current = kick;

    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY };
      kick();
    };
    const onLeave = () => {
      pointer = null;
      kick();
    };
    // A finger only counts while it touches; a mouse until it leaves the window.
    const onUp = (e: PointerEvent) => e.pointerType !== "mouse" && onLeave();
    const onOut = (e: PointerEvent) => !e.relatedTarget && onLeave();

    const opts = { passive: true } as const;
    window.addEventListener("pointermove", onMove, opts);
    window.addEventListener("pointerdown", onMove, opts);
    window.addEventListener("pointerup", onUp, opts);
    window.addEventListener("pointercancel", onLeave, opts);
    window.addEventListener("pointerout", onOut, opts);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onLeave);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener("blur", onLeave);
      cancelAnimationFrame(raf);
      kickRef.current = () => {};
      for (const v of VARS) el.style.removeProperty(v);
    };
  }, [ref, enabled]);
}
