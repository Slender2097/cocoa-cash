// src/lib/cashu/journal.ts
// Write-ahead journal for every wallet operation that talks to a mint.
//
//   mint    NUT-04 bolt11: quote -> (paid) -> outputs persisted -> mint -> proofs
//   melt    NUT-05 bolt11 (+ NUT-08 change): inputs + change outputs persisted -> melt
//   send    NUT-03 swap: inputs + outputs persisted -> swap -> token kept in history
//   receive NUT-03 swap: token inputs + outputs persisted -> swap -> proofs
//
// Rules (Hold BTC Cashu custody/recovery discipline):
//   * A record (with its blinding data) is written BEFORE the request that
//     makes the mint sign anything.
//   * Inputs being spent are moved out of the spendable balance into the
//     record first, and only returned if the mint confirms (NUT-07) they are
//     still UNSPENT.
//   * A lost reply is resolved with NUT-09 restore of the persisted outputs.
//     NUT-07 is only used to decide what to do next. It never counts as
//     a payment.
//   * Every advance* function is idempotent: safe to call again after a crash,
//     reload or network error.
// MIT License

import { Amount, MintQuoteState, MeltQuoteState, CheckStateEnum, getEncodedToken } from "@cashu/cashu-ts";
import type { MintPreview, MeltPreview, SwapPreview, Proof, Wallet, P2PKOptions, ProofLike, MeltQuoteBolt11Response } from "@cashu/cashu-ts";
import { addProofs, removeProofs, normalizeMint, readJSON, writeJSON, sumProofs, toStoredProof } from "./storage";
import type { StoredProof } from "./storage";
import { getWallet, serializeOutputs, deserializeOutputs, restoreOutputs, errText } from "./outputs";
import type { SerializedOutput } from "./outputs";

// ---------------------------------------------------------------------------
// Record store
// ---------------------------------------------------------------------------

type Base = { id: string; mint: string; createdAt: number; updatedAt?: number; error?: string | null };

export type MintOp = Base & {
  kind: "mint";
  amount: number;
  invoice: string;
  expiry: number | null;
  state: "UNPAID" | "ISSUING" | "DONE" | "EXPIRED" | "FAILED";
  outputs?: SerializedOutput[];
  keysetId?: string;
};
export type MeltOp = Base & {
  kind: "melt";
  amount: number;
  feeReserve: number;
  invoice: string;
  inputs: StoredProof[];
  outputs: SerializedOutput[];
  keysetId: string;
  state: "PREPARED" | "PENDING" | "DONE" | "FAILED";
  change?: number;
  preimage?: string | null;
};
export type SendOp = Base & {
  kind: "send";
  amount: number;
  inputs: StoredProof[];
  keepOutputs: SerializedOutput[];
  sendOutputs: SerializedOutput[];
  keysetId: string;
  fees: number;
  state: "PREPARED" | "DONE" | "FAILED";
  token?: string;
};
export type ReceiveOp = Base & {
  kind: "receive";
  inputs: StoredProof[];
  outputs: SerializedOutput[];
  keysetId: string;
  amount: number; // after fees
  fees: number;
  needsKey?: boolean; // P2PK inputs: only the tip board (which holds the key) can advance it
  state: "PREPARED" | "DONE" | "FAILED";
};
export type Op = MintOp | MeltOp | SendOp | ReceiveOp;

const JOURNAL = "cocoa.journal";
// Fields that may be set once and never replaced (blinding data, inputs...).
const ONCE = ["inputs", "outputs", "keepOutputs", "sendOutputs", "invoice", "createdAt", "token", "kind", "mint"];
export const JOURNAL_EVENT = "cocoa:journal";

export function listOps(): Op[] {
  return Object.values(readJSON<Record<string, Op>>(JOURNAL, {})).sort((a, b) => b.createdAt - a.createdAt);
}
export const getOp = (id: string): Op | null => readJSON<Record<string, Op>>(JOURNAL, {})[id] || null;

