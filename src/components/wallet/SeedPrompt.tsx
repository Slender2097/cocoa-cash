// src/components/wallet/SeedPrompt.tsx
// One-time card after the first receive: the 12 words, plus a way to the
// existing "Back up balance" view for sats from before NUT-13. Closing it in
// any way stores `cocoa.seedPrompted`, and it never shows again.
// MIT License

import { useMemo } from "react";
import Sheet from "./Sheet";
import { WordGrid } from "./SeedVault";

export const SEED_PROMPTED_KEY = "cocoa.seedPrompted";

export function seedPrompted(): boolean {
  try {
    return localStorage.getItem(SEED_PROMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

function markPrompted() {
  try {
    localStorage.setItem(SEED_PROMPTED_KEY, "1");
  } catch {
    // still close
  }
}

export default function SeedPrompt({ mnemonic, onBackup, onClose }: { mnemonic: string; onBackup: () => void; onClose: () => void }) {
  const words = useMemo(() => mnemonic.trim().split(/\s+/).filter(Boolean), [mnemonic]);
  const dismiss = () => {
    markPrompted();
    onClose();
  };
  return (
    <Sheet title="Your 12 words" onClose={dismiss}>
      <div className="space-y-4" data-testid="seed-prompt">
        <p className="text-sm text-[#e8fff7]/70">These 12 words are the key to your wallet. Write them down and keep them safe.</p>
        <WordGrid words={words} />
        <button className="btn-neon" onClick={dismiss}>
          Done
        </button>
        <button
          className="btn-ghost w-full"
          onClick={() => {
            markPrompted();
            onBackup();
          }}
          data-testid="seed-prompt-backup"
        >
          Back up older sats
        </button>
      </div>
    </Sheet>
  );
}
