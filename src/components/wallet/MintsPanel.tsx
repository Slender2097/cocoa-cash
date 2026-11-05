// src/components/wallet/MintsPanel.tsx
// Saved mints (localStorage `savedMints`): connect, reorder, remove, add.
// MIT License

import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { mintLabel } from "@/lib/utils/mintLabel";
import { readJSON, writeJSON, normalizeMint, walletMintKey, sumProofs } from "@/lib/cashu/storage";
import type { ProofsByMint } from "@/lib/cashu/storage";
import { KNOWN_MINTS } from "@/lib/tip/config";

export default function MintsPanel({
  activeMint,
  connected,
  proofsByMint,
  note,
  onConnect,
  onClose,
}: {
  activeMint: string;
  connected: boolean;
  proofsByMint: ProofsByMint;
  note?: string;
  onConnect: (url: string) => void;
  onClose: () => void;
}) {
  const [mints, setMints] = useState<string[]>([]);
  const [url, setUrl] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage once on open
    setMints(readJSON<string[]>("savedMints", []));
  }, []);

  const save = (next: string[]) => {
    writeJSON("savedMints", next);
    setMints(next);
  };
  const isActive = (m: string) => !!activeMint && normalizeMint(m) === normalizeMint(activeMint);
  const bal = (m: string) => sumProofs(proofsByMint[walletMintKey(m)] || []);

  const add = (input: string) => {
    const u = normalizeMint(input.trim());
    if (!u) return;
    if (!mints.map(normalizeMint).includes(u)) save([...mints, u]);
    setUrl("");
    onConnect(u);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= mints.length) return;
    const next = [...mints];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  const suggestions = KNOWN_MINTS.filter((k) => !mints.map(normalizeMint).includes(normalizeMint(k)));

  return (
    <Sheet title="Mints" onClose={onClose}>
      {note && <p className="mb-4 rounded-2xl border border-[#4ff4c6]/30 bg-[#4ff4c6]/5 px-4 py-3 text-sm text-[#a3ffe0]">{note}</p>}

      <div className="space-y-2">
        {mints.length === 0 && <p className="py-2 text-sm text-[#e8fff7]/50">No mints yet. Add one below.</p>}
        {mints.map((m, i) => (
          <div
            key={m}
            className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition ${
              isActive(m) ? "border-[#4ff4c6]/70 bg-[#4ff4c6]/10 shadow-[0_0_30px_-12px_#4ff4c6]" : "border-white/5 bg-[#07110d]/40"
            }`}
          >
            <button onClick={() => onConnect(m)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isActive(m) && connected ? "bg-[#4ff4c6] shadow-[0_0_10px_#4ff4c6]" : isActive(m) ? "bg-[#a3ffe0]/50" : "bg-white/15"
                }`}
              />
              <span className="min-w-0">
                <span className="block truncate text-[15px] text-[#e8fff7]">{mintLabel(m)}</span>
                <span className="block text-xs text-[#e8fff7]/45">{bal(m).toLocaleString("en-US")} sat</span>
              </span>
            </button>
            <button aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-9 w-9 place-items-center rounded-full text-[#4ff4c6] hover:bg-white/5 disabled:opacity-20">↑</button>
            <button aria-label="Move down" onClick={() => move(i, 1)} disabled={i === mints.length - 1} className="grid h-9 w-9 place-items-center rounded-full text-[#4ff4c6] hover:bg-white/5 disabled:opacity-20">↓</button>
            <button aria-label="Remove from list" onClick={() => save(mints.filter((x) => x !== m))} className="grid h-9 w-9 place-items-center rounded-full text-red-300/80 hover:bg-white/5">✕</button>
          </div>
        ))}
      </div>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add(url);
        }}
      >
        <input className="field min-w-0 flex-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mint.example.com" inputMode="url" autoCapitalize="off" />
        <button className="btn-neon !w-auto !px-6 !text-base" disabled={!url.trim()}>
          Add
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} onClick={() => add(s)} className="rounded-full border border-[#4ff4c6]/20 px-3 py-2 text-xs text-[#e8fff7]/70 hover:border-[#4ff4c6]/60">
              + {mintLabel(s)}
            </button>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-[#e8fff7]/40">Removing a mint from this list keeps its sats.</p>
    </Sheet>
  );
}