/** Write-once-aware upsert. Re-reads storage first so tabs don't clobber each other. */
export function putOp<T extends Op>(id: string, patch: Partial<T>): T {
  const all = readJSON<Record<string, Op>>(JOURNAL, {});
  const prev = (all[id] || {}) as Record<string, unknown>;
  const next: Record<string, unknown> = { ...prev, ...patch, id, updatedAt: Date.now() };
  for (const f of ONCE) if (prev[f] !== undefined && prev[f] !== null) next[f] = prev[f];
  all[id] = next as Op;
  writeJSON(JOURNAL, all);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(JOURNAL_EVENT));
  return next as T;
}

const isOpen = (op: Op) => !["DONE", "FAILED", "EXPIRED"].includes(op.state);
export const openOps = (mint?: string) =>
  listOps().filter((o) => isOpen(o) && (!mint || normalizeMint(o.mint) === normalizeMint(mint)));

// cashu-ts wants Amount objects; we store numbers.
export const toProofLike = (p: StoredProof): ProofLike => ({ ...p, amount: p.amount });
const toProof = (p: StoredProof): Proof => ({ ...p, amount: Amount.from(p.amount) }) as Proof;
const stored = (ps: Array<Proof | ProofLike>) => ps.map(toStoredProof).filter((p): p is StoredProof => !!p);
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

async function inputsStillUnspent(wallet: Wallet, inputs: StoredProof[]): Promise<boolean | null> {
  try {
    const states = await wallet.checkProofsStates(inputs); // NUT-07, as a filter only
    if (states.every((s) => s.state === CheckStateEnum.UNSPENT)) return true;
    if (states.some((s) => s.state === CheckStateEnum.SPENT)) return false;
    return null; // PENDING: decide later
  } catch {
    return null; // mint unreachable: decide later
  }
}

// ---------------------------------------------------------------------------
// Shared building blocks (also used by the tip embed)
// ---------------------------------------------------------------------------

/** Build outputs for a paid NUT-04 quote. Optional NUT-11 P2PK lock. */
export async function prepareMintOutputs(wallet: Wallet, amount: number, quoteId: string, p2pk?: P2PKOptions) {
  let builder = wallet.ops.mintBolt11(amount, quoteId);
  if (p2pk) builder = builder.asP2PK(p2pk);
  const preview = await builder.prepare();
  return { outputs: serializeOutputs(preview.outputData), keysetId: preview.keysetId };
}

/** NUT-04 mint with the persisted outputs; NUT-09 restore if the reply was lost. */
export async function issueMint(wallet: Wallet, quoteId: string, outputs: SerializedOutput[], keysetId: string): Promise<Proof[]> {
  const outputData = deserializeOutputs(outputs);
  const preview = {
    method: "bolt11",
    payload: { quote: quoteId, outputs: outputData.map((o) => o.blindedMessage) },
    outputData,
    keysetId,
    quote: { quote: quoteId },
  } as unknown as MintPreview; // rebuilt from the persisted record; completeMint only reads these fields
  try {
    return await wallet.completeMint(preview);
  } catch (e) {
    const restored = await restoreOutputs(wallet, outputData);
    if (restored.length) return restored;
    throw e;
  }
}

/**
 * NUT-03 swap of `inputs` into the persisted outputs. On failure, NUT-07
 * decides: inputs SPENT -> NUT-09 restore (our swap went through, or someone
 * else spent them first if restore finds nothing); otherwise retry later.
 * Returns { keep, send } proofs, or { spentElsewhere: true }.
 */
