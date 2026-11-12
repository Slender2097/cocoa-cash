// src/components/wallet/MintPrompt.tsx
// Cards with a short prompt to paste into an AI, on the existing Sheet.
// MintPrompt shows once, on the first tap of the Mints glyph: closing it in any
// way (or copying) stores `cocoa.mintPrompted`, and later taps open the Mints
// panel directly. MintHelp sits behind the "?" on the Add mint card; it stores
// nothing and opens every time.
// MIT License

import { useState } from "react";
import Sheet from "./Sheet";
import { copyText } from "@/components/ui/CopyButton";

export const MINT_PROMPTED_KEY = "cocoa.mintPrompted";

const FIND_PROMPT = "Recommend 3 active Cashu mints that support Bitcoin (sat). Include the mint URL and a one-line note for each.";

const LEARN_PROMPT =
  "Explain what a Cashu mint is in simple words. What happens when I add a mint to my wallet? What are the trade-offs of using different mints? Then recommend 3 active Cashu mints that support Bitcoin (sat), with the mint URL and a one-line note for each.";

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

function PromptCard({
  title,
  prompt,
  closeLabel,
  onCopy,
  onClose,
  z,
}: {
  title: string;
  prompt: string;
  /** The second button's label until the prompt is copied; it reads Done after. */
  closeLabel: string;
  onCopy?: () => void;
  onClose: () => void;
  z?: number;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <Sheet title={title} onClose={onClose} z={z}>
      <div className="space-y-4" data-testid="ai-prompt">
        <p className="text-sm text-[#e8fff7]/70">Copy this and paste it into an AI.</p>
        <p className="select-all rounded-2xl border border-[#4ff4c6]/15 bg-[#07110d]/60 px-4 py-3 font-mono text-sm leading-relaxed text-[#e8fff7]">{prompt}</p>
        <button
          className="btn-neon"
          onClick={async () => {
            onCopy?.();
            setCopied((await copyText(prompt)) ? "ok" : "fail");
          }}
          data-testid="ai-prompt-copy"
        >
          {copied === "ok" ? "Copied ✓" : copied === "fail" ? "Copy blocked: select the text" : "Copy"}
        </button>
        <button className="btn-ghost w-full" onClick={onClose} data-testid="ai-prompt-done">
          {copied === "ok" ? "Done" : closeLabel}
        </button>
      </div>
    </Sheet>
  );
}

export default function MintPrompt({ onClose }: { onClose: () => void }) {
  const dismiss = () => {
    markPrompted();
    onClose();
  };
  return <PromptCard title="Want a different mint?" prompt={FIND_PROMPT} closeLabel="Skip" onCopy={markPrompted} onClose={dismiss} />;
}

/** Opens over the Mints panel, so it sits one layer up. */
export function MintHelp({ onClose }: { onClose: () => void }) {
  return <PromptCard title="Want to understand mints better?" prompt={LEARN_PROMPT} closeLabel="Done" onClose={onClose} z={60} />;
}
