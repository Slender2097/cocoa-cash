// src/lib/tip/config.ts
// Tip-embed configuration: query params, the creator's mint allowlist, URL helpers.
// MIT License

import * as nip19 from "nostr-tools/nip19";
import { normalizeMint, walletMintKey } from "@/lib/cashu/storage";

export { normalizeMint, walletMintKey };

// Nostr relays used for the NUT-18 nostr transport (NIP-17 DMs) when the
// creator does not pick their own.
export const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];

// Accepts npub1..., nprofile1... or 64-char hex. Returns x-only hex pubkey.
export function parsePubkey(input: unknown): string {
  const v = String(input || "").trim();
  if (/^[0-9a-f]{64}$/i.test(v)) return v.toLowerCase();
  const decoded = nip19.decode(v);
  if (decoded.type === "npub") return decoded.data;
  if (decoded.type === "nprofile") return decoded.data.pubkey;
  throw new Error("Not an npub");
}

// NUT-11 P2PK expects a compressed SEC1 key. Nostr keys are x-only BIP-340
// keys; Schnorr signatures only depend on the x coordinate, so "02" + x works.
export const p2pkPubkey = (xonlyHex: string) => "02" + xonlyHex;

/**
 * Parse the embed params. Same names for the iframe query string and the
 * script tag's data-* attributes:
 *   mint   – one mint URL, or several separated by commas (allowlist; first is used for Lightning)
 *   amount – sats, or "any" / empty to let the visitor choose
 *   npub   – the creator's receiving key (generated on /creator)
 *   relays – optional, comma separated wss:// URLs
 *   label  – optional button text, e.g. "Donate"
 */
export type TipParams = {
  mints: string[];
  amount: number | null;
  pubkey: string | null;
  relays: string[];
  customRelays: boolean;
  label: string;
  error: string | null;
};

export function parseTipParams(query: Record<string, string | string[] | undefined>): TipParams {
  const get = (k: string): string => {
    const v = query?.[k];
    return Array.isArray(v) ? v.join(",") : v || "";
  };
  const mints = get("mint")
    .split(",")
    .map(normalizeMint)
    .filter(Boolean);
  const rawAmount = get("amount").trim().toLowerCase();
  const amount = rawAmount && rawAmount !== "any" ? parseInt(rawAmount, 10) : null;
  const relays = get("relays")
    .split(",")
    .map((r) => r.trim())
    .filter((r) => /^wss?:\/\//.test(r));
  const label = get("label").slice(0, 24) || "Tip";

  let pubkey: string | null = null;
  let error: string | null = null;
  try {
    pubkey = parsePubkey(get("npub"));
  } catch {
    error = "Missing or invalid npub";
  }
  if (!mints.length) error = "Missing mint";
  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) error = "Invalid amount";

  return {
    mints,
    amount,
    pubkey,
    relays: relays.length ? relays : DEFAULT_RELAYS,
    customRelays: relays.length > 0,
    label,
    error,
  };
}

export function buildEmbed({
  origin,
  mints,
  amount,
  npub,
  relays,
  label,
}: {
  origin: string;
  mints: string[];
  amount: number | null;
  npub: string;
  relays?: string[];
  label?: string;
}) {
  const params = new URLSearchParams();
  params.set("mint", mints.map(normalizeMint).join(","));
  params.set("amount", amount ? String(amount) : "any");
  params.set("npub", npub);
  if (relays?.length) params.set("relays", relays.join(","));
  if (label && label !== "Tip") params.set("label", label);
  const url = `${origin}/tip?${params.toString()}`;

  const attrs = [
    `src="${origin}/tip.js"`,
    `data-mint="${mints.map(normalizeMint).join(",")}"`,
    `data-amount="${amount ? amount : "any"}"`,
    `data-npub="${npub}"`,
  ];
  if (relays?.length) attrs.push(`data-relays="${relays.join(",")}"`);
  if (label && label !== "Tip") attrs.push(`data-label="${label}"`);
  const script = `<script ${attrs.join(" ")}></script>`;
  const iframe = `<iframe src="${url}" width="360" height="560" style="border:0;border-radius:16px" allow="clipboard-write; camera" title="Cashu tip"></iframe>`;
  return { url, script, iframe };
}