export async function swapWithRecovery(
  wallet: Wallet,
  args: { inputs: StoredProof[]; keepOutputs: SerializedOutput[]; sendOutputs?: SerializedOutput[]; keysetId: string; amount: number; fees: number; privkey?: string }
): Promise<{ keep: Proof[]; send: Proof[] } | { spentElsewhere: true }> {
  const keepData = deserializeOutputs(args.keepOutputs);
  const sendData = deserializeOutputs(args.sendOutputs || []);
  const preview: SwapPreview = {
    amount: Amount.from(args.amount),
    fees: Amount.from(args.fees),
    keysetId: args.keysetId,
    inputs: args.inputs.map(toProof),
    keepOutputs: keepData,
    sendOutputs: sendData,
  };
  try {
    const res = await wallet.completeSwap(preview, args.privkey);
    return { keep: res.keep || [], send: res.send || [] };
  } catch (e) {
    const unspent = await inputsStillUnspent(wallet, args.inputs);
    if (unspent !== false) throw e; // still spendable or unknown: retry later
    const keep = await restoreOutputs(wallet, keepData);
    const send = await restoreOutputs(wallet, sendData);
    if (!keep.length && !send.length) return { spentElsewhere: true };
    return { keep, send };
  }
}

// ---------------------------------------------------------------------------
// Mint (NUT-04)
// ---------------------------------------------------------------------------

export async function startMint(mint: string, amount: number): Promise<MintOp> {
  const wallet = await getWallet(mint);
  const q = await wallet.createMintQuoteBolt11(amount);
  return putOp<MintOp>(q.quote, {
    kind: "mint",
    mint: normalizeMint(mint),
    amount,
    invoice: q.request,
    expiry: q.expiry ? q.expiry * 1000 : null,
    state: "UNPAID",
    createdAt: Date.now(),
  });
}

export async function advanceMint(id: string): Promise<MintOp> {
  let op = getOp(id) as MintOp;
  const wallet = await getWallet(op.mint);
  if (op.state === "UNPAID") {
    const q = await wallet.checkMintQuoteBolt11(op.id);
    if (q.state === MintQuoteState.UNPAID) {
      if (op.expiry && Date.now() > op.expiry) op = putOp<MintOp>(id, { state: "EXPIRED" });
      return op;
    }
    if (!op.outputs && q.state === MintQuoteState.ISSUED) {
      // Issued to outputs we never recorded (e.g. another device): nothing to recover here.
      return putOp<MintOp>(id, { state: "FAILED", error: "Quote was already issued" });
    }
    if (!op.outputs) {
      const { outputs, keysetId } = await prepareMintOutputs(wallet, op.amount, op.id);
      op = putOp<MintOp>(id, { outputs, keysetId, state: "ISSUING" });
    } else {
      op = putOp<MintOp>(id, { state: "ISSUING" });
    }
  }
  if (op.state === "ISSUING" && op.outputs && op.keysetId) {
    try {
      const proofs = await issueMint(wallet, op.id, op.outputs, op.keysetId);
      addProofs(op.mint, proofs);
      op = putOp<MintOp>(id, { state: "DONE", error: null });
    } catch (e) {
      op = putOp<MintOp>(id, { error: errText(e) }); // stays ISSUING; retried later
      try {
        if ((await wallet.checkMintQuoteBolt11(op.id)).state === MintQuoteState.ISSUED) {
          // Issued: NUT-09 is authoritative. Only an empty (not failed) restore is final.
          const restored = await restoreOutputs(wallet, deserializeOutputs(op.outputs));
          if (restored.length) {
            addProofs(op.mint, restored);
            op = putOp<MintOp>(id, { state: "DONE", error: null });
          } else {
            op = putOp<MintOp>(id, { state: "FAILED", error: "Quote was issued to outputs this wallet does not have" });
          }
        }
      } catch {
        // mint unreachable: retry later
      }
    }
  }
  return op;
}

// ---------------------------------------------------------------------------
// Melt (NUT-05, change via NUT-08)
// ---------------------------------------------------------------------------

/**
 * NUT-05 step 1: ask the mint for a bolt11 melt quote, so the user can see the
 * amount and fee reserve before anything happens. Nothing is reserved,
 * journaled or paid here.
 */
