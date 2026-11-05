// src/lib/tip/nut18.ts
// NUT-18 payment requests over the nostr transport.
//
// NUT-18 defines the request (creqA...) and the payload a sender delivers:
//   { id?, memo?, mint, unit, proofs }
// With the nostr transport (`t: "nostr"`, tag ["n","17"]) the payload JSON is
// the content of a NIP-17 private direct message (kind 14 rumor, sealed and
// gift-wrapped per NIP-59) sent to the pubkey in the request's nprofile.
// Nothing here is custom: the iframe and the creator's admin page are just a
// NUT-18 sender and a NUT-18 receiver.
// MIT License

import { PaymentRequest, PaymentRequestTransportType } from "@cashu/cashu-ts";
import type { ProofLike } from "@cashu/cashu-ts";
import { SimplePool } from "nostr-tools/pool";
import * as nip17 from "nostr-tools/nip17";
import * as nip19 from "nostr-tools/nip19";
import { generateSecretKey, getPublicKey } from "nostr-tools/pure";
import type { NostrEvent } from "nostr-tools/pure";

/** NUT-18 payload. */
export type Nut18Payload = { id?: string; memo?: string; mint: string; unit: string; proofs: ProofLike[] };

let pool: SimplePool | null = null;
const getPool = () => (pool ||= new SimplePool());

/** NUT-18 request string (creqA) for "pay with any Cashu wallet". */
export function buildPaymentRequest({
  pubkey,
  relays,
  mints,
  amount,
  description,
}: {
  pubkey: string;
  relays: string[];
  mints: string[];
  amount?: number;
  description?: string;
}): string {
  const nprofile = nip19.nprofileEncode({ pubkey, relays });
  const transport = [
    { type: PaymentRequestTransportType.NOSTR, target: nprofile, tags: [["n", "17"]] },
  ];
  const req = new PaymentRequest(
    transport,
    undefined, // no id: the request is reusable
    amount || undefined,
    "sat",
    mints,
    description,
    false // not single use
  );
  return req.toEncodedCreqA();
}

/**
 * Build (but do not publish) the NIP-17 gift wrap carrying a NUT-18 payload.
 * A fresh ephemeral sender key is used, so the visitor has no identity.
 * The signed event is stored by the caller before publishing, so a retry
 * republishes the exact same event and the receiver can de-duplicate by id.
 */
export function wrapPayload(recipientPubkey: string, payload: Nut18Payload): NostrEvent {
  const sk = generateSecretKey();
  return nip17.wrapEvent(sk, { publicKey: recipientPubkey }, JSON.stringify(payload));
}

export async function publishWrap(wrap: NostrEvent, relays: string[]): Promise<number> {
  const results = await Promise.allSettled(getPool().publish(relays, wrap, { maxWait: 8000 }));
  const ok = results.filter((r) => r.status === "fulfilled").length;
  if (!ok) throw new Error("No relay accepted the message. Check your connection and retry.");
  return ok;
}

/**
 * Fetch every NUT-18 payload sent to `sk` on `relays`. Gift wraps carry a
 * randomised created_at (NIP-59), so no `since` filter is used.
 * Returns [{ id, createdAt, payload }] where id is the gift wrap event id.
 */
export async function fetchPayloads(
  sk: Uint8Array,
  relays: string[]
): Promise<Array<{ id: string; createdAt: number; payload: Nut18Payload }>> {
  const pk = getPublicKey(sk);
  const events = await getPool().querySync(relays, { kinds: [1059], "#p": [pk] }, { maxWait: 8000 });
  const out: Array<{ id: string; createdAt: number; payload: Nut18Payload }> = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    try {
      const rumor = nip17.unwrapEvent(ev, sk);
      if (rumor.kind !== 14) continue;
      const payload = JSON.parse(rumor.content) as Nut18Payload;
      if (!payload || !Array.isArray(payload.proofs) || !payload.mint) continue;
      out.push({ id: ev.id, createdAt: rumor.created_at * 1000, payload });
    } catch {
      // not for us, not NIP-17, or not a NUT-18 payload: ignore
    }
  }
  return out;
}

export { generateSecretKey, getPublicKey };
export const npubEncode = (hex: string) => nip19.npubEncode(hex);
export const nsecEncode = (sk: Uint8Array) => nip19.nsecEncode(sk);
export function nsecDecode(nsec: string): Uint8Array {
  const d = nip19.decode(String(nsec).trim());
  if (d.type !== "nsec") throw new Error("Not an nsec");
  return d.data;
}
