// src/lib/tip/flows.js
// The tip state machines. Framework-free so they can be tested outside React.
//
// Finality rule: a tip counts as RECEIVED only after the creator's browser
// completes a NUT-03 swap of the delivered proofs and unblinds the new
// outputs. NUT-07 checkstate is used only to filter (spent vs. retry), never
// as proof of payment.
//
// Recovery rule: blinding data is persisted BEFORE every mint call (NUT-04
// mint, NUT-03 swap). If the reply is lost, the same outputs are recovered
// with NUT-09 restore, so nothing is double-spent or lost.
// MIT License

import { Wallet, getTokenMetadata, getP2PKExpectedWitnessPubkeys } from "@cashu/cashu-ts";
import {
  putRecord,
  getRecord,
  listRecords,
  serializeOutputs,
  deserializeOutputs,
  restoreFromOutputs,
  addProofsToWallet,
  rememberMint,
  sumProofs,
} from "./records";
import { normalizeMint, walletMintKey, p2pkPubkey } from "./config";
import { wrapPayload, publishWrap, fetchPayloads } from "./nut18";

export const OUTBOX = "cocoaTip.outbox"; // visitor side (inside the iframe)
export const INBOX = "cocoaTip.inbox"; // creator side (admin board)

const wallets = new Map();
export async function getWallet(mintUrl) {
  const url = normalizeMint(mintUrl);
  if (!wallets.has(url)) {
    const w = new Wallet(url, { unit: "sat" });
    wallets.set(
      url,
      w.loadMint().then(() => w).catch((e) => {
        wallets.delete(url);
        throw e;
      })
    );
  }
  return wallets.get(url);
}

const errMsg = (e) => (e && (e.message || String(e))) || "Unknown error";

// ============================================================================
// Visitor side
// ============================================================================

/**
 * Step 1 (Lightning): NUT-04 bolt11 mint quote at the creator's mint.
 * The quote is written to the outbox before the invoice is shown.
 */
export async function createLightningTip({ mint, amount, pubkey, relays, memo }) {
  const wallet = await getWallet(mint);
  const quote = await wallet.createMintQuoteBolt11(amount, memo || undefined);
  return putRecord(OUTBOX, quote.quote, {
    kind: "lightning",
    mint: normalizeMint(mint),
    amount,
    pubkey,
    relays,
    memo: memo || "",
    quote: quote.quote,
    invoice: quote.request,
    expiry: quote.expiry ? quote.expiry * 1000 : null,
    state: "UNPAID",
    createdAt: Date.now(),
  });
}

/**
 * Advance a visitor record as far as it can go right now. Safe to call
 * repeatedly (polling, page reload, retry button).
 *   UNPAID   -> (quote paid)   prepare P2PK outputs, persist -> MINTING
 *   MINTING  -> NUT-04 mint, or NUT-09 restore if the reply was lost -> MINTED
 *   MINTED / SENDING -> publish NUT-18 payload over NIP-17 -> DELIVERED
 */
