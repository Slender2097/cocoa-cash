// src/components/wallet/MintsPanel.tsx
// Pick a mint: one large card per mint (saved first, then the built-in known
// list). The active one is marked; a tap on any other switches to it.
// Adding a custom URL and managing the saved list (localStorage
// `savedMints`: reorder, remove) sit below, out of the way.
// MIT License

import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import { mintLabel } from "@/lib/utils/mintLabel";
import { readJSON, writeJSON, normalizeMint, walletMintKey, sumProofs } from "@/lib/cashu/storage";
import type { ProofsByMint } from "@/lib/cashu/storage";
import { KNOWN_MINTS } from "@/lib/tip/config";

// Friendly names for the built-in mints. Anything else gets a name from its host.
const NAMES: Record<string, string> = {
  "https://mint.minibits.cash/Bitcoin": "Minibits",
  "https://mint.coinos.io": "Coinos",
  "https://mint.lnvoltz.com": "LNVoltz",
  "https://mint.cubabitcoin.org": "Cuba Bitcoin",
};
const named = Object.fromEntries(Object.entries(NAMES).map(([u, n]) => [normalizeMint(u), n]));

function mintName(url: string) {
  const known = named[normalizeMint(url)];
  if (known) return known;
  let host = mintLabel(url).split("/")[0];
  host = host.replace(/^(www|mint|cashu|ecash)\./i, "");
  const word = host.split(".")[0] || host;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

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
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage once on open
    setMints(readJSON<string[]>("savedMints", []));
  }, []);

  useEffect(() => {
    if (adding) input.current?.focus();
  }, [adding]);

  const save = (next: string[]) => {
    writeJSON("savedMints", next);
    setMints(next);
  };
  const isActive = (m: string) => !!activeMint && normalizeMint(m) === normalizeMint(activeMint);
  const bal = (m: string) => sumProofs(proofsByMint[walletMintKey(m)] || []);
  const saved = mints.map(normalizeMint);

  // Every mint the user can pick: their own list, the known ones, and the active one if it is in neither.
  const cards: string[] = [];
  for (const m of [...mints, ...KNOWN_MINTS, ...(activeMint ? [activeMint] : [])]) {
    if (!cards.map(normalizeMint).includes(normalizeMint(m))) cards.push(m);
  }

  const pick = (m: string) => {
    if (isActive(m)) return onClose();
    const u = normalizeMint(m);
    if (!saved.includes(u)) save([...mints, u]);
    onConnect(u);
  };

  const add = (raw: string) => {
    const u = normalizeMint(raw.trim());
    if (!u) return;
    setUrl("");
    pick(u);
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= mints.length) return;
    const next = [...mints];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  return (
    <Sheet title="Mints" onClose={onClose} keyboard={adding}>
      {note && <p className="mb-4 rounded-2xl border border-[#4ff4c6]/30 bg-[#4ff4c6]/5 px-4 py-3 text-sm text-[#a3ffe0]">{note}</p>}

      <p className="mb-3 text-sm text-[#e8fff7]/55">Tap a mint to use it.</p>

      <ul className="space-y-2.5" role="list">
        {cards.map((m) => {
          const active = isActive(m);
          const sats = bal(m);
          return (
            <li key={m}>
              <button
                onClick={() => pick(m)}
                aria-current={active ? "true" : undefined}
                className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-3xl border px-4 py-4 sm:gap-4 sm:px-5 text-left transition active:scale-[0.98] ${
                  active
                    ? "border-[#4ff4c6]/80 bg-[#4ff4c6]/10 shadow-[0_0_34px_-12px_#4ff4c6]"
                    : "border-white/10 bg-[#07110d]/45 hover:border-[#4ff4c6]/45 hover:bg-[#07110d]/60"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-semibold ${
                    active ? "bg-[#4ff4c6] text-[#06120e]" : "bg-white/5 text-[#a3ffe0]/80"
                  }`}
                >
                  {mintName(m).charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-medium text-[#e8fff7]">{mintName(m)}</span>
                  <span className="block truncate text-[13px] text-[#e8fff7]/45">{mintLabel(m)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {active ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-[#4ff4c6]/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#a3ffe0]">
                      <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#4ff4c6] shadow-[0_0_8px_#4ff4c6]" : "bg-[#a3ffe0]/50"}`} />
                      Active
                    </span>
                  ) : null}
                  {sats > 0 && <span className="text-xs tabular-nums text-[#e8fff7]/60">{sats.toLocaleString("en-US")} sat</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {adding ? (
        <form
          className="mt-5 space-y-3 rounded-3xl border border-white/10 bg-[#07110d]/30 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            add(url);
          }}
        >
          <label htmlFor="mint-url" className="block text-sm text-[#e8fff7]/70">
            Mint URL
          </label>
          <input
            id="mint-url"
            ref={input}
            className="field"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://mint.example.com"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <button type="button" className="btn-ghost shrink-0 whitespace-nowrap !px-4" onClick={() => {
                setAdding(false);
                setUrl("");
              }}>
              Cancel
            </button>
            <button className="btn-neon min-w-0 !flex-1 whitespace-nowrap !px-4 !py-3 !text-base" disabled={!url.trim()}>
              Add mint
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="btn-ghost mt-5 w-full">
          + Add custom mint
        </button>
      )}

      {mints.length > 0 && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            aria-expanded={managing}
            className="flex min-h-11 w-full items-center justify-between text-sm text-[#e8fff7]/55 hover:text-[#e8fff7]/80"
          >
            Manage saved mints
            <span aria-hidden className={`transition ${managing ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {managing && (
            <div className="mt-2 space-y-1.5">
              {mints.map((m, i) => (
                <div key={m} className="flex items-center gap-1 rounded-2xl bg-[#07110d]/35 py-1 pl-4 pr-1">
                  <span className="min-w-0 flex-1 truncate text-sm text-[#e8fff7]/80">{mintLabel(m)}</span>
                  <button aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-10 w-10 place-items-center rounded-full text-[#4ff4c6] hover:bg-white/5 disabled:opacity-20">↑</button>
                  <button aria-label="Move down" onClick={() => move(i, 1)} disabled={i === mints.length - 1} className="grid h-10 w-10 place-items-center rounded-full text-[#4ff4c6] hover:bg-white/5 disabled:opacity-20">↓</button>
                  <button aria-label="Remove from list" onClick={() => save(mints.filter((x) => x !== m))} className="grid h-10 w-10 place-items-center rounded-full text-red-300/80 hover:bg-white/5">✕</button>
                </div>
              ))}
              <p className="px-1 pt-1 text-xs text-[#e8fff7]/40">Removing a mint from this list keeps its sats.</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