export async function quoteMelt(mint: string, invoice: string): Promise<MeltQuoteBolt11Response> {
  const wallet = await getWallet(mint);
  return wallet.createMeltQuoteBolt11(invoice.trim());
}

/** NUT-05 step 2: pay a quote from quoteMelt() that the user confirmed. */
export async function startMelt(
  mint: string,
  invoice: string,
  quote: MeltQuoteBolt11Response,
  spendable: StoredProof[]
): Promise<MeltOp> {
  if (quote.expiry && Date.now() > quote.expiry * 1000) {
    throw new Error("This quote expired. Paste the invoice again to get a fresh one.");
  }
  // A quote is paid at most once from this wallet: resume an existing record instead of reserving again.
  if (getOp(quote.quote)) return advanceMelt(quote.quote);
  const wallet = await getWallet(mint);
  const amount = Amount.from(quote.amount).toNumber();
  const feeReserve = Amount.from(quote.fee_reserve).toNumber();
  const { send } = wallet.selectProofsToSend(spendable.map(toProofLike), amount + feeReserve, true);
  if (sumProofs(send) < amount + feeReserve) {
    throw new Error(`Insufficient balance: need ${amount + feeReserve} sat (incl. fee reserve), have ${sumProofs(spendable)}`);
  }
  const preview = await wallet.prepareMelt("bolt11", quote, send);
  const op = putOp<MeltOp>(quote.quote, {
    kind: "melt",
    mint: normalizeMint(mint),
    amount,
    feeReserve,
    invoice: invoice.trim(),
    inputs: stored(preview.inputs),
    outputs: serializeOutputs(preview.outputData),
    keysetId: preview.keysetId,
    state: "PREPARED",
    createdAt: Date.now(),
  });
  removeProofs(op.mint, op.inputs); // reserved inside the record until resolved
  return advanceMelt(op.id);
}

export async function advanceMelt(id: string): Promise<MeltOp> {
  let op = getOp(id) as MeltOp;
  const wallet = await getWallet(op.mint);
  const outputData = deserializeOutputs(op.outputs);

  const finishPaid = async (change: Proof[], preimage?: string | null) => {
    if (!change.length && outputData.length) {
      try {
        change = await restoreOutputs(wallet, outputData); // NUT-09 for NUT-08 change
      } catch (e) {
        return putOp<MeltOp>(id, { state: "PENDING", error: errText(e) }); // paid; fetch change later
      }
    }
    addProofs(op.mint, change);
    return putOp<MeltOp>(id, { state: "DONE", change: sumProofs(change), preimage: preimage ?? null, error: null });
  };

  if (op.state === "PREPARED") {
    try {
      const preview = {
        method: "bolt11",
        inputs: op.inputs.map(toProof),
        outputData,
        keysetId: op.keysetId,
        quote: { quote: op.id, amount: Amount.from(op.amount) },
      } as unknown as MeltPreview; // rebuilt from the persisted record; completeMelt only reads these fields
      const res = await wallet.completeMelt(preview);
      const state = (res.quote as { state?: string }).state;
      if (state === MeltQuoteState.PAID) {
        return finishPaid(res.change || [], (res.quote as { payment_preimage?: string | null }).payment_preimage);
      }
      op = putOp<MeltOp>(id, { state: "PENDING", error: null });
      return op;
    } catch (e) {
      op = putOp<MeltOp>(id, { state: "PENDING", error: errText(e) }); // resolve via quote state below
    }
  }

  if (op.state === "PENDING") {
    let q;
    try {
      q = await wallet.checkMeltQuoteBolt11(op.id);
    } catch (e) {
      return putOp<MeltOp>(id, { error: errText(e) });
    }
    if (q.state === MeltQuoteState.PAID) return finishPaid([], q.payment_preimage);
    if (q.state === MeltQuoteState.UNPAID) {
      const unspent = await inputsStillUnspent(wallet, op.inputs);
      if (unspent === true) {
        addProofs(op.mint, op.inputs); // payment failed: inputs back to balance
        return putOp<MeltOp>(id, { state: "FAILED", error: op.error || "Payment failed" });
      }
    }
    // PENDING at the mint (or inconclusive): keep inputs reserved, check again later.
  }
  return getOp(id) as MeltOp;
}

