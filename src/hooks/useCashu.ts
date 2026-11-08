// src/hooks/useCashu.ts
// MIT License
// Copyright (c) 2026 Jose2097
//
// Full-wallet actions (Mint, Melt, Send, Claim) for the cocoa.cash home page.
// Every action goes through the write-ahead journal in src/lib/cashu/journal.ts:
// blinding data and spent inputs are persisted before each mint call, and lost
// replies are recovered with NUT-09. This replaces the old in-memory flows,
// which could lose funds on a dropped reply or a closed tab.

import { useCallback, useEffect, useRef, useState } from "react";
import { Amount, getTokenMetadata } from "@cashu/cashu-ts";
import type { MeltQuoteBolt11Response } from "@cashu/cashu-ts";
import useProofStorage from "./useProofStorage";
import type { ProofStorage } from "./useProofStorage";
import { getWallet, walletLoaded, errText } from "@/lib/cashu/outputs";
import { normalizeMint, isSavedMint, rememberMint, amountToNumber } from "@/lib/cashu/storage";
import {
  startMint,
  quoteMelt,
  startMelt,
  startSend,
  startReceive,
  dropSpentProofs,
  recoverOpen,
  openOps,
  mintsWithOpenOps,
  getOp,
  importLegacyPendingMints,
} from "@/lib/cashu/journal";
import type { MintOp, MeltOp } from "@/lib/cashu/journal";

export type DataOutput = {
  status?: string;
  error?: string;
  details?: string;
  message?: string;
  success?: string;
  type?: "mint" | "melt-quote" | "melt" | "swap-send" | "claim-check" | "swap-claim";
  /** claim-check: the token's mint, which is not in the user's mints list. */
  mint?: string;
  amount?: number;
  invoice?: string;
  quoteId?: string;
  token?: string;
  keysId?: string;
  receivedProofs?: number;
  receivedCount?: number;
  /** Sats in a claimed token that the mint already reported spent (skipped). */
  spent?: number;
  preimage?: string;
  feeReserve?: number;
  changeReceived?: number;
  estimatedNewBalance?: number;
} | null;

export type UseCashu = {
  walletReady: boolean;
  isProcessing: boolean;
  dataOutput: DataOutput;
  balance: number;
  activeMint: string;
  hydrated: boolean;
  handleSetMint: (url: string, opts?: { silent?: boolean }) => Promise<void>;
  handleMint: (amount: string | number) => Promise<void>;
  /** NUT-05 step 1: quote only. The result (type "melt-quote") carries amount and fee reserve to confirm. */
  handleMeltQuote: (invoice: string) => Promise<void>;
  /** NUT-05 step 2: pay a quote the user confirmed. */
  handleMelt: (quoteId: string) => Promise<void>;
  handleSwapSend: (amount: string | number) => Promise<void>;
  /** Claim a token. A mint not in savedMints first returns a "claim-check" result to confirm with { trustMint: true }. */
  handleSwapClaim: (token: string, opts?: { trustMint?: boolean }) => Promise<void>;
  setDataOutput: (d: DataOutput) => void;
  /** The single proof-storage instance. Pages must use this one. */
  storage: ProofStorage;
};

/** The result shown for a melt the mint has paid. */
const meltPaid = (op: MeltOp): NonNullable<DataOutput> => ({
  status: "Success ✓",
  type: "melt",
  success: `Paid ${op.amount} sats successfully!`,
  preimage: op.preimage || "N/A",
  amount: op.amount,
  feeReserve: op.feeReserve,
  changeReceived: op.change || 0,
});

/** Start loading a mint's Wallet without waiting for it (getWallet keeps the one load in flight). */
const loadInBackground = (mint: string) => {
  try {
    getWallet(mint).catch(() => {});
  } catch {
    // not a usable mint URL: nothing to load
  }
};

