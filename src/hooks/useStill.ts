// src/hooks/useStill.ts
// Small signals for when the wallet's ambient motion can stop, so a phone left
// on the wallet screen does not keep its GPU busy (and warm) for nothing.
// MIT License

import { useEffect, useState, useSyncExternalStore } from "react";

const onVisibilityChange = (cb: () => void) => {
  document.addEventListener("visibilitychange", cb);
  return () => document.removeEventListener("visibilitychange", cb);
};

/** True while the page is in the background (another tab or app, screen off). */
export const usePageHidden = () =>
  useSyncExternalStore(onVisibilityChange, () => document.visibilityState === "hidden", () => false);

/** True once `on` has stayed true for `ms`, false again as soon as it is not. */
export function useHeld(on: boolean, ms: number): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (!on) return;
    const t = window.setTimeout(() => setHeld(true), ms);
    return () => {
      window.clearTimeout(t);
      setHeld(false);
    };
  }, [on, ms]);
  return on && held;
}
