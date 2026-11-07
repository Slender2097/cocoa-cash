// src/hooks/useVisibleArea.ts
// The part of the screen a person can actually see on a phone: the visual
// viewport, which shrinks when the on-screen keyboard opens. Returns its top
// offset and height in CSS pixels so a fixed layer can sit inside it, or null
// on wider screens (and before mount), where nothing needs to move.
// MIT License

import { useEffect, useState } from "react";

export type VisibleArea = { top: number; height: number };

const PHONE = "(max-width: 639px)"; // below Tailwind's `sm`

export default function useVisibleArea(): VisibleArea | null {
  const [area, setArea] = useState<VisibleArea | null>(null);

  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const vv = window.visualViewport;
    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!mq.matches) return setArea(null);
        const top = vv ? vv.offsetTop : 0;
        const height = vv ? vv.height : window.innerHeight;
        setArea((a) => (a && a.top === top && a.height === height ? a : { top, height }));
      });
    };

    measure();
    mq.addEventListener("change", measure);
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      mq.removeEventListener("change", measure);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, []);

  return area;
}