// ---------------------------------------------------------------------------
// Send = create a token (NUT-03 swap), token persisted in the journal
// ---------------------------------------------------------------------------

export async function startSend(mint: string, amount: number, spendable: StoredProof[]): Promise<SendOp> {
  const wallet = await getWallet(mint);
  const { send } = wallet.selectProofsToSend(spendable.map(toProofLike), amount, true);
  if (sumProofs(send) < amount) throw new Error("Insufficient balance");
  const preview = await wallet.prepareSwapToSend(amount, send);
  const op = putOp<SendOp>(newId("send"), {
    kind: "send",
    mint: normalizeMint(mint),
    amount,
    inputs: stored(preview.inputs),
    keepOutputs: serializeOutputs(preview.keepOutputs || []),
    sendOutputs: serializeOutputs(preview.sendOutputs || []),
    keysetId: preview.keysetId,
    fees: Amount.from(preview.fees).toNumber(),
    state: "PREPARED",
    createdAt: Date.now(),
  });
  removeProofs(op.mint, op.inputs);
  return advanceSend(op.id);
}

export async function advanceSend(id: string): Promise<SendOp> {
  const op = getOp(id) as SendOp;
  if (op.state !== "PREPARED") return op;
  const wallet = await getWallet(op.mint);
  try {
    const res = await swapWithRecovery(wallet, {
      inputs: op.inputs,
      keepOutputs: op.keepOutputs,
      sendOutputs: op.sendOutputs,
      keysetId: op.keysetId,
      amount: op.amount,
      fees: op.fees,
    });
    if ("spentElsewhere" in res) return putOp<SendOp>(id, { state: "FAILED", error: "Inputs were spent elsewhere" });
    const token = getEncodedToken({ mint: op.mint, proofs: res.send, unit: "sat" });
    // Token first (so it is never lost), then the change back into the balance.
    putOp<SendOp>(id, { token });
    addProofs(op.mint, res.keep);
    return putOp<SendOp>(id, { state: "DONE", error: null });
  } catch (e) {
    return putOp<SendOp>(id, { error: errText(e) }); // stays PREPARED; retried or cancelled later
  }
}

/** Give up on a send that never reached the mint: only if NUT-07 says inputs are UNSPENT. */
export async function cancelSend(id: string): Promise<SendOp> {
  const op = getOp(id) as SendOp;
  if (op.state !== "PREPARED") return op;
  const wallet = await getWallet(op.mint);
  const unspent = await inputsStillUnspent(wallet, op.inputs);
  if (unspent !== true) return advanceSend(id);
  addProofs(op.mint, op.inputs);
  return putOp<SendOp>(id, { state: "FAILED", error: "Cancelled" });
}

// ---------------------------------------------------------------------------
// Receive = claim a token (NUT-03 swap). Final only when the swap succeeds.
// ---------------------------------------------------------------------------

export async function startReceive(token: string, opts: { privkey?: string; id?: string } = {}): Promise<ReceiveOp> {
  const { getTokenMetadata } = await import("@cashu/cashu-ts");
  const meta = getTokenMetadata(token.trim());
  const wallet = await getWallet(meta.mint);
  const preview = await wallet.prepareSwapToReceive(token.trim(), opts.privkey ? { privkey: opts.privkey } : undefined);
  const op = putOp<ReceiveOp>(opts.id || newId("recv"), {
    kind: "receive",
    mint: normalizeMint(meta.mint),
    inputs: stored(preview.inputs),
    outputs: serializeOutputs([...(preview.keepOutputs || []), ...(preview.sendOutputs || [])]),
    keysetId: preview.keysetId,
    amount: Amount.from(preview.amount).toNumber(),
    fees: Amount.from(preview.fees).toNumber(),
    needsKey: !!opts.privkey,
    state: "PREPARED",
    createdAt: Date.now(),
  });
  return advanceReceive(op.id, opts.privkey);
}

