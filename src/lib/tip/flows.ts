// src/lib/tip/flows.ts
// Tip state machines. Framework-free so they can be tested outside React.
//
// Finality: a tip counts as RECEIVED only after the creator's browser
// completes a NUT-03 swap of the delivered proofs and unblinds the new
// outputs (journal `receive` op). NUT-07 is only used as a filter.
//
// Recovery: blinding data is persisted before every mint call; lost replies
// are recovered with NUT-09 (see src/lib/cashu/journal.ts).
//
// Writes to the outbox, the inbox and the wallet run under the cross-tab
// wallet lock (src/lib/cashu/lock.ts); network-only steps run outside it.
// MIT License

import { Amount, getTokenMetadata, getEncodedToken, getP2PKExpectedWitnessPubkeys, CheckStateEnum, MintQuoteState } from "@cashu/cashu-ts";
import type { Proof, ProofLike } from "@cashu/cashu-ts";
import { getPublicKey } from "nostr-tools/pure";
import { readJSON, writeJSON, sumProofs, normalizeMint, toStoredProof } from "@/lib/cashu/storage";
import type { StoredProof } from "@/lib/cashu/storage";
import { getWallet, fromHex, errText } from "@/lib/cashu/outputs";
import type { SerializedOutput } from "@/lib/cashu/outputs";
import { prepareMintOutputs, issueMint, checkMintQuoteState, startReceiveUnlocked, advanceReceiveUnlocked, getOp } from "@/lib/cashu/journal";
import { withWalletLock } from "@/lib/cashu/lock";
import { p2pkPubkey } from "./config";
import { wrapPayload, publishWrap, fetchPayloads } from "./nut18";
import type { Nut18Payload } from "./nut18";
import type { NostrEvent } from "nostr-tools/pure";

export const OUTBOX = "cocoaTip.outbox"; // visitor side (inside the iframe)
export const INBOX = "cocoaTip.inbox"; // creator side (admin board)

// --- tiny write-once record store -------------------------------------------
const ONCE = ["payload", "outputs", "wrap", "createdAt", "quote", "invoice", "proofs"];