export default function useCashu(): UseCashu {
  const storage = useProofStorage();
  const { balance, activeMint, switchMint, hydrated } = storage;
  const [walletReady, setWalletReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataOutput, setDataOutput] = useState<DataOutput>(null);
  const busy = useRef(false);
  useEffect(() => {
    busy.current = isProcessing;
  }, [isProcessing]);
  // Melts this tab stopped waiting for ("Payment pending"). The ticker below
  // says how each one ended once the journal has settled it.
  const pendingMelts = useRef(new Set<string>());

  const handleSetMint = useCallback(
    async (input: string, opts: { silent?: boolean } = {}) => {
      const url = normalizeMint(input || "");
      if (!url) return setDataOutput({ error: "Enter a mint URL" });
      try {
        const wallet = await getWallet(url);
        switchMint(url);
        setWalletReady(true);
        importLegacyPendingMints();
        recoverOpen(url).catch(() => {});
        if (!opts.silent) {
          setDataOutput({ status: "Mint connected ", keysId: wallet.keysetId });
        }
      } catch (error) {
        setWalletReady(false);
        if (!opts.silent) {
          // A wrong path (often just the wrong letter case) answers with a 4xx.
          const hasPath = /^https?:\/\/[^/]+\/./i.test(url);
          const hint = hasPath ? " Check the URL: the part after the domain is case-sensitive." : "";
          // Name the mint's full URL, unless the error already names a URL under it.
          const text = errText(error);
          setDataOutput({ error: "Connection failed", details: `${text.includes(url) ? text : `${text} (${url})`}${hint}` });
        }
      }
    },
    [switchMint]
  );

  // Reconnect the last mint on load, so unfinished operations get recovered.
  // The last mint shows as active at once: loading its info and keys takes a
  // few serialized GETs (seconds on a phone), and the balance is already known
  // from the proofs on disk. Every action awaits that same load (getWallet
  // caches the promise), so nothing reaches the mint before it is ready. If
  // the load fails, the mint shows as not connected and is retried below.
  const autoConnected = useRef(false);
  useEffect(() => {
    if (!hydrated || autoConnected.current || !activeMint) return;
    autoConnected.current = true;
    setWalletReady(true); // optimistic until the load settles
    handleSetMint(activeMint, { silent: true });
  }, [hydrated, activeMint, handleSetMint]);

  // Drive open operations (unpaid invoices, pending melts...) while the page is
  // open: poll each unpaid NUT-04 quote until the mint says PAID, then mint the
  // proofs into this browser at once. Runs for every mint with open operations,
  // even while the active mint is not connected (getWallet retries the
  // connection), and right away when the page comes back into view, since
  // browsers slow timers down in background tabs.
  const walletReadyRef = useRef(walletReady);
  useEffect(() => {
    walletReadyRef.current = walletReady;
  }, [walletReady]);
  const kick = useRef<() => void>(() => {});
  useEffect(() => {
    if (!hydrated) return;
    let stopped = false;
    let running = false;
    let lastConnect = Date.now(); // the connect on load (above) counts as the first try
    const reportMelts = () => {
      if (busy.current) return; // after the action that is running now
      for (const id of pendingMelts.current) {
        const op = getOp(id);
        if (op?.kind !== "melt") {
          pendingMelts.current.delete(id);
          continue;
        }
        if (op.state !== "DONE" && op.state !== "FAILED") continue;
        pendingMelts.current.delete(id);
        setDataOutput(
          op.state === "DONE" ? meltPaid(op) : { error: "Melt failed", details: "The mint could not pay the invoice. Your sats are back." }
        );
      }
    };
    const tick = async () => {
      if (stopped || running) return;
      // The last mint did not connect on load: try again now and then, so its operations can resume.
      if (activeMint && !walletReadyRef.current && Date.now() - lastConnect > 15_000) {
        lastConnect = Date.now();
        handleSetMint(activeMint, { silent: true });
      }
      const mints = mintsWithOpenOps();
      if (mints.length) {
        running = true;
        try {
          const watching = openOps().filter((o) => o.kind === "mint").map((o) => o.id);
          for (const mint of mints) {
            if (stopped) return;
            if (!walletLoaded(mint)) {
              // Load the mint first, without the wallet lock. A mint that does not
              // answer takes the full 20 s GET timeout per try, and holding the
              // lock that long made Pay, Send and Claim wait behind it. Its
              // operations run on the first round after it has loaded.
              loadInBackground(mint);
              continue;
            }
            // Only runs while this tab can take the wallet lock; otherwise wait for the next tick.
            await recoverOpen(mint, undefined, { background: true }).catch(() => {});
          }
          if (stopped) return;
          for (const id of watching) {
            const op = getOp(id) as MintOp | null;
            if (op?.state === "DONE" && !busy.current) {
              setDataOutput({ status: "Mint successful ✓", type: "mint", amount: op.amount, receivedProofs: 1 });
            }
          }
        } finally {
          running = false;
        }
      }
      reportMelts();
    };
    kick.current = () => void tick();
    const t = setInterval(tick, 3000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Back in view: a mint that did not connect (often a request cut off
      // while the tab was in the background) is tried again now, not in 15 s.
      lastConnect = 0;
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    void tick();
    return () => {
      stopped = true;
      kick.current = () => {};
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [hydrated, activeMint, handleSetMint]);

  const guard = (): boolean => {
    if (!walletReady || !activeMint) {
      setDataOutput({ error: "Wallet or mint not ready" });
      return false;
    }
    return true;
  };

  const handleMint = async (amountInput: string | number) => {
    const amount = parseInt(String(amountInput), 10);
    if (isNaN(amount) || amount <= 0) return setDataOutput({ error: "Enter amount > 0" });
    if (!guard()) return;
    setIsProcessing(true);
    try {
      const op = await startMint(activeMint, amount); // NUT-04 quote, journaled first
      setDataOutput({ status: "Invoice created", invoice: op.invoice, quoteId: op.id });
      setTimeout(() => kick.current(), 1500); // start polling the new quote without waiting for the next tick
    } catch (err) {
      setDataOutput({ error: "Failed to create invoice", details: errText(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quotes the user has seen but not yet confirmed (in memory only: nothing is reserved yet).
  const meltQuotes = useRef(new Map<string, { mint: string; invoice: string; quote: MeltQuoteBolt11Response }>());

  const handleMeltQuote = async (invoiceInput: string) => {
    const invoice = invoiceInput?.trim();
    if (!invoice) return setDataOutput({ error: "Please enter a Bolt11 invoice" });
    if (!guard()) return;
    setIsProcessing(true);
    try {
      const quote = await quoteMelt(activeMint, invoice); // NUT-05 quote: nothing is reserved or paid yet
      meltQuotes.current.set(quote.quote, { mint: activeMint, invoice, quote });
      setDataOutput({
        status: "Quote ready",
        type: "melt-quote",
        quoteId: quote.quote,
        amount: Amount.from(quote.amount).toNumber(),
        feeReserve: Amount.from(quote.fee_reserve).toNumber(),
      });
    } catch (err) {
      setDataOutput({ error: "Could not get a quote", details: errText(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMelt = async (quoteId: string) => {
    const confirmed = meltQuotes.current.get(quoteId);
    if (!confirmed) return setDataOutput({ error: "Melt failed", details: "This quote is no longer available. Paste the invoice again." });
    if (!guard()) return;
    setIsProcessing(true);
    try {
      const { mint, invoice, quote } = confirmed;
      const op = await startMelt(mint, invoice, quote); // NUT-05 + NUT-08 change, under the wallet lock
      meltQuotes.current.delete(quoteId);
      if (op.state === "DONE") {
        setDataOutput({ ...meltPaid(op), estimatedNewBalance: balance - op.amount - op.feeReserve + (op.change || 0) });
      } else if (op.state === "FAILED") {
        setDataOutput({ error: "Melt failed", details: op.error || "The mint could not pay the invoice. Your sats are back." });
      } else {
        pendingMelts.current.add(op.id); // the ticker reports how it ends
        setDataOutput({
          error: "Payment pending",
          details: "The mint is still paying. The sats stay reserved and this wallet will finish or refund it automatically.",
        });
      }
    } catch (err) {
      setDataOutput({ error: "Melt failed", details: errText(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwapSend = async (amountInput: string | number) => {
    const amount = parseInt(String(amountInput), 10);
    if (isNaN(amount) || amount <= 0) return setDataOutput({ error: "Enter a valid amount > 0" });
    if (!guard()) return;
    setIsProcessing(true);
    try {
      const op = await startSend(activeMint, amount); // NUT-03, token persisted, under the wallet lock
      if (op.state !== "DONE" || !op.token) {
        throw new Error(op.error || "The mint did not answer. The token will appear in History once recovered.");
      }
      setDataOutput({
        status: "Token created successfully",
        type: "swap-send",
        amount,
        token: op.token,
        message: "Copy this token and send it to the receiver. It is also saved in History.",
      });
    } catch (err) {
      setDataOutput({ error: "Swap Send failed", message: errText(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwapClaim = async (tokenInput: string, opts: { trustMint?: boolean } = {}) => {
    const token = tokenInput.trim();
    if (!token) return setDataOutput({ error: "Enter a token string" });
    if (!opts.trustMint) {
      // A mint the user never added: show it and ask first, before talking to it.
      let meta;
      try {
        meta = getTokenMetadata(token);
      } catch (error) {
        return setDataOutput({ error: "Claim failed", message: errText(error) });
      }
      if (!isSavedMint(meta.mint)) {
        return setDataOutput({
          status: "Check the mint",
          type: "claim-check",
          mint: normalizeMint(meta.mint),
          amount: amountToNumber(meta.amount),
          token,
        });
      }
    }
    setIsProcessing(true);
    try {
      const { token: claimable, spent } = await dropSpentProofs(token); // NUT-07 filter only
      const op = await startReceive(claimable); // NUT-03 swap; final only on success
      if (op.state === "FAILED") throw new Error(op.error || "Token could not be claimed");
      if (op.state !== "DONE") throw new Error(op.error || "The mint did not answer. The claim will be retried automatically.");
      rememberMint(op.mint); // the user claimed from it: list it under Mints from now on
      if (normalizeMint(op.mint) !== normalizeMint(activeMint)) switchMint(op.mint);
      setDataOutput({
        status: " Claim successful",
        type: "swap-claim",
        amount: op.amount,
        receivedCount: 1,
        spent,
        message: `Added ${op.amount} sat to your balance`,
      });
    } catch (error) {
      setDataOutput({ error: "Claim failed", message: errText(error) });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    activeMint,
    hydrated,
    handleSetMint,
    handleMint,
    handleMeltQuote,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
    setDataOutput,
    storage,
  };
}
