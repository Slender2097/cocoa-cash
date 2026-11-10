// src/lib/cashu/seed.ts
// The wallet's 12-word phrase, its NUT-13 seed, and the per-keyset counters
// that make deterministic secrets safe to use.
//
// NUT-13: every new output's secret and blinding factor are derived from
// (seed, keysetId, counter). The same phrase on a fresh browser can then ask
// each mint (NUT-09 restore) for the signatures on those outputs again.
// Proofs made before this existed have random secrets. They still spend
// exactly as before; the phrase simply cannot recover them.
//
// Counter discipline:
//   * One counter per (phrase, mint, keysetId), in localStorage, so a reload
//     keeps it.
//   * reserve() writes the new "next" synchronously before it returns. Outputs
//     are built from the reserved range only after that, so the counter is on
//     disk before any request that carries those outputs leaves the browser.
//   * A counter only moves up. Nothing ever sets it lower, so no counter is
//     used twice (a retry burns fresh counters; gaps are harmless).
//   * Counters are keyed by phrase, so switching phrases neither reuses the
//     old phrase's counters nor starts the new phrase far past its own outputs
//     (which would hide them from a later restore).
// MIT License

import * as bip39 from "bip39";
import type { CounterRange, CounterSource } from "@cashu/cashu-ts";
import { normalizeMint, readJSON, writeJSON } from "./storage";

const MNEMONIC_KEY = "mnemonic";
const PREVIOUS_KEY = "mnemonic.previous";
const COUNTERS_KEY = "cocoa.counters";
const USED_MINTS_KEY = "cocoa.usedMints";

/** The phrase in this browser. Created (and saved) on first use, so it exists before any Wallet does. */
export function getMnemonic(): string {
  if (typeof window === "undefined") return "";
  let words = localStorage.getItem(MNEMONIC_KEY);
  if (!words) {
    words = bip39.generateMnemonic(128);
    localStorage.setItem(MNEMONIC_KEY, words);
  }
  return words;
}

/** Replace the phrase. The old one is kept in `mnemonic.previous`, never discarded. */
export function replaceMnemonic(words: string): void {
  const prev = localStorage.getItem(MNEMONIC_KEY);
  if (prev && prev !== words) {
    const list = readJSON<string[]>(PREVIOUS_KEY, []);
    if (!list.includes(prev)) writeJSON(PREVIOUS_KEY, [...list, prev]);
  }
  localStorage.setItem(MNEMONIC_KEY, words);
}

export const normalizePhrase = (words: string) => words.trim().toLowerCase().split(/\s+/).join(" ");

let cached: { words: string; seed: Uint8Array; fp: string } | null = null;

/** The 64-byte BIP39 seed of the current phrase, plus a short id for keying storage. */
export function currentSeed(): { seed: Uint8Array; fp: string } {
  const words = getMnemonic();
  if (cached?.words !== words) {
    const seed = new Uint8Array(bip39.mnemonicToSeedSync(words));
    // A storage key only. The phrase itself sits in plain text next to it, so
    // these bytes reveal nothing that is not already there.
    const fp = Array.from(seed.slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
    cached = { words, seed, fp };
  }
  return { seed: cached.seed, fp: cached.fp };
}

// ---------------------------------------------------------------------------
// Counters: { [phrase fp]: { [mint]: { [keysetId]: next } } }
// ---------------------------------------------------------------------------

type Counters = Record<string, Record<string, Record<string, number>>>;

function readNext(fp: string, mint: string, keysetId: string): number {
  const n = readJSON<Counters>(COUNTERS_KEY, {})[fp]?.[mint]?.[keysetId];
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Raise the stored counter to `next` (never lowers it). Returns the stored value. */
function raiseNext(fp: string, mint: string, keysetId: string, next: number): number {
  const all = readJSON<Counters>(COUNTERS_KEY, {});
  const forMint = ((all[fp] ||= {})[mint] ||= {});
  const cur = Number.isInteger(forMint[keysetId]) ? forMint[keysetId] : 0;
  if (next > cur) {
    forMint[keysetId] = next;
    writeJSON(COUNTERS_KEY, all);
    return next;
  }
  return cur;
}

/**
 * A localStorage-backed CounterSource for one mint under one phrase. Every
 * method is synchronous underneath (wrapped in a promise for cashu-ts), so a
 * reservation is on disk before cashu-ts builds the outputs. Wallet operations
 * run under the cross-tab wallet lock (./lock.ts), so tabs never race on it.
 */
export function counterSource(mintUrl: string, fp: string): CounterSource {
  const mint = normalizeMint(mintUrl);
  return {
    async reserve(keysetId: string, n: number): Promise<CounterRange> {
      const start = readNext(fp, mint, keysetId);
      if (n <= 0) return { start, count: 0 };
      rememberUsedMint(mint);
      raiseNext(fp, mint, keysetId, start + n);
      return { start, count: n };
    },
    async reserveAt(keysetId: string, start: number, count: number): Promise<CounterRange> {
      const cur = readNext(fp, mint, keysetId);
      if (start < cur) throw new Error(`Counter ${start} for keyset ${keysetId} was already used (next is ${cur})`);
      if (count > 0) rememberUsedMint(mint);
      raiseNext(fp, mint, keysetId, start + count);
      return { start, count };
    },
    async advanceToAtLeast(keysetId: string, minNext: number): Promise<void> {
      raiseNext(fp, mint, keysetId, minNext);
    },
    async snapshot(): Promise<Record<string, number>> {
      return { ...(readJSON<Counters>(COUNTERS_KEY, {})[fp]?.[mint] || {}) };
    },
    // "Hard set" in cashu-ts terms, but only upward here: a counter is never reused.
    async setNext(keysetId: string, next: number): Promise<void> {
      raiseNext(fp, mint, keysetId, next);
    },
  };
}

// ---------------------------------------------------------------------------
// Mints this wallet has made deterministic outputs at. Recorded when counters
// are reserved, i.e. before the request goes out, so a mint whose reply was
// lost is still on the list. The phrase alone does not name any mint.
// ---------------------------------------------------------------------------

export function rememberUsedMint(mintUrl: string): void {
  const url = normalizeMint(mintUrl);
  if (!url) return;
  const list = readJSON<string[]>(USED_MINTS_KEY, []);
  if (!list.includes(url)) writeJSON(USED_MINTS_KEY, [...list, url]);
}

export const usedMints = (): string[] => readJSON<string[]>(USED_MINTS_KEY, []).map(normalizeMint).filter(Boolean);