function put<T extends { id: string }>(store: string, id: string, patch: Partial<T>): T {
  const all = readJSON<Record<string, T>>(store, {});
  const prev = (all[id] || {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...prev, ...patch, id, updatedAt: Date.now() };
  for (const f of ONCE) if (prev[f] !== undefined && prev[f] !== null) next[f] = prev[f];
  all[id] = next as T;
  writeJSON(store, all);
  return next as T;
}
const get = <T>(store: string, id: string): T | null => readJSON<Record<string, T>>(store, {})[id] || null;
const list = <T extends { createdAt: number }>(store: string): T[] =>
  Object.values(readJSON<Record<string, T>>(store, {})).sort((a, b) => b.createdAt - a.createdAt);

// ============================================================================
// Visitor side
// ============================================================================

export type OutboxRecord = {
  id: string;
  kind: "lightning" | "token";
  mint: string;
  amount: number;
  pubkey: string;
  relays: string[];
  memo: string;
  quote?: string;
  invoice?: string;
  expiry?: number | null;
  outputs?: SerializedOutput[];
  keysetId?: string;
  proofs?: StoredProof[];
  wrap?: NostrEvent;
  state: "UNPAID" | "MINTING" | "MINTED" | "SENDING" | "DELIVERED" | "EXPIRED";
  createdAt: number;
  deliveredAt?: number;
};

/** NUT-04 bolt11 mint quote at the creator's mint; stored before the invoice is shown. */
export async function createLightningTip(a: { mint: string; amount: number; pubkey: string; relays: string[]; memo?: string }) {
  const wallet = await getWallet(a.mint);
  const quote = await wallet.createMintQuoteBolt11(a.amount, a.memo || undefined);
  return withWalletLock(async () =>
    put<OutboxRecord>(OUTBOX, quote.quote, {
      kind: "lightning",
      mint: normalizeMint(a.mint),
      amount: a.amount,
      pubkey: a.pubkey,
      relays: a.relays,
      memo: a.memo || "",
      quote: quote.quote,
      invoice: quote.request,
      expiry: quote.expiry ? quote.expiry * 1000 : null,
      state: "UNPAID",
      createdAt: Date.now(),
    })
  );
}

/**
 * Advance a visitor record as far as it can go. Idempotent.
 *   UNPAID  -> quote paid: NUT-11 P2PK outputs to the creator, persisted -> MINTING
 *   MINTING -> NUT-04 mint (NUT-09 restore on a lost reply) -> MINTED
 *   MINTED/SENDING -> NUT-18 payload over NIP-17 -> DELIVERED
 */
export const advanceTip = (id: string) => withWalletLock(() => advanceTipUnlocked(id));

async function advanceTipUnlocked(id: string): Promise<OutboxRecord> {
  let rec = get<OutboxRecord>(OUTBOX, id);
  if (!rec) throw new Error("Unknown tip");

  if (rec.kind === "lightning" && rec.state === "UNPAID") {
    const wallet = await getWallet(rec.mint);
    const state = await checkMintQuoteState(wallet, rec.mint, rec.quote!, rec.amount);
    if (state === MintQuoteState.UNPAID) {
      if (rec.expiry && Date.now() > rec.expiry) rec = put<OutboxRecord>(OUTBOX, id, { state: "EXPIRED" });
      return rec;
    }
    // Lock to the creator so nobody else, including this visitor, can spend
    // the proofs while they travel.
    const prepared = rec.outputs
      ? { outputs: rec.outputs, keysetId: rec.keysetId }
      : await prepareMintOutputs(wallet, rec.amount, rec.quote!, { pubkey: p2pkPubkey(rec.pubkey) });
    rec = put<OutboxRecord>(OUTBOX, id, { ...prepared, state: "MINTING" });
  }

  if (rec.state === "MINTING") {
    const wallet = await getWallet(rec.mint);
    const proofs = await issueMint(wallet, rec.quote!, rec.outputs!, rec.keysetId!);
    rec = put<OutboxRecord>(OUTBOX, id, {
      proofs: proofs.map(toStoredProof).filter((p): p is StoredProof => !!p),
      state: "MINTED",
    });
  }

  if (rec.state === "MINTED" || rec.state === "SENDING") {
    if (!rec.wrap) {
      const payload: Nut18Payload = { mint: rec.mint, unit: "sat", proofs: rec.proofs! };
      if (rec.memo) payload.memo = rec.memo;
      rec = put<OutboxRecord>(OUTBOX, id, { wrap: wrapPayload(rec.pubkey, payload), state: "SENDING" });
    }
    await publishWrap(rec.wrap!, rec.relays);
    rec = put<OutboxRecord>(OUTBOX, id, { state: "DELIVERED", deliveredAt: Date.now() });
  }
  return rec;
}

/**
 * Pasted/scanned token: forwarded to the creator as a NUT-18 payload. The
 * visitor does not swap it; the creator's swap makes it final. NUT-07 is used
 * only to reject a token that is already spent.
 */
export async function createTokenTip(a: { token: string; mints: string[]; pubkey: string; relays: string[]; memo?: string }) {
  // v4 tokens carry short keyset ids (NUT-02): read the mint, then decode with its keysets.
  const meta = getTokenMetadata(a.token.trim());
  const mint = normalizeMint(meta.mint);
  if (!a.mints.map(normalizeMint).includes(mint)) {
    throw new Error(`This creator accepts tokens from ${a.mints.join(", ")} only.`);
  }
  if ((meta.unit || "sat") !== "sat") throw new Error("Only sat tokens are accepted.");

  const wallet = await getWallet(mint);
  const proofs = (wallet.decodeToken(a.token.trim()).proofs || []).map(toStoredProof).filter((p): p is StoredProof => !!p);
  if (!proofs.length) throw new Error("Empty token.");
  const states = await wallet.checkProofsStates(proofs);
  if (states.some((s) => s.state === CheckStateEnum.SPENT)) throw new Error("This token was already spent.");

  const payload: Nut18Payload = { mint, unit: "sat", proofs };
  if (a.memo) payload.memo = a.memo;
  const wrap = wrapPayload(a.pubkey, payload);
  return withWalletLock(async () => {
    put<OutboxRecord>(OUTBOX, wrap.id, {
      kind: "token",
      mint,
      amount: sumProofs(proofs),
      pubkey: a.pubkey,
      relays: a.relays,
      memo: a.memo || "",
      proofs,
      wrap,
      state: "SENDING",
      createdAt: Date.now(),
    });
    return advanceTipUnlocked(wrap.id);
  });
}

/** Visitor records for this creator that still need work (resume on reload). */
export const openOutbox = (pubkey: string) =>
  list<OutboxRecord>(OUTBOX).filter((r) => r.pubkey === pubkey && !["DELIVERED", "EXPIRED"].includes(r.state));

// ============================================================================
// Creator side
// ============================================================================

export type InboxRecord = {
  id: string; // gift wrap event id
  payload: Nut18Payload;
  mint: string;
  memo: string;
  offered: number;
  createdAt: number;
  state: "NEW" | "SWAPPING" | "RECEIVED" | "FAILED";
  opId?: string; // journal `receive` op doing the NUT-03 swap
  amount?: number;
  fees?: number;
  receivedAt?: number;
  error?: string | null;
};

export const listInbox = () => list<InboxRecord>(INBOX);

/** Pull NUT-18 payloads from relays into the inbox (write-once per event). */
export async function syncInbox(sk: Uint8Array, relays: string[], acceptedMints: string[]): Promise<number> {
  const items = await fetchPayloads(sk, relays); // relays only: no lock needed yet
  const accepted = acceptedMints.map(normalizeMint);
  return withWalletLock(async () => {
    let added = 0;
    for (const it of items) {
      if (get<InboxRecord>(INBOX, it.id)) continue;
      const mint = normalizeMint(it.payload.mint);
      const ok = accepted.includes(mint) && (it.payload.unit || "sat") === "sat";
      put<InboxRecord>(INBOX, it.id, {
        payload: it.payload,
        mint,
        memo: typeof it.payload.memo === "string" ? it.payload.memo.slice(0, 280) : "",
        offered: sumProofs(it.payload.proofs),
        createdAt: it.createdAt,
        state: ok ? "NEW" : "FAILED",
        error: ok ? null : "Mint or unit not accepted by this tip button",
      });
      added++;
    }
    return added;
  });
}

function lockedToSomeoneElse(proofs: ProofLike[], myXonly: string): boolean {
  for (const p of proofs) {
    let keys: string[] = [];
    try {
      keys = getP2PKExpectedWitnessPubkeys(p.secret);
    } catch {
      continue; // plain bearer proof
    }
    if (keys.length && !keys.some((k) => k.slice(-64) === myXonly)) return true;
  }
  return false;
}

/** Claim one inbox record via a journal `receive` op (NUT-03 swap, signed for NUT-11). Caller holds the wallet lock. */
async function claimRecordUnlocked(id: string, skHex: string): Promise<InboxRecord | null> {
  let rec = get<InboxRecord>(INBOX, id);
  if (!rec || rec.state === "RECEIVED" || rec.state === "FAILED") return rec;

  if (!rec.opId || !getOp(rec.opId)) {
    if (lockedToSomeoneElse(rec.payload.proofs, getPublicKey(fromHex(skHex)))) {
      return put<InboxRecord>(INBOX, id, { state: "FAILED", error: "Locked to a different key" });
    }
    const proofs: Proof[] = rec.payload.proofs.map((p) => ({ ...p, amount: Amount.from(p.amount) }));
    const token = getEncodedToken({ mint: rec.mint, unit: "sat", proofs });
    rec = put<InboxRecord>(INBOX, id, { opId: `tip_${id}`, state: "SWAPPING" });
    await startReceiveUnlocked(token, { privkey: skHex, id: `tip_${id}` });
  } else {
    await advanceReceiveUnlocked(rec.opId, skHex);
  }

  const op = getOp(rec.opId!);
  if (!op || op.kind !== "receive") return rec;
  if (op.state === "DONE") {
    return put<InboxRecord>(INBOX, id, {
      state: "RECEIVED",
      amount: op.amount,
      fees: op.fees,
      receivedAt: Date.now(),
      error: null,
    });
  }
  if (op.state === "FAILED") return put<InboxRecord>(INBOX, id, { state: "FAILED", error: op.error });
  return put<InboxRecord>(INBOX, id, { error: op.error || null });
}

/** Claim every pending inbox record, holding the wallet lock for the whole round. */
export function claimAll(skHex: string): Promise<void> {
  return withWalletLock(async () => {
    for (const r of listInbox().filter((x) => x.state === "NEW" || x.state === "SWAPPING")) {
      try {
        await claimRecordUnlocked(r.id, skHex);
      } catch (e) {
        put<InboxRecord>(INBOX, r.id, { error: errText(e) });
      }
    }
  });
}
