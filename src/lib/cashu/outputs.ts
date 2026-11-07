// src/lib/cashu/outputs.ts
// Persistable blinding data + NUT-09 restore + a cached Wallet per mint.
//
// Recovery discipline: before any request that makes the mint sign our
// blinded messages (NUT-04 mint, NUT-03 swap, NUT-05/NUT-08 melt change), the
// blinding data is written to disk. If the reply is lost, NUT-09 restore
// returns the signatures for those same blinded messages and we unblind them
// locally. Nothing is re-signed, so nothing can be double-counted.
// MIT License

import { Amount, Mint, NetworkError, OutputData, Wallet } from "@cashu/cashu-ts";
import type { OutputDataLike, Proof, RequestFn, SerializedBlindedMessage } from "@cashu/cashu-ts";
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
const dev = process.env.NODE_ENV !== "production";

// cashu-ts's own request function. It is not exported, so take it from a Mint
// built without a custom one; null if a future version moves it.
let libRequest: RequestFn | null | undefined;
const defaultRequest = (): RequestFn | null => {
  if (libRequest === undefined) {
    const r = (new Mint("https://mint.invalid") as unknown as { _request?: unknown })._request;
    libRequest = typeof r === "function" ? (r as RequestFn) : null;
  }
  return libRequest;
};

// Mints whose GETs only load with the browser's default cache mode (see below).
const plainGetMints = new Set<string>();

/**
 * The request function every call to one mint goes through. It changes
 * transport only, never what is sent:
 * - Every endpoint must sit under the mint's full URL, path included
 *   ("https://mint.minibits.cash/Bitcoin/v1/keys"). One that lost the path is
 *   put back under it rather than sent to the bare host.
 * - cashu-ts fetches with cache: "no-store". Safari turns that into
 *   Cache-Control and Pragma request headers, which makes even a plain GET
 *   need a CORS preflight; a mint whose server does not allow those headers
 *   then fails with "Load failed" in Safari only. When a GET fails at the
 *   network level it is tried once more with the default cache mode (no extra
 *   headers), and that mint keeps using it. POSTs are never retried here.
 */
function mintRequest(base: string, request: RequestFn): RequestFn {
  const prefix = base + "/";
  const origin = new URL(base).origin;
  return (async (args: Parameters<RequestFn>[0]) => {
    let endpoint = args.endpoint;
    if (!endpoint.startsWith(prefix)) {
      const rest = endpoint.startsWith(origin) ? endpoint.slice(origin.length) : endpoint;
      endpoint = prefix + rest.replace(/^\/+/, "");
      console.warn(`[cocoa] mint request outside ${base}: ${args.endpoint} -> ${endpoint}`);
    }
    const get = !args.requestBody && (!args.method || args.method.toUpperCase() === "GET");
    if (get && plainGetMints.has(base)) return request({ ...args, endpoint, cache: "default" });
    try {
      return await request({ ...args, endpoint });
    } catch (e) {
      if (!get || !(e instanceof NetworkError) || args.signal?.aborted) throw e;
      try {
        const out = await request({ ...args, endpoint, cache: "default" });
        plainGetMints.add(base);
        if (dev) console.debug(`[cocoa] ${base}: GETs use the default cache mode`);
        return out;
      } catch {
        throw e;
      }
    }
  }) as RequestFn;
}

/** One loaded Wallet per mint URL (sat unit). */
export function getWallet(mintUrl: string): Promise<Wallet> {
  const url = normalizeMint(mintUrl);
  let w = wallets.get(url);
  if (!w) {
    // The URL cashu-ts gets is the mint's full URL, path kept, no trailing slash.
    if (!url || url.endsWith("/")) throw new Error(`Bad mint URL: ${mintUrl}`);
    const request = defaultRequest();
    const mint = new Mint(url, request ? { customRequest: mintRequest(url, request) } : undefined);
    if (mint.mintUrl !== url) console.warn(`[cocoa] cashu-ts changed the mint URL: ${url} -> ${mint.mintUrl}`);
    if (dev) console.debug(`[cocoa] new Wallet(${mint.mintUrl}).loadMint()`);
    const wallet = new Wallet(mint, { unit: "sat" });
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
