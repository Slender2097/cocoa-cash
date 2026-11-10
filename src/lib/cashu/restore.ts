// src/lib/cashu/restore.ts
// "Restore from phrase": recover the sats whose secrets came from the phrase
// (NUT-13), from every mint the user names.
//
//   for each mint, for each of its sat keysets:
//     NUT-09 restore of counters 0, 1, 2, ... in batches, until a long run of
//     counters comes back with no signature (the gap limit)
//   NUT-07: keep only the restored proofs the mint reports UNSPENT
//   add them to the normal proof store (deduplicated by secret; nothing that
//   is already there is removed or replaced)
//   raise the stored counter past the last restored one, so new outputs never
//   reuse a counter
//
// Proofs with random secrets (made before NUT-13 was added) are not touched
// and cannot be found this way. The journal's own NUT-09 recovery of single
// operations is separate and unchanged.
// MIT License

import * as bip39 from "bip39";
import { CheckStateEnum } from "@cashu/cashu-ts";
import { addProofs, normalizeMint, readJSON, readProofs, rememberMint } from "./storage";
import { getWallet, errText, fromHex } from "./outputs";
import type { SerializedOutput } from "./outputs";
import { counterSource, currentSeed, getMnemonic, normalizePhrase, replaceMnemonic, rememberUsedMint, usedMints } from "./seed";
import { listOps, openOps } from "./journal";
import { withWalletLock } from "./lock";

// Counters with no signature in a row before a keyset counts as done.
const GAP_LIMIT = 300;

export type MintRestore = { mint: string; amount: number; proofs: number; error?: string };

/** Every mint this browser knows about: used for outputs, in the mints list, holding proofs, or in the journal. */
export function knownMints(): string[] {
  const all = [
    ...usedMints(),
    ...readJSON<string[]>("savedMints", []),
    ...Object.keys(readProofs()),
    ...listOps().map((o) => o.mint),
  ].map(normalizeMint);
  return [...new Set(all.filter(Boolean))];
}

/**
 * Would switching to `words` leave sats behind that the new phrase cannot
 * recover? True when the phrase differs and this browser holds proofs or
 * unfinished operations.
 */
export function phraseChangeAtRisk(words: string): boolean {
  if (normalizePhrase(words) === getMnemonic()) return false;
  const hasProofs = Object.values(readProofs()).some((list) => list.length > 0);
  return hasProofs || openOps().length > 0;
}

const decoder = new TextDecoder();
const secretOf = (o: SerializedOutput) => decoder.decode(fromHex(o.s));

/**
 * Secrets this browser has already handed on or reserved: inputs of open
 * operations (they come back through the journal) and every token made by
 * Send (the recipient may not have claimed it yet). A restore in the same
 * browser must not count those as balance again.
 */
function journalSecrets(): Set<string> {
  const out = new Set<string>();
  for (const op of listOps()) {
    if (op.kind === "send" && op.state !== "FAILED") op.sendOutputs.forEach((o) => out.add(secretOf(o)));
    if ("inputs" in op && !["DONE", "FAILED", "EXPIRED"].includes(op.state)) op.inputs.forEach((p) => out.add(p.secret));
  }
  return out;
}

async function restoreMint(mint: string, progress: (text: string) => void): Promise<MintRestore> {
  const label = mint.replace(/^https?:\/\//, "");
  progress(`Checking mint ${label}…`);
  let wallet;
  try {
    wallet = await getWallet(mint);
  } catch (e) {
    return { mint, amount: 0, proofs: 0, error: `The mint did not answer (${errText(e)})` };
  }
  const counters = counterSource(mint, currentSeed().fp);
  const skip = journalSecrets();
  let amount = 0;
  let count = 0;
  try {
    const keysets = wallet.keyChain.getKeysets().filter((k) => k.hasHexId); // NUT-13 needs hex keyset ids
    for (const [i, ks] of keysets.entries()) {
      if (keysets.length > 1) progress(`Checking mint ${label}… (keyset ${i + 1} of ${keysets.length})`);
      const res = await wallet.batchRestore(GAP_LIMIT, undefined, 0, ks.id); // NUT-09
      if (res.lastCounterWithSignature !== undefined) {
        // Saved before anything else is sent: new outputs start past every restored one.
        await counters.advanceToAtLeast(ks.id, res.lastCounterWithSignature + 1);
        rememberUsedMint(mint);
      }
      if (!res.proofs.length) continue;
      const states = await wallet.checkProofsStates(res.proofs); // NUT-07
      const unspent = res.proofs.filter((p, k) => states[k]?.state === CheckStateEnum.UNSPENT && !skip.has(p.secret));
      amount += addProofs(mint, unspent);
      count += unspent.length;
    }
    if (amount > 0) rememberMint(mint);
    return { mint, amount, proofs: count };
  } catch (e) {
    if (amount > 0) rememberMint(mint);
    return { mint, amount, proofs: count, error: `The mint stopped answering (${errText(e)})` };
  }
}

/**
 * Restore the sats of `words` from `mints`. If `words` differs from the
 * current phrase it becomes the wallet's phrase (the old one is kept in
 * `mnemonic.previous`); the caller must have the user's confirmation first
 * when phraseChangeAtRisk() is true. Runs under the wallet lock, so no
 * operation reserves counters or changes proofs meanwhile.
 */
export function restoreFromPhrase(words: string, mints: string[], progress: (text: string) => void): Promise<MintRestore[]> {
  const phrase = normalizePhrase(words);
  if (!bip39.validateMnemonic(phrase)) return Promise.reject(new Error("These 12 words are not a valid phrase."));
  const list = [...new Set(mints.map(normalizeMint).filter(Boolean))];
  return withWalletLock(async () => {
    if (phrase !== getMnemonic()) replaceMnemonic(phrase);
    const results: MintRestore[] = [];
    for (const mint of list) results.push(await restoreMint(mint, progress));
    return results;
  });
}
