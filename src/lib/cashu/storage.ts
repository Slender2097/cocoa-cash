// src/lib/cashu/storage.ts
// The browser-side proof store. Proofs never leave this browser; the server
// never sees them. Everything is kept in localStorage under the same keys the
// wallet has always used, so existing wallets keep working.
//
// All writes are read-modify-write against localStorage (never "save my
// in-memory copy"), so two hook instances cannot overwrite each other's
// proofs with a stale copy. localStorage is not transactional across tabs,
// so the wallet operations that call these helpers run under the cross-tab
// wallet lock (./lock.ts).
// MIT License

import type { Proof, ProofLike, SerializedDLEQ } from "@cashu/cashu-ts";

/** A proof as stored on disk: same as cashu-ts Proof, but `amount` is a plain number. */
export type StoredProof = {
  id: string;
  amount: number;
  secret: string;
  C: string;
  dleq?: SerializedDLEQ;
  witness?: Proof["witness"];
  p2pk_e?: string;
};

export type ProofsByMint = Record<string, StoredProof[]>;

const PROOFS_KEY = "proofsByMint";
export const PROOFS_EVENT = "cocoa:proofs";

// Older versions persisted bigints as "123n" strings.
const reviver = (_k: string, v: unknown) =>
  typeof v === "string" && /^\d+n$/.test(v) ? BigInt(v.slice(0, -1)) : v;

export function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw, reviver) as T) ?? fallback : fallback;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(
    key,
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v))
  );
}

/** cashu-ts v4 uses an `Amount` class; older data and other wallets use numbers. */
export function amountToNumber(a: unknown): number {
  if (a && typeof a === "object" && "toNumber" in a && typeof (a as { toNumber: unknown }).toNumber === "function") {
    return (a as { toNumber: () => number }).toNumber();
  }
  const n = Number(a);
  return Number.isFinite(n) ? n : 0;
}

/** The single conversion point from any cashu-ts proof shape to what we store. */
export function toStoredProof(p: Proof | ProofLike | StoredProof | null | undefined): StoredProof | null {
  if (!p || typeof p !== "object" || typeof p.secret !== "string" || !p.secret || typeof p.C !== "string") return null;
  const amount = amountToNumber(p.amount);
  if (!(amount > 0)) return null;
  const out: StoredProof = { id: String(p.id || ""), amount, secret: p.secret, C: p.C };
  if (p.dleq) out.dleq = p.dleq;
  if (p.witness) out.witness = p.witness;
  if ((p as StoredProof).p2pk_e) out.p2pk_e = (p as StoredProof).p2pk_e;
  return out;
}

export const sumProofs = (proofs: Array<{ amount: unknown }> = []): number =>
  proofs.reduce((s, p) => s + amountToNumber(p?.amount), 0);

/** Wallet storage key for a mint (the wallet has always used a trailing slash). */
export const normalizeMint = (url: string): string => {
  let u = String(url || "").trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u.replace(/\/+$/, "");
};
export const walletMintKey = (url: string): string => normalizeMint(url) + "/";

export function readProofs(): ProofsByMint {
  const raw = readJSON<Record<string, unknown[]>>(PROOFS_KEY, {});
  const out: ProofsByMint = {};
  for (const [mint, list] of Object.entries(raw || {})) {
    out[mint] = (Array.isArray(list) ? list : [])
      .map((p) => toStoredProof(p as StoredProof))
      .filter((p): p is StoredProof => !!p);
  }
  return out;
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PROOFS_EVENT));
}

/** Add proofs (deduplicated by secret). Returns the sats actually added. */
export function addProofs(mintUrl: string, proofs: Array<Proof | ProofLike | StoredProof>): number {
  const key = walletMintKey(mintUrl);
  const all = readProofs();
  const existing = all[key] || [];
  const seen = new Set(existing.map((p) => p.secret));
  const fresh = proofs
    .map(toStoredProof)
    .filter((p): p is StoredProof => !!p && !seen.has(p.secret));
  if (!fresh.length) return 0;
  all[key] = [...existing, ...fresh];
  writeJSON(PROOFS_KEY, all);
  notify();
  return sumProofs(fresh);
}

export function removeProofs(mintUrl: string, proofs: Array<{ secret: string }>): void {
  if (!proofs.length) return;
  const key = walletMintKey(mintUrl);
  const drop = new Set(proofs.map((p) => p.secret));
  const all = readProofs();
  if (!all[key]) return;
  all[key] = all[key].filter((p) => !drop.has(p.secret));
  writeJSON(PROOFS_KEY, all);
  notify();
}

export function removeMint(mintUrl: string): void {
  const all = readProofs();
  delete all[walletMintKey(mintUrl)];
  writeJSON(PROOFS_KEY, all);
  notify();
}

/** Subscribe to proof changes from this tab (custom event) and other tabs (storage event). */
export function onProofsChange(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === PROOFS_KEY || e.key === null) cb();
  };
  window.addEventListener(PROOFS_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PROOFS_EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

let persistAsked = false;

/**
 * Ask the browser not to evict this origin's storage under pressure or
 * inactivity: the proofs live only here. Once per page load; the browser may
 * grant, deny or prompt, and nothing depends on the answer.
 */
export function requestPersistentStorage(): void {
  if (persistAsked || typeof navigator === "undefined" || !navigator.storage?.persist) return;
  persistAsked = true;
  navigator.storage
    .persisted()
    .then((already) => (already ? true : navigator.storage.persist()))
    .catch(() => {});
}

/** Is this mint in the user's own mints list (`savedMints`)? */
export const isSavedMint = (mintUrl: string): boolean =>
  readJSON<string[]>("savedMints", []).map(normalizeMint).includes(normalizeMint(mintUrl));

export function rememberMint(mintUrl: string): void {
  // Show the mint in the full wallet's mint list (Navbar `savedMints`).
  const saved = readJSON<string[]>("savedMints", []);
  const url = normalizeMint(mintUrl);
  if (!saved.map(normalizeMint).includes(url)) writeJSON("savedMints", [...saved, url]);
}
