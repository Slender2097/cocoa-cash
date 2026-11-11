// src/components/wallet/SeedVault.tsx
// The local 12-word phrase: reveal as a numbered grid, copy, confirm three
// words, or replace it on a simple restore screen. Plus "Back up balance":
// each mint's proofs as a standard Cashu token (NUT-00) to keep somewhere safe.
//
// Restore from phrase: new sats get NUT-13 secrets from this phrase, so the
// 12 words plus the list of mints bring them back (NUT-09 restore, NUT-07
// check). Sats from before NUT-13 have random secrets: the phrase cannot find
// them, and Back up balance is the way to keep a copy. The copy says so.
// MIT License

import { useMemo, useState } from "react";
import * as bip39 from "bip39";
import Sheet from "./Sheet";
import { CopyButton } from "@/components/ui/CopyButton";
import { Check } from "@/components/ui/Check";
import { backupTokens, backupText } from "@/lib/cashu/backup";
import { knownMints, phraseChangeAtRisk } from "@/lib/cashu/restore";
import type { MintRestore } from "@/lib/cashu/restore";
import type { ProofsByMint } from "@/lib/cashu/storage";
import { mintLabel } from "@/lib/utils/mintLabel";

type View = "home" | "reveal" | "confirm" | "confirmed" | "restore" | "replace" | "restoring" | "restored" | "backup";

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
  onRestore: (phrase: string, mints: string[], progress: (text: string) => void) => Promise<MintRestore[]>;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("home");
  const words = useMemo(() => mnemonic.trim().split(/\s+/).filter(Boolean), [mnemonic]);
  const [ask, setAsk] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [wrong, setWrong] = useState(false);
  const [restore, setRestore] = useState<string[]>(Array(12).fill(""));
  const [restoreErr, setRestoreErr] = useState("");
  const [mintsText, setMintsText] = useState("");
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<MintRestore[]>([]);
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
  const restoreMints = mintsText.split(/[\s,]+/).filter(Boolean);
  const openRestore = () => {
    setMintsText(knownMints().join("\n"));
    setView("restore");
  };
  const runRestore = async () => {
    setView("restoring");
    setProgress("Starting…");
    try {
      setResults(await onRestore(restorePhrase, restoreMints, setProgress));
      setView("restored");
    } catch (e) {
      setRestoreErr(e instanceof Error ? e.message : String(e));
      setView("restore");
    }
  };
  const doRestore = async () => {
    if (!bip39.validateMnemonic(restorePhrase)) {
      return setRestoreErr("These 12 words are not a valid phrase. Check spelling and order.");
    }
    if (!restoreMints.length) return setRestoreErr("Add at least one mint. The phrase does not say which mints hold your sats.");
    // A different phrase while this one still holds sats: ask first, keep the current one by default.
    if (phraseChangeAtRisk(restorePhrase)) return setView("replace");
    await runRestore();
  };
  const restoredSats = results.reduce((s, r) => s + r.amount, 0);

  const title =
    view === "backup"
      ? "Back up balance"
      : view === "restore" || view === "replace" || view === "restoring" || view === "restored"
        ? "Restore from phrase"
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
          <button className="btn-ghost w-full" onClick={openRestore} data-testid="seed-restore">
            Restore from phrase
          </button>
          <p className="text-xs leading-relaxed text-[#e8fff7]/45">
            Your sats are the ecash proofs saved in this browser. Sats you get from now on can be restored with these 12
            words and the list of your mints. Sats from before this update cannot: keep a copy of those with Back up balance.
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
          <label className="block space-y-2">
            <span className="text-sm text-[#e8fff7]/70">Mints to check, one per line</span>
            <textarea
              className="field min-h-24 font-mono text-sm"
              value={mintsText}
              onChange={(e) => {
                setMintsText(e.target.value);
                setRestoreErr("");
              }}
              placeholder="https://mint.example.com"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-testid="restore-mints"
            />
            <span className="block text-xs leading-relaxed text-[#e8fff7]/45">
              The phrase does not say which mints you used. These are the mints this browser knows about. On a new device,
              add the mints you used before.
            </span>
          </label>
          {restoreErr && <p className="text-center text-sm text-amber-200">{restoreErr}</p>}
          <button className="btn-neon" disabled={!restoreComplete} onClick={doRestore} data-testid="restore-run">
            Restore sats
          </button>
          <p className="text-xs leading-relaxed text-[#e8fff7]/45">
            Restored sats are added to your balance. Nothing already in this browser is removed.
          </p>
        </div>
      )}

      {view === "replace" && (
        <div className="space-y-4" data-testid="restore-replace">
          <p className="rounded-2xl border border-amber-300/30 bg-amber-300/5 px-4 py-3 text-sm leading-relaxed text-amber-100/90">
            This is a different phrase from the one in this browser. Your current sats stay here and stay spendable, but they
            will not be recoverable from the new phrase. Only your current phrase (or Back up balance) can bring them back.
          </p>
          <p className="text-xs leading-relaxed text-[#e8fff7]/55">
            Write down your current 12 words before you switch. New sats will then come from the new phrase.
          </p>
          <button className="btn-neon" onClick={() => setView("home")} data-testid="restore-keep">
            Keep my current phrase
          </button>
          <button className="btn-ghost w-full" onClick={runRestore} data-testid="restore-replace-confirm">
            Switch phrase and restore
          </button>
        </div>
      )}

      {view === "restoring" && (
        <div className="space-y-4 py-6 text-center" data-testid="restore-progress">
          <p className="text-sm text-[#e8fff7]/80">{progress}</p>
          <p className="text-xs text-[#e8fff7]/45">Keep this page open.</p>
        </div>
      )}

      {view === "restored" && (
        <div className="space-y-5 py-4 text-center" data-testid="restore-done">
          <Check />
          <p className="text-2xl font-light glow-text">
            {restoredSats > 0 ? `${restoredSats.toLocaleString("en-US")} sat restored` : "Phrase restored"}
          </p>
          <ul className="space-y-2 text-left">
            {results.map((r) => (
              <li key={r.mint} className="rounded-2xl border border-white/5 bg-[#07110d]/50 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-[#e8fff7]">{mintLabel(r.mint)}</span>
                  <span className="shrink-0 tabular-nums text-[#4ff4c6]">+{r.amount.toLocaleString("en-US")} sat</span>
                </div>
                {r.error && <p className="mt-1 text-xs text-amber-200">{r.error}. Try again later; nothing was lost.</p>}
              </li>
            ))}
          </ul>
          <button className="btn-neon" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Sheet>
  );
}
