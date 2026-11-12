// src/components/wallet/MintsPanel.tsx
// The user's own mints (localStorage `savedMints`) as large cards. The active
// one is marked; a tap on any other switches to it. The wallet never suggests
// a mint: the only way to add one is to paste or type its URL. Reorder and
// remove sit in a collapsed "Manage" section. A "?" on the Add mint card opens
// a prompt to paste into an AI; closing it returns to the card as it was.
// MIT License

import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import { MintHelp } from "./MintPrompt";
import { mintLabel } from "@/lib/utils/mintLabel";
import { readJSON, writeJSON, normalizeMint, walletMintKey, sumProofs } from "@/lib/cashu/storage";
import type { ProofsByMint } from "@/lib/cashu/storage";

// One letter for the card's badge, from the host without the usual prefixes.
const initial = (url: string) =>
  (mintLabel(url).replace(/^(www|mint|cashu|ecash)\./i, "").charAt(0) || "?").toUpperCase();

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
  const [mints, setMints] = useState<string[] | null>(null); // null until read from storage
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [managing, setManaging] = useState(false);
  const [help, setHelp] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage once on open
    setMints(readJSON<string[]>("savedMints", []));
  }, []);

  useEffect(() => {
    if (adding) input.current?.focus();
  }, [adding]);

  const saved = mints || [];
  const isActive = (m: string) => !!activeMint && normalizeMint(m) === normalizeMint(activeMint);
  const bal = (m: string) => sumProofs(proofsByMint[walletMintKey(m)] || []);

  // The user's list, plus the active mint if it is missing from it (it was still their choice).
  const cards = [...saved];
  if (activeMint && !saved.some(isActive)) cards.unshift(activeMint);

  // With no mints yet, adding one is the only thing to do: show the field right away.
  const empty = mints !== null && cards.length === 0;
  const formOpen = adding || empty;

  const save = (next: string[]) => {
    writeJSON("savedMints", next);
    setMints(next);
  };

  const pick = (m: string) => {
    if (isActive(m)) return onClose();
    const u = normalizeMint(m);
    if (!saved.map(normalizeMint).includes(u)) save([...saved, u]);
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
    if (j < 0 || j >= saved.length) return;
    const next = [...saved];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  const closeHelp = () => setHelp(false);

  // Both sheets hear Escape; while the help card is up it only closes that card.
  const sheet = (
    <Sheet title="Mints" onClose={help ? closeHelp : onClose} keyboard={formOpen}>
      {note && <p className="mb-4 rounded-2xl border border-[#4ff4c6]/30 bg-[#4ff4c6]/5 px-4 py-3 text-sm text-[#a3ffe0]">{note}</p>}

      {cards.length > 0 && (
        <>
          <p className="mb-3 text-sm text-[#e8fff7]/55">Tap a mint to use it.</p>
          <ul className="space-y-2.5" role="list">
            {cards.map((m) => {
              const active = isActive(m);
              return (
                <li key={m}>
                  <button
                    onClick={() => pick(m)}
                    aria-current={active ? "true" : undefined}
                    className={`flex min-h-[4.5rem] w-full items-center gap-3 rounded-3xl border px-4 py-4 text-left transition active:scale-[0.98] sm:gap-4 sm:px-5 ${
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
                      {initial(m)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-medium text-[#e8fff7]">{mintLabel(m)}</span>
                      <span className="block text-[13px] tabular-nums text-[#e8fff7]/50">{bal(m).toLocaleString("en-US")} sat</span>
                    </span>
                    {active && (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#4ff4c6]/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#a3ffe0]">
                        <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-[#4ff4c6] shadow-[0_0_8px_#4ff4c6]" : "bg-[#a3ffe0]/50"}`} />
                        Active
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {empty && (
        <p className="mb-4 text-sm leading-relaxed text-[#e8fff7]/65">
          No mints yet. Paste the URL of any Cashu mint you want to use. A mint holds the sats behind its ecash, so pick one you trust.
        </p>
      )}

      {formOpen ? (
        <form
          className={`space-y-3 rounded-3xl border border-white/10 bg-[#07110d]/30 p-4 ${empty ? "" : "mt-5"}`}
          onSubmit={(e) => {
            e.preventDefault();
            add(url);
          }}
        >
          <div className="flex items-center justify-between">
            <label htmlFor="mint-url" className="block text-sm text-[#e8fff7]/70">
              Mint URL
            </label>
            {/* a 44px target around a small circle; the negative margins keep the row as tall as the label */}
            <button
              type="button"
              onClick={() => {
                // let a phone keyboard close, so the card does not open under it
                (document.activeElement as HTMLElement | null)?.blur();
                setHelp(true);
              }}
              aria-label="About mints"
              title="About mints"
              className="group -my-3 -mr-2 grid h-11 w-11 shrink-0 place-items-center"
              data-testid="mint-help"
            >
              <span
                aria-hidden
                className="grid h-7 w-7 place-items-center rounded-full border border-[#4ff4c6]/15 bg-[#07110d]/40 text-sm font-semibold text-[#4ff4c6]/80 transition group-hover:border-[#4ff4c6]/60 group-hover:text-[#a3ffe0] group-hover:shadow-[0_0_24px_-6px_#4ff4c6] group-active:scale-95"
              >
                ?
              </span>
            </button>
          </div>
          <input
            id="mint-url"
            ref={input}
            className="field"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
          <div className="flex gap-2">
            {!empty && (
              <button
                type="button"
                className="btn-ghost shrink-0 whitespace-nowrap !px-4"
                onClick={() => {
                  setAdding(false);
                  setUrl("");
                }}
              >
                Cancel
              </button>
            )}
            <button className="btn-neon min-w-0 !flex-1 whitespace-nowrap !px-4 !py-3 !text-base" disabled={!url.trim()}>
              Add mint
            </button>
          </div>
        </form>
      ) : (
        mints !== null && (
          <button type="button" onClick={() => setAdding(true)} className="btn-ghost mt-5 w-full">
            + Add a mint
          </button>
        )
      )}

      {saved.length > 0 && (
        <div className="mt-5 border-t border-white/5 pt-4">
          <button
            type="button"
            onClick={() => setManaging((v) => !v)}
            aria-expanded={managing}
            className="flex min-h-11 w-full items-center justify-between text-sm text-[#e8fff7]/55 hover:text-[#e8fff7]/80"
          >
            Manage
            <span aria-hidden className={`transition ${managing ? "rotate-180" : ""}`}>⌄</span>
          </button>
          {managing && (
            <div className="mt-2 space-y-1.5">
              {saved.map((m, i) => (
                <div key={m} className="flex items-center gap-1 rounded-2xl bg-[#07110d]/35 py-1 pl-4 pr-1">
                  <span className="min-w-0 flex-1 truncate text-sm text-[#e8fff7]/80">{mintLabel(m)}</span>
                  <button aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="grid h-10 w-10 place-items-center rounded-full text-[#4ff4c6] hover:bg-white/5 disabled:opacity-20">↑</button>
                  <button aria-label="Move down" onClick={() => move(i, 1)} disabled={i === saved.length - 1} className="grid h-10 w-10 place-items-center rounded-full text-[#4ff4c6] hover:bg-white/5 disabled:opacity-20">↓</button>
                  <button aria-label="Remove from list" onClick={() => save(saved.filter((x) => x !== m))} className="grid h-10 w-10 place-items-center rounded-full text-red-300/80 hover:bg-white/5">✕</button>
                </div>
              ))}
              <p className="px-1 pt-1 text-xs text-[#e8fff7]/40">Removing a mint from this list keeps its sats.</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );

  // The help card is a second sheet beside this one, not inside it: inside the
  // panel it would be clipped to it.
  return (
    <>
      {sheet}
      {help && <MintHelp onClose={closeHelp} />}
    </>
  );
}
