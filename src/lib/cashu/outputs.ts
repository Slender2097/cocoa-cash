// src/lib/cashu/outputs.ts
// Persistable blinding data + NUT-09 restore + a cached Wallet per mint.
//
// Recovery discipline: before any request that makes the mint sign our
// blinded messages (NUT-04 mint, NUT-03 swap, NUT-05/NUT-08 melt change), the
// blinding data is written to disk. If the reply is lost, NUT-09 restore
// returns the signatures for those same blinded messages and we unblind them
// locally. Nothing is re-signed, so nothing can be double-counted.
// MIT License

import { Amount, CallerAbortError, Mint, NetworkError, OutputData, UncancellableReadError, Wallet } from "@cashu/cashu-ts";
import type { OutputDataLike, Proof, RequestFn, SerializedBlindedMessage } from "@cashu/cashu-ts";
import { normalizeMint } from "./storage";
import { counterSource, currentSeed } from "./seed";

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

// Keyed by phrase + mint URL (walletKey), so a phrase change gets a new Wallet.
const wallets = new Map<string, Promise<Wallet>>();
// Wallets that have finished loading (info, keysets and keys in memory).
const loaded = new Set<string>();
// The request function each mint's Wallet uses (see mintRequest below), so a
// single call can reuse it with a patched reply (patchedMintRequest).
const requests = new Map<string, RequestFn>();
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

// Requests to one mint go out one at a time. cashu-ts sends a mint several
// requests at once (connecting fires /v1/info, /v1/keysets and /v1/keys
// together), and a mint's front proxy may refuse a request that arrives while
// another from the same client is still open (nginx limit_req/limit_conn, for
// example). The proxy's refusal carries no CORS headers, so the browser only
// reports "Load failed" (Safari) or "Failed to fetch". In a queue, each request
// waits for the one before it, but never longer than LANE_WAIT_MS, so a slow
// call (a melt waiting on Lightning) does not hold the others up for long.
const LANE_WAIT_MS = 8_000;
const lanes = new Map<string, Promise<void>>();

// A GET that fails quickly at the network level is tried again after these
// pauses. GETs only read (info, keys, quote state), so repeating one is safe;
// POSTs are never repeated here (cashu-ts retries the NUT-19 ones itself). A
// GET that hung for longer than QUICK_FAIL_MS is not repeated, so a dead
// connection does not cost the wait several times over.
const GET_RETRY_MS = [400, 1_200];
const QUICK_FAIL_MS = 10_000;

// A GET is aborted after GET_TIMEOUT_MS instead of cashu-ts's default of 300 s,
// so a mint that never answers (a TLS handshake that stalls, for example) shows
// its error within seconds. GETs only fetch small JSON (info, keys, quote
// state). POSTs keep cashu-ts's timeout, except a melt and a mint quote (below).
const GET_TIMEOUT_MS = 20_000;

// A melt (POST /v1/melt/bolt11) waits on Lightning, so it gets longer than a
// GET. But cashu-ts allows 300 s per try, and on a mint with NUT-19 a try that
// times out is sent again, up to 9 more times: a melt that stalled kept the page
// on "Paying..." for 5 minutes or more. After MELT_WAIT_MS in all, retries
// included, this tab stops waiting. The journal keeps the inputs reserved and
// settles the melt from the mint's quote state (NUT-05), with the change from
// NUT-08 or NUT-09. It refunds only once the mint says the quote is UNPAID and
// NUT-07 says the inputs are unspent.
const MELT_WAIT_MS = 45_000;
const isMelt = (endpoint: string, method?: string) =>
  method?.toUpperCase() === "POST" && /\/v1\/melt\/[a-z0-9_-]+$/i.test(endpoint);

// Creating a mint quote (POST /v1/mint/quote/bolt11) only asks the mint for an
// invoice, but it kept cashu-ts's 300 s timeout, so "Create invoice" could spin
// for minutes on a stalled mint. Like a melt, it is aborted after
// MINT_QUOTE_WAIT_MS in all, retries included. Nothing is journaled until the
// quote arrives, so there is nothing to recover.
const MINT_QUOTE_WAIT_MS = 30_000;
const isMintQuote = (endpoint: string, method?: string) =>
  method?.toUpperCase() === "POST" && /\/v1\/mint\/quote\/[a-z0-9_-]+$/i.test(endpoint);

