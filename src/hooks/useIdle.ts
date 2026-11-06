// src/hooks/useIdle.ts
// True once nobody has touched, moved, scrolled or typed for `ms`, and false
// again at the first sign of someone. Input only stamps a time; a slow timer
// checks it, so constant pointer movement costs next to nothing.
// MIT License

import { useEffect, useState } from "react";

const INPUT = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

export default function useIdle(ms: number): boolean {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    let last = performance.now();
    let resting = false;
    const stir = () => {
      last = performance.now();
      if (resting) {
        resting = false;
        setIdle(false);
      }
    };
    const onVisibility = () => document.visibilityState === "visible" && stir();
    const check = window.setInterval(() => {
      if (!resting && performance.now() - last >= ms) {
        resting = true;
        setIdle(true);
      }
    }, 1000);

    for (const e of INPUT) window.addEventListener(e, stir, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      for (const e of INPUT) window.removeEventListener(e, stir);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(check);
    };
  }, [ms]);

  return idle;
}
