// src/components/ui/CopyButton.tsx
// Clipboard helper and copy button with a short confirmation state.
// MIT License

import { useState } from "react";

export function copyText(text: string): Promise<boolean> {
  return navigator.clipboard
    .writeText(text)
    .then(() => true)
    .catch(() => false);
}

export function CopyButton({ text, label = "Copy", primary = false }: { text: string; label?: string; primary?: boolean }) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      className={primary ? "btn-neon" : "btn-ghost w-full"}
      onClick={async () => {
        setState((await copyText(text)) ? "ok" : "fail");
        setTimeout(() => setState("idle"), 1800);
      }}
    >
      {state === "ok" ? "Copied ✓" : state === "fail" ? "Copy blocked: select the text" : label}
    </button>
  );
}