/** An AbortSignal that fires after `ms`, or as soon as `upstream` fires. */
function deadline(upstream: AbortSignal | null | undefined, ms: number) {
  const ctl = new AbortController();
  let expired = false;
  const timer = setTimeout(() => {
    expired = true;
    ctl.abort();
  }, ms);
  const onAbort = () => ctl.abort();
  if (upstream?.aborted) ctl.abort();
  else upstream?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: ctl.signal,
    expired: () => expired,
    clear: () => {
      clearTimeout(timer);
      upstream?.removeEventListener("abort", onAbort);
    },
  };
}

const pause = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** Resolves when `p` settles or after `ms`, whichever comes first. */
const settledOrAfter = (p: Promise<void>, ms: number) =>
  new Promise<void>((done) => {
    const t = setTimeout(done, ms);
    p.then(() => {
      clearTimeout(t);
      done();
    });
  });

/** The request never got an answer the page may read (no abort, no timeout on a body read). */
const lostInTransit = (e: unknown): e is NetworkError =>
  e instanceof NetworkError && !(e instanceof CallerAbortError) && !(e instanceof UncancellableReadError);

/**
 * The request function every call to one mint goes through. It changes
 * transport only, never what is sent:
 * - Every endpoint must sit under the mint's full URL, path included
 *   ("https://mint.minibits.cash/Bitcoin/v1/keys"). One that lost the path is
 *   put back under it rather than sent to the bare host.
 * - One request at a time per mint, and a GET lost in transit is tried again
 *   (see above).
 * - cashu-ts names only the host when a request fails ("Load failed at
 *   https://mint.minibits.cash"), which reads as if the path was dropped. The
 *   error says which URL failed, and after how many tries.
 * - GETs to a mint with a path ("https://mint.minibits.cash/Bitcoin") use the
 *   browser's default cache mode instead of cashu-ts's "no-store", so the
 *   browser adds no Cache-Control / Pragma request headers to them. Mints send
 *   no caching headers (no Cache-Control, Expires, ETag or Last-Modified), so
 *   the browser still fetches every GET fresh.
 * - A GET waits at most GET_TIMEOUT_MS per try, a melt MELT_WAIT_MS in all,
 *   and a mint quote MINT_QUOTE_WAIT_MS in all (see above).
 */
function mintRequest(base: string, request: RequestFn): RequestFn {
  const prefix = base + "/";
  const { origin, pathname } = new URL(base);
  const plainGets = pathname !== "/";
  return (async (args: Parameters<RequestFn>[0]) => {
    let endpoint = args.endpoint;
    if (!endpoint.startsWith(prefix)) {
      const rest = endpoint.startsWith(origin) ? endpoint.slice(origin.length) : endpoint;
      endpoint = prefix + rest.replace(/^\/+/, "");
      console.warn(`[cocoa] mint request outside ${base}: ${args.endpoint} -> ${endpoint}`);
    }
    const get = !args.requestBody && (!args.method || args.method.toUpperCase() === "GET");
    const req = get
      ? {
          ...args,
          endpoint,
          requestTimeout: Math.min(args.requestTimeout ?? GET_TIMEOUT_MS, GET_TIMEOUT_MS),
          ...(plainGets ? { cache: "default" as const } : {}),
        }
      : { ...args, endpoint };
    const melt = isMelt(endpoint, args.method);
    const waitMs = melt ? MELT_WAIT_MS : isMintQuote(endpoint, args.method) ? MINT_QUOTE_WAIT_MS : 0;

    const before = lanes.get(base) ?? Promise.resolve();
    const run = (async () => {
      await settledOrAfter(before, LANE_WAIT_MS);
      // The limit starts when the request is sent, not while it waits in the lane.
      const limit = waitMs ? deadline(args.signal, waitMs) : null;
      const send = limit ? { ...req, signal: limit.signal } : req;
      try {
        for (let tries = 1; ; tries++) {
          const sent = Date.now();
          try {
            return await request(send);
          } catch (e) {
            if (limit?.expired()) {
              throw new NetworkError(`No answer from the mint within ${waitMs / 1000} s at ${endpoint}`, { cause: e });
            }
            if (!lostInTransit(e)) throw e;
            const quick = Date.now() - sent < QUICK_FAIL_MS;
            if (get && quick && tries <= GET_RETRY_MS.length && !args.signal?.aborted) {
              if (dev) console.debug(`[cocoa] ${endpoint}: ${e.message}; trying again`);
              await pause(GET_RETRY_MS[tries - 1]);
              continue;
            }
            const what = e.message.replace(/ at https?:\/\/\S+$/, "");
            throw new NetworkError(`${what} at ${endpoint}${tries > 1 ? ` (tried ${tries} times)` : ""}`, { cause: e });
          }
        }
      } finally {
        limit?.clear();
      }
    })();
    const done = run.then(
      () => {},
      () => {}
    );
    lanes.set(base, done);
    done.then(() => {
      if (lanes.get(base) === done) lanes.delete(base);
    });
    return run;
  }) as RequestFn;
}