export async function advanceReceive(id: string, privkey?: string): Promise<ReceiveOp> {
  const op = getOp(id) as ReceiveOp;
  if (op.state !== "PREPARED") return op;
  const wallet = await getWallet(op.mint);
  try {
    const res = await swapWithRecovery(wallet, {
      inputs: op.inputs,
      keepOutputs: op.outputs,
      keysetId: op.keysetId,
      amount: op.amount,
      fees: op.fees,
      privkey,
    });
    if ("spentElsewhere" in res) {
      return putOp<ReceiveOp>(id, { state: "FAILED", error: "Token was already spent" });
    }
    const proofs = [...res.keep, ...res.send];
    addProofs(op.mint, proofs);
    return putOp<ReceiveOp>(id, { state: "DONE", amount: sumProofs(proofs), error: null });
  } catch (e) {
    return putOp<ReceiveOp>(id, { error: errText(e) }); // retried later
  }
}

// ---------------------------------------------------------------------------

/**
 * One-time import of the old `pendingMints` list (before the journal). Old
 * records stored the mint preview with a lossy serializer; the blinding data
 * is rebuilt here so a paid-but-unissued quote can still be recovered with
 * NUT-09 instead of being lost.
 */
export function importLegacyPendingMints(): void {
  const legacy = readJSON<Array<Record<string, unknown>>>("pendingMints", []);
  if (!Array.isArray(legacy) || !legacy.length) return;
  for (const p of legacy) {
    const id = String(p.id || "");
    if (!id || getOp(id)) continue;
    const preview = p.preview as { outputData?: Array<Record<string, unknown>>; keysetId?: string } | undefined;
    let outputs: SerializedOutput[] | undefined;
    try {
      outputs = preview?.outputData?.map((o) => {
        const bm = o.blindedMessage as { amount: unknown; B_: string; id: string };
        const secretObj = o.secret as Record<string, number>;
        const bytes = Uint8Array.from(Object.keys(secretObj).sort((a, b) => +a - +b).map((k) => secretObj[k]));
        return {
          B: { amount: Number(bm.amount), B_: bm.B_, id: bm.id },
          r: BigInt(o.blindingFactor as bigint | string).toString(16),
          s: Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(""),
        };
      });
    } catch {
      outputs = undefined;
    }
    putOp<MintOp>(id, {
      kind: "mint",
      mint: normalizeMint(String(p.mintUrl || "")),
      amount: Number(p.amount) || 0,
      invoice: String(p.invoice || ""),
      expiry: null,
      state: outputs?.length && preview?.keysetId ? "ISSUING" : "UNPAID",
      outputs: outputs?.length ? outputs : undefined,
      keysetId: preview?.keysetId,
      createdAt: Number(p.timestamp) || Date.now(),
    });
  }
  localStorage.setItem("pendingMints.imported", localStorage.getItem("pendingMints") || "[]");
  localStorage.removeItem("pendingMints");
}

/** Resume every open operation for a mint (call on connect, and periodically). */
export async function recoverOpen(mint: string, privkey?: string): Promise<void> {
  for (const op of openOps(mint)) {
    try {
      if (op.kind === "mint") await advanceMint(op.id);
      else if (op.kind === "melt") await advanceMelt(op.id);
      else if (op.kind === "send") await advanceSend(op.id);
      else if (op.kind === "receive" && (!op.needsKey || privkey)) await advanceReceive(op.id, privkey);
    } catch {
      // network trouble: next round
    }
  }
}
