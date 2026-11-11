// src/components/wallet/MintPrompt.tsx
// One-time card on the first tap of the Mints glyph: a short prompt to paste
// into an AI for other mints. Closing it in any way (or copying) stores
// `cocoa.mintPrompted`, and later taps open the Mints panel directly.
// MIT License

import { useState } from "react";
import Sheet from "./Sheet";
import { copyText } from "@/components/ui/CopyButton";

export const MINT_PROMPTED_KEY = "cocoa.mintPrompted";

const PROMPT = "Recommend 3 active Cashu mints that support Bitcoin (sat). Include the mint URL and a one-line note for each.";

export function mintPrompted(): boolean {
  try {
    return localStorage.getItem(MINT_PROMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markPrompted() {
  try {
    localStorage.setItem(MINT_PROMPTED_KEY, "1");
  } catch {
    // still close
  }
}

export default function MintPrompt({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const dismiss = () => {
    markPrompted();
    onClose();
  };
  return (
    <Sheet title="Want a different mint?" onClose={dismiss}>
      <div className="space-y-4" data-testid="mint-prompt">
        <p className="text-sm text-[#e8fff7]/70">Copy this and paste it into an AI.</p>
        <p className="select-all rounded-2xl border border-[#4ff4c6]/15 bg-[#07110d]/60 px-4 py-3 font-mono text-sm leading-relaxed text-[#e8fff7]">{PROMPT}</p>
        <button
          className="btn-neon"
          onClick={async () => {
            markPrompted();
            setCopied((await copyText(PROMPT)) ? "ok" : "fail");
          }}
          data-testid="mint-prompt-copy"
        >
          {copied === "ok" ? "Copied ✓" : copied === "fail" ? "Copy blocked: select the text" : "Copy"}
        </button>
        <button className="btn-ghost w-full" onClick={dismiss} data-testid="mint-prompt-done">
          {copied === "ok" ? "Done" : "Skip"}
        </button>
      </div>
    </Sheet>
  );
}