export async function advanceTip(id) {
  let rec = getRecord(OUTBOX, id);
  if (!rec) throw new Error("Unknown tip");

  if (rec.kind === "lightning" && rec.state === "UNPAID") {
    const wallet = await getWallet(rec.mint);
    const q = await wallet.checkMintQuoteBolt11(rec.quote);
    if (q.state === "UNPAID") {
      if (rec.expiry && Date.now() > rec.expiry) rec = putRecord(OUTBOX, id, { state: "EXPIRED" });
      return rec;
    }
    // Paid (or already issued by an earlier attempt of ours). Lock the new
    // proofs to the creator with NUT-11 P2PK so nobody else, including this
    // visitor, can spend them while they travel.
    if (!rec.outputs) {
      const preview = await wallet.ops
        .mintBolt11(rec.amount, rec.quote)
        .asP2PK({ pubkey: p2pkPubkey(rec.pubkey) })
        .prepare();
      rec = putRecord(OUTBOX, id, {
        outputs: serializeOutputs(preview.outputData),
        keysetId: preview.keysetId,
        state: "MINTING",
      });
    } else {
      rec = putRecord(OUTBOX, id, { state: "MINTING" });
    }
  }

  if (rec.state === "MINTING") {
    const wallet = await getWallet(rec.mint);
    const outputData = deserializeOutputs(rec.outputs);
    let proofs = [];
    try {
      proofs = await wallet.completeMint({
        method: "bolt11",
        payload: { quote: rec.quote, outputs: outputData.map((o) => o.blindedMessage) },
        outputData,
        keysetId: rec.keysetId,
        quote: rec.quote,
      });
    } catch (e) {
      // Lost reply or "already issued": recover our own outputs (NUT-09).
      proofs = await restoreFromOutputs(wallet, outputData);
      if (!proofs.length) throw e;
    }
    rec = putRecord(OUTBOX, id, { proofs, state: "MINTED" });
  }

  if (rec.state === "MINTED" || rec.state === "SENDING") {
    if (!rec.wrap) {
      const payload = { mint: rec.mint, unit: "sat", proofs: rec.proofs };
      if (rec.memo) payload.memo = rec.memo;
      rec = putRecord(OUTBOX, id, { wrap: wrapPayload(rec.pubkey, payload), state: "SENDING" });
    }
    await publishWrap(rec.wrap, rec.relays);
    rec = putRecord(OUTBOX, id, { state: "DELIVERED", deliveredAt: Date.now() });
  }

  return rec;
}

/**
 * Pasted/scanned token: forward it to the creator as a NUT-18 payload.
 * The visitor's browser does not swap it; the creator's swap is what makes
 * it final. NUT-07 is used only to reject a token that is already spent.
 */
export async function createTokenTip({ token, mints, pubkey, relays, memo }) {
  // v4 tokens carry short keyset ids (NUT-02), so read the mint first and
  // decode with that mint's keysets.
  const meta = getTokenMetadata(token.trim());
  const mint = normalizeMint(meta.mint);
  if (!mints.map(normalizeMint).includes(mint)) {
    throw new Error(`This creator accepts tokens from ${mints.join(", ")} only.`);
  }
  if ((meta.unit || "sat") !== "sat") throw new Error("Only sat tokens are accepted.");

  const wallet = await getWallet(mint);
  const proofs = wallet.decodeToken(token.trim()).proofs || [];
  if (!proofs.length) throw new Error("Empty token.");
  const states = await wallet.checkProofsStates(proofs);
  if (states.some((s) => s.state === "SPENT")) throw new Error("This token was already spent.");

  const amount = sumProofs(proofs);
  const payload = { mint, unit: "sat", proofs };
  if (memo) payload.memo = memo;
  const wrap = wrapPayload(pubkey, payload);
  putRecord(OUTBOX, wrap.id, {
    kind: "token",
    mint,
    amount,
    pubkey,
    relays,
    memo: memo || "",
    proofs,
    wrap,
    state: "SENDING",
    createdAt: Date.now(),
  });
  return advanceTip(wrap.id);
}

/** Visitor records for this creator that still need work (resume on reload). */
export const openOutbox = (pubkey) =>
  listRecords(OUTBOX).filter(
    (r) => r.pubkey === pubkey && !["DELIVERED", "EXPIRED"].includes(r.state)
  );

// ============================================================================
// Creator side
// ============================================================================

