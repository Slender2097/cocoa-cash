// src/lib/cashu/outputs.ts
// Persistable blinding data + NUT-09 restore + a cached Wallet per mint.
//
// Recovery discipline: before any request that makes the mint sign our
// blinded messages (NUT-04 mint, NUT-03 swap, NUT-05/NUT-08 melt change), the
// blinding data is written to disk. If the reply is lost, NUT-09 restore
// returns the signatures for those same blinded messages and we unblind them
// locally. Nothing is re-signed, so nothing can be double-counted.
// MIT License

import { Amount, OutputData, Wallet } from "@cashu/cashu-ts";
import type { OutputDataLike, Proof, SerializedBlindedMessage } from "@cashu/cashu-ts";
import { normalizeMint } from "./storage";

export type SerializedOutput = {
  B: { amount: number; B_: string; id: string };
  r: string; // blinding factor, hex
  s: string; // secret bytes, hex
  e?: string; // P2BK ephemeral key, if the output used one
};

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
export const fromHex = (hex: string) => new Uint8Array((hex.match(/.{2}/g) || []).map((h) => parseInt(h, 16)));
export { toHex };

export function serializeOutputs(outputData: OutputDataLike[] = []): SerializedOutput[] {
  return outputData.map((o) => {
    const od = o as OutputData;
    return {
      B: { amount: Amount.from(od.blindedMessage.amount).toNumber(), B_: od.blindedMessage.B_, id: od.blindedMessage.id },
      r: od.blindingFactor.toString(16),
      s: toHex(od.secret),
      ...(od.ephemeralE ? { e: od.ephemeralE } : {}),
    };
  });
}

export function deserializeOutputs(list: SerializedOutput[] = []): OutputData[] {
  return list.map(
    (o) =>
      new OutputData(
        { amount: Amount.from(o.B.amount), B_: o.B.B_, id: o.B.id } as SerializedBlindedMessage,
        BigInt("0x" + o.r),
        fromHex(o.s),
        o.e
      )
  );
}

const wallets = new Map<string, Promise<Wallet>>();

/** One loaded Wallet per mint URL (sat unit). */
export function getWallet(mintUrl: string): Promise<Wallet> {
  const url = normalizeMint(mintUrl);
  let w = wallets.get(url);
  if (!w) {
    const wallet = new Wallet(url, { unit: "sat" });
    w = wallet.loadMint().then(() => wallet);
    w.catch(() => wallets.delete(url));
    wallets.set(url, w);
  }
  return w;
}

/**
 * NUT-09 restore for a known set of outputs. Returns the proofs the mint had
 * already signed for them (possibly none).
 */
export async function restoreOutputs(wallet: Wallet, outputData: OutputData[]): Promise<Proof[]> {
  if (!outputData.length) return [];
  const res = await wallet.mint.restore({ outputs: outputData.map((o) => o.blindedMessage) });
  const proofs: Proof[] = [];
  (res.outputs || []).forEach((out, i) => {
    const od = outputData.find((d) => d.blindedMessage.B_ === out.B_);
    const sig = res.signatures?.[i];
    if (!od || !sig) return;
    proofs.push(od.toProof(sig, wallet.getKeyset(sig.id)));
  });
  return proofs;
}

export const errText = (e: unknown): string =>
  (e instanceof Error ? e.message : e ? String(e) : "") || "Unknown error";
