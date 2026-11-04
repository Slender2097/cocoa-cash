// src/lib/tip/records.js
// Small persistent record stores in localStorage, plus (de)serialisation of
// cashu-ts blinding data so it can be written BEFORE a mint call and used
// later for NUT-09 restore if the mint's reply is lost.
// MIT License

import { OutputData } from "@cashu/cashu-ts";
import { replacer, reviver, cleanProof } from "@/lib/cashu";

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw, reviver) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value, replacer));

// --- keyed record store ---------------------------------------------------
// Always re-reads localStorage before writing so two tabs (or a re-render)
// never overwrite each other with stale copies.
//
// `once` fields are write-once: if a record already has a value for one of
// them, a later patch cannot replace it (e.g. the original payload of a tip,
// or blinding data that was already sent to a mint).
const ONCE_FIELDS = ["payload", "outputs", "wrap", "createdAt", "quote", "invoice"];

export function listRecords(storeKey) {
  return Object.values(read(storeKey, {})).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function getRecord(storeKey, id) {
  return read(storeKey, {})[id] || null;
}

export function putRecord(storeKey, id, patch) {
  const all = read(storeKey, {});
  const prev = all[id] || {};
  const next = { ...prev, ...patch, id };
  for (const f of ONCE_FIELDS) {
    if (prev[f] !== undefined && prev[f] !== null) next[f] = prev[f];
  }
  next.updatedAt = Date.now();
  all[id] = next;
  write(storeKey, all);
  return next;
}

// --- blinding data ----------------------------------------------------------
const toHex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

export const serializeOutputs = (outputData = []) =>
  outputData.map((o) => ({
    B: o.blindedMessage,
    r: o.blindingFactor.toString(16),
    s: toHex(o.secret),
  }));

export const deserializeOutputs = (list = []) =>
  list.map((o) => new OutputData(o.B, BigInt("0x" + o.r), fromHex(o.s)));

/**
 * NUT-09 restore: ask the mint for the signatures it already issued for our
 * blinded messages, and unblind them locally. Used only when a NUT-04 mint or
 * NUT-03 swap reply was lost. Returns [] if the mint never signed them.
 */
export async function restoreFromOutputs(wallet, outputData) {
  if (!outputData?.length) return [];
  const res = await wallet.mint.restore({ outputs: outputData.map((o) => o.blindedMessage) });
  const sigs = res.signatures || res.promises || [];
  const proofs = [];
  (res.outputs || []).forEach((out, i) => {
    const od = outputData.find((d) => d.blindedMessage.B_ === out.B_);
    const sig = sigs[i];
    if (!od || !sig) return;
    proofs.push(od.toProof(sig, wallet.getKeyset(sig.id)));
  });
  return proofs;
}

// --- the full wallet's proof store -------------------------------------------
// Same localStorage key and shape as useProofStorage. Merge by secret so this
// can never drop proofs that are already there. Open wallet tabs pick the
// change up through the `storage` event (see useProofStorage).
export function addProofsToWallet(mintKey, proofs) {
  const all = read("proofsByMint", {});
  const existing = all[mintKey] || [];
  const seen = new Set(existing.map((p) => p.secret));
  const fresh = proofs.map(cleanProof).filter((p) => p && !seen.has(p.secret));
  if (!fresh.length) return 0;
  all[mintKey] = [...existing, ...fresh];
  write("proofsByMint", all);
  return fresh.reduce((s, p) => s + p.amount, 0);
}

export const readWalletProofs = () => read("proofsByMint", {});

export function rememberMint(mintUrl) {
  // Show the mint in the full wallet's mint list (Navbar `savedMints`).
  const saved = read("savedMints", []);
  if (!saved.includes(mintUrl)) write("savedMints", [...saved, mintUrl]);
}

export const sumProofs = (proofs = []) => proofs.reduce((s, p) => s + (Number(p?.amount) || 0), 0);