const walletKey = (url: string) => `${currentSeed().fp}|${url}`;

/**
 * One loaded Wallet per mint URL (sat unit) and phrase. Deterministic secrets
 * (NUT-13): the Wallet gets the phrase's BIP39 seed and a counter source that
 * saves each reservation to localStorage (./seed.ts). Proofs with random
 * secrets from before this still spend: spending never looks at the seed.
 */
export function getWallet(mintUrl: string): Promise<Wallet> {
  const url = normalizeMint(mintUrl);
  // The phrase is read (and created if missing) before the Wallet exists.
  const { seed, fp } = currentSeed();
  const key = `${fp}|${url}`;
  let w = wallets.get(key);
  if (!w) {
    // The URL cashu-ts gets is the mint's full URL, path kept, no trailing slash.
    if (!url || url.endsWith("/")) throw new Error(`Bad mint URL: ${mintUrl}`);
    // One request function per mint URL, shared by its Wallets (one queue per mint).
    let request = requests.get(url);
    const lib = request ? null : defaultRequest();
    if (lib) requests.set(url, (request = mintRequest(url, lib)));
    const mint = new Mint(url, request ? { customRequest: request } : undefined);
    if (mint.mintUrl !== url) console.warn(`[cocoa] cashu-ts changed the mint URL: ${url} -> ${mint.mintUrl}`);
    if (dev) console.debug(`[cocoa] new Wallet(${mint.mintUrl}).loadMint()`);
    const wallet = new Wallet(mint, { unit: "sat", bip39seed: seed, counterSource: counterSource(url, fp) });
    w = wallet.loadMint().then(() => {
      loaded.add(key);
      return wallet;
    });
    w.catch(() => wallets.delete(key));
    wallets.set(key, w);
  }
  return w;
}

/** True once this mint's Wallet has loaded. Never waits and sends nothing. */
export const walletLoaded = (mintUrl: string): boolean => loaded.has(walletKey(normalizeMint(mintUrl)));

/**
 * The mint's own request function (same queue, timeouts and URL handling), with
 * `patch` applied to the JSON reply before cashu-ts parses it. Undefined when
 * this cashu-ts version does not expose its request function: the caller then
 * gets cashu-ts's default.
 */
export function patchedMintRequest(mintUrl: string, patch: (res: Record<string, unknown>) => Record<string, unknown>): RequestFn | undefined {
  const request = requests.get(normalizeMint(mintUrl));
  if (!request) return undefined;
  return (async (args: Parameters<RequestFn>[0]) => {
    const res = await request(args);
    return res && typeof res === "object" && !Array.isArray(res) ? patch(res as Record<string, unknown>) : res;
  }) as RequestFn;
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