/** Pull NUT-18 payloads from relays into the inbox (write-once per event). */
export async function syncInbox(sk, relays, acceptedMints) {
  const items = await fetchPayloads(sk, relays);
  const accepted = acceptedMints.map(normalizeMint);
  let added = 0;
  for (const it of items) {
    if (getRecord(INBOX, it.id)) continue;
    const mint = normalizeMint(it.payload.mint);
    const ok = accepted.includes(mint) && (it.payload.unit || "sat") === "sat";
    putRecord(INBOX, it.id, {
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
}

/**
 * Claim one inbox record with a NUT-03 swap. Outputs are persisted before
 * the swap request; a lost reply is recovered with NUT-09.
 *   NEW -> SWAPPING -> RECEIVED | FAILED (or stays SWAPPING to retry)
 */
export async function claimRecord(id, skHex) {
  let rec = getRecord(INBOX, id);
  if (!rec || rec.state === "RECEIVED" || rec.state === "FAILED") return rec;
  const wallet = await getWallet(rec.mint);
  const inputs = rec.payload.proofs;

  if (!rec.outputs) {
    // Refuse proofs locked to someone else up front (would never succeed).
    const myKey = p2pkPubkey(getPubFromSk(skHex));
    for (const p of inputs) {
      let keys = [];
      try {
        keys = getP2PKExpectedWitnessPubkeys(p.secret);
      } catch {
        continue; // not P2PK: plain bearer proof
      }
      if (keys.length && !keys.some((k) => k.slice(-64) === myKey.slice(-64))) {
        return putRecord(INBOX, id, { state: "FAILED", error: "Locked to a different key" });
      }
    }
    const preview = await wallet.prepareSwapToReceive(
      { mint: rec.mint, unit: "sat", proofs: inputs },
      { privkey: skHex }
    );
    const outs = [...(preview.keepOutputs || []), ...(preview.sendOutputs || [])];
    rec = putRecord(INBOX, id, {
      outputs: serializeOutputs(outs),
      keysetId: preview.keysetId,
      amountAfterFees: preview.amount,
      fees: preview.fees,
      state: "SWAPPING",
    });
  }

  const outputData = deserializeOutputs(rec.outputs);
  const preview = {
    amount: rec.amountAfterFees,
    fees: rec.fees || 0,
    keysetId: rec.keysetId,
    inputs,
    keepOutputs: outputData,
    sendOutputs: [],
  };

  let proofs = [];
  try {
    const res = await wallet.completeSwap(preview, skHex);
    proofs = [...(res.keep || []), ...(res.send || [])];
  } catch (e) {
    // NUT-07 only decides what to do next; it never counts as payment.
    let states = [];
    try {
      states = await wallet.checkProofsStates(inputs);
    } catch {
      return putRecord(INBOX, id, { error: errMsg(e) }); // mint unreachable: retry later
    }
    if (states.some((s) => s.state === "SPENT")) {
      // Either our swap went through and the reply was lost, or someone
      // else spent the token first. NUT-09 tells the two apart.
      proofs = await restoreFromOutputs(wallet, outputData);
      if (!proofs.length) {
        return putRecord(INBOX, id, { state: "FAILED", error: "Token was already spent by someone else" });
      }
    } else {
      return putRecord(INBOX, id, { error: errMsg(e) }); // unspent/pending: retry later
    }
  }

  // Proofs into the wallet first, then mark the record. If we crash in
  // between, the next attempt recovers the same proofs via NUT-09 and the
  // wallet de-duplicates them by secret.
  addProofsToWallet(walletMintKey(rec.mint), proofs);
  rememberMint(rec.mint);
  return putRecord(INBOX, id, {
    state: "RECEIVED",
    amount: sumProofs(proofs),
    receivedAt: Date.now(),
    error: null,
  });
}

export async function claimAll(skHex) {
  const open = listRecords(INBOX).filter((r) => r.state === "NEW" || r.state === "SWAPPING");
  for (const r of open) {
    try {
      await claimRecord(r.id, skHex);
    } catch (e) {
      putRecord(INBOX, r.id, { error: errMsg(e) });
    }
  }
}

// lazy import keeps nostr-tools/pure out of this module's top level API
import { getPublicKey } from "nostr-tools/pure";
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));
function getPubFromSk(skHex) {
  return getPublicKey(fromHex(skHex));
}
