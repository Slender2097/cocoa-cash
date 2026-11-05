// src/components/wallet/SeedVault.tsx
// The local 12-word phrase: reveal as a numbered grid, copy, confirm three
// words, or replace it on a simple restore screen.
//
// Honest scope: this phrase is stored in this browser and does not restore
// ecash yet (no NUT-13 deterministic secrets). Sats are the proofs saved in
// this browser. The copy says so plainly.
// MIT License

import React, { useMemo, useState } from "react";
import * as bip39 from "bip39";
import Sheet from "./Sheet";
import { CopyButton, Check } from "./bits";

type View = "home" | "reveal" | "confirm" | "confirmed" | "restore" | "restored";

function pickThree(): number[] {
  const all = Array.from({ length: 12 }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 3).sort((a, b) => a - b);
}

function WordGrid({ words }: { words: string[] }) {
  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="seed-grid">
      {words.map((w, i) => (
        <li key={i} className="flex items-center gap-2 rounded-2xl border border-[#4ff4c6]/15 bg-[#07110d]/60 px-3 py-3">
          <span className="w-5 text-right text-xs tabular-nums text-[#4ff4c6]/70">{i + 1}</span>
          <span className="font-mono text-[15px] text-[#e8fff7]">{w}</span>
        </li>
      ))}
    </ol>
  );
}

export default function SeedVault({
  mnemonic,
  backedUp,
  onBackedUp,
  onRestore,
  onClose,
}: {
  mnemonic: string;
  backedUp: boolean;
  onBackedUp: () => void;
  onRestore: (phrase: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("home");
  const words = useMemo(() => mnemonic.trim().split(/\s+/).filter(Boolean), [mnemonic]);
  const [ask, setAsk] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [wrong, setWrong] = useState(false);
  const [restore, setRestore] = useState<string[]>(Array(12).fill(""));
  const [restoreErr, setRestoreErr] = useState("");

  const startConfirm = () => {
    setAsk(pickThree());
    setAnswers({});
    setWrong(false);
    setView("confirm");
  };
  const checkConfirm = () => {
    const ok = ask.every((i) => (answers[i] || "").trim().toLowerCase() === words[i]);
    if (!ok) return setWrong(true);
    onBackedUp();
    setView("confirmed");
  };

  const setWord = (i: number, v: string) => {
    const parts = v.trim().toLowerCase().split(/\s+/);
    // Pasting the whole phrase into any box fills all twelve.
    if (parts.length > 1) {
      const next = Array(12).fill("");
      parts.slice(0, 12).forEach((p, k) => (next[k] = p));
      setRestore(next);
    } else {
      setRestore((r) => r.map((x, k) => (k === i ? v.trim().toLowerCase() : x)));
    }
    setRestoreErr("");
  };
  const restorePhrase = restore.join(" ").trim();
  const restoreComplete = restore.every(Boolean);
  const doRestore = async () => {
    if (!bip39.validateMnemonic(restorePhrase)) {
      return setRestoreErr("These 12 words are not a valid phrase. Check spelling and order.");
    }
    if (await onRestore(restorePhrase)) setView("restored");
  };

  const title =
    view === "restore" || view === "restored" ? "Restore phrase" : view === "confirm" || view === "confirmed" ? "Confirm backup" : "Seed vault";

  return (
    <Sheet title={title} onClose={onClose}>
      {view === "home" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-[#07110d]/50 px-4 py-3">
            <span className={`h-2.5 w-2.5 rounded-full ${backedUp ? "bg-[#4ff4c6] shadow-[0_0_10px_#4ff4c6]" : "bg-amber-300"}`} />
            <span className="text-sm text-[#e8fff7]/80">{backedUp ? "Phrase backed up" : "Phrase not backed up yet"}</span>
          </div>
          <button className="btn-neon" onClick={() => setView("reveal")} data-testid="seed-show">
            Show my 12 words
          </button>
          <button className="btn-ghost w-full" onClick={() => setView("restore")}>
            Restore a phrase
          </button>
          <p className="text-xs leading-relaxed text-[#e8fff7]/45">
            Your sats are the ecash proofs saved in this browser. This phrase does not restore sats yet. To move sats to another
            device, use Send and Claim.
          </p>
        </div>
      )}

      {view === "reveal" && (
        <div className="space-y-4">
          <p className="text-sm text-[#e8fff7]/70">Write these down in order. Anyone with them can replace your phrase.</p>
          <WordGrid words={words} />
          <CopyButton text={mnemonic} label="Copy 12 words" />
          <button className="btn-neon" onClick={startConfirm}>
            I wrote them down
          </button>
        </div>
      )}

      {view === "confirm" && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            checkConfirm();
          }}
        >
          <p className="text-sm text-[#e8fff7]/70">Type these three words to confirm.</p>
          {ask.map((i) => (
            <label key={i} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-right text-sm text-[#4ff4c6]">Word {i + 1}</span>
              <input
                className="field font-mono"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={answers[i] || ""}
                onChange={(e) => {
                  setWrong(false);
                  setAnswers((a) => ({ ...a, [i]: e.target.value }));
                }}
              />
            </label>
          ))}
          {wrong && <p className="text-center text-sm text-amber-200">Not quite. Check your notes and try again.</p>}
          <button className="btn-neon">Confirm</button>
          <button type="button" className="btn-ghost w-full" onClick={() => setView("reveal")}>
            Show words again
          </button>
        </form>
      )}

      {view === "confirmed" && (
        <div className="space-y-5 py-4 text-center">
          <Check />
          <p className="text-2xl font-light glow-text">Backup confirmed</p>
          <button className="btn-neon" onClick={onClose}>
            Done
          </button>
        </div>
      )}

      {view === "restore" && (
        <div className="space-y-4">
          <p className="text-sm text-[#e8fff7]/70">Type your 12 words, or paste the whole phrase into box 1.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {restore.map((w, i) => (
              <label key={i} className="flex items-center gap-2 rounded-2xl border border-[#4ff4c6]/15 bg-[#07110d]/60 px-3 focus-within:border-[#4ff4c6]/70">
                <span className="w-5 text-right text-xs tabular-nums text-[#4ff4c6]/70">{i + 1}</span>
                <input
                  value={w}
                  onChange={(e) => setWord(i, e.target.value)}
                  aria-label={`Word ${i + 1}`}
                  className="w-full min-w-0 bg-transparent py-3 font-mono text-[15px] text-[#e8fff7] outline-none"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </label>
            ))}
          </div>
          {restoreErr && <p className="text-center text-sm text-amber-200">{restoreErr}</p>}
          <button className="btn-neon" disabled={!restoreComplete} onClick={doRestore}>
            Restore phrase
          </button>
          <p className="text-xs leading-relaxed text-[#e8fff7]/45">
            This replaces the phrase in this browser. It does not change your balance.
          </p>
        </div>
      )}

      {view === "restored" && (
        <div className="space-y-5 py-4 text-center">
          <Check />
          <p className="text-2xl font-light glow-text">Phrase restored</p>
          <p className="text-sm text-[#e8fff7]/60">Your balance is unchanged.</p>
          <button className="btn-neon" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Sheet>
  );
}
