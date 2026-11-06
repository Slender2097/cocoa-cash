// src/components/wallet/SeedVault.tsx
// The local 12-word phrase: reveal as a numbered grid, copy, confirm three
// words, or replace it on a simple restore screen. Plus "Back up balance":
// each mint's proofs as a standard Cashu token (NUT-00) to keep somewhere safe.
//
// Honest scope: this phrase is stored in this browser and does not restore
// ecash yet (no NUT-13 deterministic secrets). Sats are the proofs saved in
// this browser. The copy says so plainly.
// MIT License

import { useMemo, useState } from "react";
import * as bip39 from "bip39";
import Sheet from "./Sheet";
import { CopyButton } from "@/components/ui/CopyButton";
import { Check } from "@/components/ui/Check";
import { backupTokens, backupText } from "@/lib/cashu/backup";
import type { ProofsByMint } from "@/lib/cashu/storage";
import { mintLabel } from "@/lib/utils/mintLabel";

type View = "home" | "reveal" | "confirm" | "confirmed" | "restore" | "restored" | "backup";

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
  proofsByMint,
  onBackedUp,
  onRestore,
  onClose,
}: {
  mnemonic: string;
  backedUp: boolean;
  proofsByMint: ProofsByMint;
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
  const tokens = useMemo(() => (view === "backup" ? backupTokens(proofsByMint) : []), [view, proofsByMint]);

  const downloadBackup = () => {
    const blob = new Blob([backupText(tokens)], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cocoa-balance-backup-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

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
    view === "backup"
      ? "Back up balance"
      : view === "restore" || view === "restored"
        ? "Restore phrase"
        : view === "confirm" || view === "confirmed"
          ? "Confirm backup"
          : "Seed vault";

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
          <button className="btn-ghost w-full" onClick={() => setView("backup")} data-testid="backup-balance">
            Back up balance
          </button>
          <button className="btn-ghost w-full" onClick={() => setView("restore")}>
            Restore a phrase
          </button>
          <p className="text-xs leading-relaxed text-[#e8fff7]/45">
            Your sats are the ecash proofs saved in this browser. This phrase does not restore sats yet. To keep a copy of your
            sats, use Back up balance. To move sats to another device, use Send and Claim.
          </p>
        </div>
      )}

      {view === "backup" && (
        <div className="space-y-4" data-testid="backup-view">
          <p className="text-sm text-[#e8fff7]/70">
            Each mint&apos;s sats as one Cashu token. To restore, paste a token into Claim, here or in any Cashu wallet.
          </p>
          <p className="rounded-2xl border border-amber-300/30 bg-amber-300/5 px-4 py-3 text-xs leading-relaxed text-amber-100/90">
            Anyone with these tokens can spend the sats, so keep them like cash. A backup is a snapshot: make a new one after you
            spend or receive.
          </p>
          {tokens.length === 0 && <p className="py-4 text-center text-sm text-[#e8fff7]/50">No sats to back up yet.</p>}
          {tokens.map((t) => (
            <div key={t.mint} className="space-y-3 rounded-2xl border border-[#4ff4c6]/15 bg-[#07110d]/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm text-[#e8fff7]">{mintLabel(t.mint)}</span>
                <span className="shrink-0 tabular-nums text-[#4ff4c6]">{t.amount.toLocaleString("en-US")} sat</span>
              </div>
              {t.token ? (
                <>
                  <p className="readout max-h-20 overflow-y-auto text-left">{t.token}</p>
                  <CopyButton text={t.token} label="Copy token" />
                </>
              ) : (
                <p className="text-xs text-amber-200">
                  Could not put these sats in a token ({t.error}). Send them to yourself once, then back up again.
                </p>
              )}
            </div>
          ))}
          {tokens.some((t) => t.token) && (
            <button className="btn-neon" onClick={downloadBackup}>
              Download backup
            </button>
          )}
          <p className="text-xs leading-relaxed text-[#e8fff7]/45">
            Sats held by an unfinished payment or send are not in this backup.
          </p>
          <button className="btn-ghost w-full" onClick={() => setView("home")}>
            Back
          </button>
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
