// src/hooks/useCashu.js
import { useState, useEffect, useRef } from "react";
import { Mint, Wallet, getEncodedTokenV4, getDecodedToken } from "@cashu/cashu-ts";
import { replacer, reviver, resolveKeysetId, normalizeMintUrl } from "@/lib/cashu";
import useProofStorage from "./useProofStorage";

export default function useCashu() {
  const [wallet, setWallet] = useState(null);
  const [walletReady, setWalletReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataOutput, setDataOutput] = useState(null);
  const [pendingMints, setPendingMints] = useState([]);
  const isRestored = useRef(false);

  const {
    addProofs,
    balance,
    removeProofs,
    getProofsByAmount,
    activeMint,
    switchMint,
    hydrated,
    currentProofs,
    proofsByMint,
    addProofsToMint,
  } = useProofStorage();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("pendingMints");
    if (saved) {
      try {
        const parsed = JSON.parse(saved, reviver);
        if (Array.isArray(parsed)) setPendingMints(parsed);
      } catch (e) {
        console.error("[PENDING] Load failed", e);
        localStorage.removeItem("pendingMints");
      }
    }
  }, []);

useEffect(() => {
    if (!wallet || !wallet.keys?.id || !hydrated || pendingMints.length === 0) return;
    pendingMints.forEach((pending) => {
      if (pending.mintUrl !== activeMint) return;
      if (pending.preview && pending.state === "ISSUED") {
        recoverMint(pending.preview, pending.id, pending.mintUrl);
      } else {
        pollMintQuote(pending.id, pending.amount, pending.mintUrl);
      }
    });
  }, [wallet, hydrated, activeMint, pendingMints.length]);

  const handleSetMint = async (mintUrlInput) => {
    let url = mintUrlInput.trim();
    if (!url) return setDataOutput({ error: "Enter a mint URL" });
    if (!url.endsWith("/")) url += "/";

    try {
      const mint = new Mint(url);
      const info = await mint.getInfo();
      const newWallet = new Wallet(mint, { unit: "sat" });
      await newWallet.loadMint();

      const rawKeys = await mint.getKeys();
      const keysets = rawKeys.keysets || [];
      const satKeyset = keysets.find((ks) => ks.unit === "sat" && ks.active) || keysets.find((ks) => ks.unit === "sat") || keysets[0];

      if (!satKeyset?.id) throw new Error("No sat keyset found");

      newWallet.bindKeyset(satKeyset.id);
      await newWallet.loadMint();

      setWallet(newWallet);
      setWalletReady(true);
      localStorage.setItem("activeMint", url);
      switchMint(url);

      setDataOutput({ status: "Mint connected ", keysId: satKeyset.id, info });
    } catch (error) {
      setWalletReady(false);
      setDataOutput({ error: "Connection failed", details: error.message });
    }
  };

    

  const handleMint = async (amountInput) => {
    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount <= 0) return setDataOutput({ error: "Enter amount > 0" });
    if (!activeMint || !wallet) return setDataOutput({ error: "Wallet or mint not ready" });

    setIsProcessing(true);
    try {
      const quote = await wallet.createMintQuoteBolt11(amount);
      const pendingEntry = { id: quote.quote, amount, mintUrl: activeMint, state: "UNPAID", timestamp: Date.now(), invoice: quote.request };
      const updated = [...pendingMints, pendingEntry];
      setPendingMints(updated);
      localStorage.setItem("pendingMints", JSON.stringify(updated, replacer));
      setDataOutput({ status: "Invoice created", invoice: quote.request, quoteId: quote.quote });
      pollMintQuote(quote.quote, amount, activeMint);
    } catch (err) {
      setDataOutput({ error: "Failed to create invoice", details: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const pollMintQuote = async (quoteId, amount, mintUrl) => {
    const check = async () => {
      try {
        const checked = await wallet.checkMintQuoteBolt11(quoteId);
        if (checked.state === "PAID" || checked.state === "ISSUED") {
          const preview = await wallet.ops.mintBolt11(amount, quoteId).prepare();
          setPendingMints((prev) => {
            const updated = prev.map((p) => (p.id === quoteId ? { ...p, preview, state: "ISSUED" } : p));
            localStorage.setItem("pendingMints", JSON.stringify(updated, replacer));
            return updated;
          });
          const proofs = await wallet.completeMint(preview);
          if (proofs?.length > 0) {
            addProofsToMint(mintUrl, proofs);
            setPendingMints((prev) => {
              const remaining = prev.filter((p) => p.id !== quoteId);
              localStorage.setItem("pendingMints", JSON.stringify(remaining, replacer));
              return remaining;
            });
            setDataOutput({ status: "Mint successful ✓", type: "mint", amount: amount, receivedProofs: proofs.length}); //here i just change -receivedProofs: proofs.length
          }
          return;
        }
        setTimeout(check, 5000);
      } catch (err) {
        setTimeout(check, 10000);
      }
    };
    check();
  };

  const recoverMint = async (preview, quoteId, mintUrl) => {
    try {
      const proofs = await wallet.completeMint(preview);
      if (proofs?.length > 0) addProofsToMint(mintUrl, proofs);
    } catch (err) {}
  };

  const handleMelt = async (invoiceInput) => {
  if (!wallet) {
    return setDataOutput({ error: "No wallet connected" });
  }

  // Auto-reload if keys are missing
  if (!wallet.keys?.id && !wallet.keysetId) {
    try {
      await wallet.loadMint();
    } catch (e) {
      return setDataOutput({ error: "Wallet connection lost", details: "Click 'Set Mint' again" });
    }
  }

  const invoice = invoiceInput?.trim();
  if (!invoice) {
    return setDataOutput({ error: "Please enter a Bolt11 invoice" });
  }

  setIsProcessing(true);
  try {
    const quote = await wallet.createMeltQuoteBolt11(invoice);
    const totalNeeded = quote.amount + quote.fee_reserve;

    // ←←← PREVIOUS LOGIC YOU LIKED (this always gives enough proofs)
    const proofsToSpend = getProofsByAmount(totalNeeded);
    const selectedTotal = proofsToSpend.reduce((sum, p) => sum + (p.amount || 0), 0);

    if (selectedTotal < totalNeeded) {
      return setDataOutput({ 
        error: "Insufficient balance", 
        details: `Needed ${totalNeeded} sat, only ${selectedTotal} sat available` 
      });
    }

    const meltResult = await wallet.meltProofsBolt11(quote, proofsToSpend);

    let effective = meltResult;
    if (meltResult.error && meltResult.details?.quote) {
      effective = meltResult.details;
    }

    const isPaid = effective.paid === true || 
                   effective.quote?.paid === true || 
                   effective.state === "PAID";

    if (!isPaid) {
      throw new Error("Mint could not pay the invoice");
    }

    // Remove spent proofs
    removeProofs(proofsToSpend);

    // Handle change proofs — with keyset repair (exactly your style)
    let changeAmount = 0;
    const changeArray = effective.change || effective.quote?.change || [];

    if (Array.isArray(changeArray) && changeArray.length > 0) {
      const currentKeysetId = wallet.keys?.id || wallet.keysetId;

      const readyChange = changeArray.map(p => ({
        secret: p.secret,
        C: p.C || p.C_,
        amount: Number(p.amount),
        id: p.id || currentKeysetId,
      }));

      addProofsToMint(activeMint, readyChange, currentKeysetId);
      changeAmount = readyChange.reduce((sum, p) => sum + p.amount, 0);
      console.log(`[MELT] Added ${changeAmount} sat change with keyset ${currentKeysetId}`);
    }

    const netSent = quote.amount;

    setDataOutput({ 
      status: "Success ✓", 
      type: "melt",
      success: `Paid ${netSent} sats successfully!`,
      preimage: effective.payment_preimage || effective.quote?.payment_preimage || "N/A",
      amount: netSent,
      feeReserve: quote.fee_reserve,
      changeReceived: changeAmount,
      estimatedNewBalance: balance - netSent - quote.fee_reserve + changeAmount,
    });

  } catch (err) {
    console.error("[MELT ERROR]", err);
    setDataOutput({ error: "Melt failed", details: err.message || String(err) });
  } finally {
    setIsProcessing(false);
  }
};

// === SWAP SEND (SAFE & SIMPLE) ===
  const handleSwapSend = async (amountInput) => {
    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount <= 0) {
      return setDataOutput({ error: "Enter a valid amount > 0" });
    }
    if (!wallet || !activeMint) {
      return setDataOutput({ error: "Wallet or mint not ready" });
    }

    const selectedProofs = getProofsByAmount(amount);
    if (selectedProofs.reduce((sum, p) => sum + (p.amount || 0), 0) < amount) {
      return setDataOutput({ error: "Insufficient balance" });
    }

    setIsProcessing(true);
    try {
      // This is the correct, official way
      const sendResult = await wallet.send(amount, selectedProofs);

      const normalizedMint = normalizeMintUrl(activeMint);
      const tokenString = getEncodedTokenV4({
        mint: normalizedMint,
        proofs: sendResult.send,   // library already gives perfect proofs
        unit: "sat",
      });

      // Update local balance
      removeProofs(selectedProofs);
      if (sendResult.keep?.length > 0) addProofs(sendResult.keep);

      setDataOutput({
        status: "Token created successfully",
        type: "swap-send",
        amount: amount,
        token: tokenString,
        message: "Copy this token and send it to the receiver",
      });

      console.log(" Token created successfully (length:", tokenString.length, "characters)");
    } catch (err) {
      console.error("[SWAP SEND ERROR]", err);
      setDataOutput({ error: "Swap Send failed", message: err.message || String(err) });
    } finally {
      setIsProcessing(false);
    }
  };

   // === SWAP CLAIM (FIXED + BETTER DEBUG) ===
  const handleSwapClaim = async (tokenStringInput) => {
    const tokenString = tokenStringInput.trim();
    if (!tokenString) {
      return setDataOutput({ error: "Enter a token string" });
    }

    setIsProcessing(true);
    try {
      console.log("[CLAIM] Starting claim with token (first 80 chars):", tokenString.substring(0, 80) + "...");

      // ←←← THIS IS THE CORRECT MODERN WAY
      const receiveResult = await wallet.ops.receive(tokenString).run();

      console.log("[CLAIM] Raw receiveResult from mint:", receiveResult);

      // The library can return either an array of proofs OR an object
      let receivedProofs = [];
      if (Array.isArray(receiveResult)) {
        receivedProofs = receiveResult;
      } else if (receiveResult?.proofs) {
        receivedProofs = receiveResult.proofs;
      } else if (receiveResult?.received) {
        receivedProofs = receiveResult.received;
      }

      if (receivedProofs.length === 0) {
        console.error("[CLAIM] Received empty proofs array from mint");
        throw new Error("No proofs received from mint – token may already be spent or invalid");
      }

      // Add to balance
      addProofsToMint(activeMint, receivedProofs);

      const receivedAmount = receivedProofs.reduce((sum, p) => sum + (p.amount || 0), 0);

      setDataOutput({
        status: " Claim successful",
        type: "swap-claim",
        amount: receivedAmount,
        receivedCount: receivedProofs.length,
        message: `Added ${receivedAmount} sat to your balance`,
      });

      console.log(`[CLAIM] SUCCESS – Added ${receivedAmount} sat`);
    } catch (error) {
      console.error("[SWAP CLAIM ERROR]", error);
      setDataOutput({
        error: "Claim failed",
        message: error.message || String(error),
      });
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
    currentProofs,
    hydrated,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
    setDataOutput,
  };
}

// src/hooks/useCashu.js
// MIT License
// Copyright (c) 2026 Jose2097
// FINAL PRODUCTION VERSION – Memory-Safe + Foreground UI Protection

/*import { useState, useEffect, useRef } from "react";
import { Mint, Wallet, getEncodedTokenV4, getDecodedToken } from "@cashu/cashu-ts";
import { replacer, reviver, normalizeMintUrl } from "@/lib/cashu";
import useProofStorage from "./useProofStorage";

export default function useCashu() {
  const [wallet, setWallet] = useState(null);
  const [walletReady, setWalletReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dataOutput, setDataOutput] = useState(null);
  const [pendingMints, setPendingMints] = useState([]);

  // Timer tracking to prevent memory leaks
  const activeTimers = useRef(new Map());

  // Foreground UI protection ref (prevents background polling from overwriting active UI messages)
  const isProcessingRef = useRef(false);

  const {
    addProofs,
    balance,
    removeProofs,
    getProofsByAmount,
    activeMint,
    switchMint,
    hydrated,
    currentProofs,
    proofsByMint,
    addProofsToMint,
  } = useProofStorage();

  // Sync ref with state for safe access inside async closures
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Load pending mints from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("pendingMints");
    if (saved) {
      try {
        const parsed = JSON.parse(saved, reviver);
        if (Array.isArray(parsed)) setPendingMints(parsed);
      } catch (e) {
        console.error("[PENDING] Load failed", e);
        localStorage.removeItem("pendingMints");
      }
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      activeTimers.current.forEach((timerId) => clearTimeout(timerId));
      activeTimers.current.clear();
    };
  }, []);

  // Background polling for pending mint quotes
  useEffect(() => {
    if (!wallet || !wallet.keys?.id || !hydrated || pendingMints.length === 0) return;

    pendingMints.forEach((pending) => {
      if (pending.mintUrl !== activeMint) return;
      if (activeTimers.current.has(pending.id)) return;

      if (pending.preview && pending.state === "ISSUED") {
        recoverMint(pending.preview, pending.id, pending.mintUrl);
      } else {
        pollMintQuote(pending.id, pending.amount, pending.mintUrl);
      }
    });
  }, [wallet, hydrated, activeMint, pendingMints.length]);

  const handleSetMint = async (mintUrlInput) => {
    let url = mintUrlInput.trim();
    if (!url) return setDataOutput({ error: "Enter a mint URL" });
    if (!url.endsWith("/")) url += "/";

    try {
      const mint = new Mint(url);
      const info = await mint.getInfo();
      const newWallet = new Wallet(mint, { unit: "sat" });
      await newWallet.loadMint();

      const rawKeys = await mint.getKeys();
      const keysets = rawKeys.keysets || [];
      const satKeyset = keysets.find((ks) => ks.unit === "sat" && ks.active) ||
                        keysets.find((ks) => ks.unit === "sat") ||
                        keysets[0];

      if (!satKeyset?.id) throw new Error("No sat keyset found");

      newWallet.bindKeyset(satKeyset.id);
      await newWallet.loadMint();

      // Clear old timers when switching mint
      activeTimers.current.forEach((timerId) => clearTimeout(timerId));
      activeTimers.current.clear();

      setWallet(newWallet);
      setWalletReady(true);
      localStorage.setItem("activeMint", url);
      switchMint(url);

      setDataOutput({ status: "Mint connected ", keysId: satKeyset.id, info });
    } catch (error) {
      setWalletReady(false);
      setDataOutput({ error: "Connection failed", details: error.message });
    }
  };

  const handleMint = async (amountInput) => {
    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount <= 0) return setDataOutput({ error: "Enter amount > 0" });
    if (!activeMint || !wallet) return setDataOutput({ error: "Wallet or mint not ready" });

    setIsProcessing(true);
    try {
      const quote = await wallet.createMintQuoteBolt11(amount);
      const pendingEntry = {
        id: quote.quote,
        amount,
        mintUrl: activeMint,
        state: "UNPAID",
        timestamp: Date.now(),
        invoice: quote.request
      };
      const updated = [...pendingMints, pendingEntry];
      setPendingMints(updated);
      localStorage.setItem("pendingMints", JSON.stringify(updated, replacer));
      setDataOutput({ status: "Invoice created", invoice: quote.request, quoteId: quote.quote });
      pollMintQuote(quote.quote, amount, activeMint);
    } catch (err) {
      setDataOutput({ error: "Failed to create invoice", details: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const pollMintQuote = async (quoteId, amount, mintUrl) => {
    const check = async () => {
      if (activeMint !== mintUrl) {
        activeTimers.current.delete(quoteId);
        return;
      }

      try {
        const checked = await wallet.checkMintQuoteBolt11(quoteId);
        if (checked.state === "PAID" || checked.state === "ISSUED") {
          const preview = await wallet.ops.mintBolt11(amount, quoteId).prepare();

          // Atomic disk write
          try {
            const currentStoredProofs = JSON.parse(localStorage.getItem("proofsByMint") || "{}", reviver);
            const existing = currentStoredProofs[mintUrl] || [];
            const existingSecrets = new Set(existing.map(p => p.secret));
            const uniqueProofs = preview.proofs ? preview.proofs.filter(p => !existingSecrets.has(p.secret)) : [];

            if (uniqueProofs.length > 0) {
              currentStoredProofs[mintUrl] = [...existing, ...uniqueProofs];
              localStorage.setItem("proofsByMint", JSON.stringify(currentStoredProofs, replacer));
            }

            const currentStoredPending = JSON.parse(localStorage.getItem("pendingMints") || "[]", reviver);
            const remaining = currentStoredPending.filter((p) => p.id !== quoteId);
            localStorage.setItem("pendingMints", JSON.stringify(remaining, replacer));
          } catch (e) {
            console.error("Disk write failed:", e);
          }

          const proofs = await wallet.completeMint(preview);
          if (proofs?.length > 0) {
            addProofsToMint(mintUrl, proofs);
            setPendingMints((prev) => prev.filter((p) => p.id !== quoteId));

            // Only update UI if user is not actively doing something else
            if (!isProcessingRef.current) {
              setDataOutput({ status: "Mint successful ✓", type: "mint", amount: amount, receivedProofs: proofs.length });
            }
          }
          activeTimers.current.delete(quoteId);
          return;
        }

        const timerId = setTimeout(check, 5000);
        activeTimers.current.set(quoteId, timerId);
      } catch (err) {
        const timerId = setTimeout(check, 10000);
        activeTimers.current.set(quoteId, timerId);
      }
    };

    const initialTimer = setTimeout(check, 2000);
    activeTimers.current.set(quoteId, initialTimer);
  };

  const recoverMint = async (preview, quoteId, mintUrl) => {
    try {
      const proofs = await wallet.completeMint(preview);
      if (proofs?.length > 0) {
        addProofsToMint(mintUrl, proofs);
        setPendingMints((prev) => prev.filter((p) => p.id !== quoteId));
      }
    } catch (err) {
      console.error("Failed to recover pending mint:", err);
    }
  };

  const handleMelt = async (invoiceInput) => {
    if (!wallet) return setDataOutput({ error: "No wallet connected" });

    const invoice = invoiceInput?.trim();
    if (!invoice) return setDataOutput({ error: "Please enter a Bolt11 invoice" });

    setIsProcessing(true);
    try {
      const quote = await wallet.createMeltQuoteBolt11(invoice);
      const totalNeeded = quote.amount + quote.fee_reserve;

      const proofsToSpend = getProofsByAmount(totalNeeded);
      const selectedTotal = proofsToSpend.reduce((sum, p) => sum + (p.amount || 0), 0);

      if (selectedTotal < totalNeeded) {
        return setDataOutput({
          error: "Insufficient balance",
          details: `Needed ${totalNeeded} sat, only ${selectedTotal} sat available`
        });
      }

      const meltResult = await wallet.meltProofsBolt11(quote, proofsToSpend);

      let effective = meltResult;
      if (meltResult.error && meltResult.details?.quote) {
        effective = meltResult.details;
      }

      const isPaid = effective.paid === true ||
                     effective.quote?.paid === true ||
                     effective.state === "PAID";

      if (!isPaid) throw new Error("Mint could not pay the invoice");

      removeProofs(proofsToSpend);

      let changeAmount = 0;
      const changeArray = effective.change || effective.quote?.change || [];

      if (Array.isArray(changeArray) && changeArray.length > 0) {
        const currentKeysetId = wallet.keys?.id || wallet.keysetId;
        const readyChange = changeArray.map(p => ({
          secret: p.secret,
          C: p.C || p.C_,
          amount: Number(p.amount),
          id: p.id || currentKeysetId,
        }));

        addProofsToMint(activeMint, readyChange, currentKeysetId);
        changeAmount = readyChange.reduce((sum, p) => sum + p.amount, 0);
      }

      const netSent = quote.amount;

      setDataOutput({
        status: "Success ✓",
        type: "melt",
        success: `Paid ${netSent} sats successfully!`,
        preimage: effective.payment_preimage || effective.quote?.payment_preimage || "N/A",
        amount: netSent,
        feeReserve: quote.fee_reserve,
        changeReceived: changeAmount,
        estimatedNewBalance: balance - netSent - quote.fee_reserve + changeAmount,
      });
    } catch (err) {
      console.error("[MELT ERROR]", err);
      setDataOutput({ error: "Melt failed", details: err.message || String(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwapSend = async (amountInput) => {
    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount <= 0) return setDataOutput({ error: "Enter a valid amount > 0" });
    if (!wallet || !activeMint) return setDataOutput({ error: "Wallet or mint not ready" });

    const selectedProofs = getProofsByAmount(amount);
    if (selectedProofs.reduce((sum, p) => sum + (p.amount || 0), 0) < amount) {
      return setDataOutput({ error: "Insufficient balance" });
    }

    setIsProcessing(true);
    try {
      const sendResult = await wallet.send(amount, selectedProofs);
      const normalizedMint = normalizeMintUrl(activeMint);
      const tokenString = getEncodedTokenV4({
        mint: normalizedMint,
        proofs: sendResult.send,
        unit: "sat",
      });

      removeProofs(selectedProofs);
      if (sendResult.keep?.length > 0) addProofs(sendResult.keep);

      setDataOutput({
        status: "Token created successfully",
        type: "swap-send",
        amount: amount,
        token: tokenString,
        message: "Copy this token and send it to the receiver",
      });
    } catch (err) {
      console.error("[SWAP SEND ERROR]", err);
      setDataOutput({ error: "Swap Send failed", message: err.message || String(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSwapClaim = async (tokenStringInput) => {
    const tokenString = tokenStringInput.trim();
    if (!tokenString) return setDataOutput({ error: "Enter a token string" });

    setIsProcessing(true);
    try {
      getDecodedToken(tokenString);

      const receiveResult = await wallet.ops.receive(tokenString).run();

      let receivedProofs = [];
      if (Array.isArray(receiveResult)) receivedProofs = receiveResult;
      else if (receiveResult?.proofs) receivedProofs = receiveResult.proofs;
      else if (receiveResult?.received) receivedProofs = receiveResult.received;

      if (receivedProofs.length === 0) {
        throw new Error("No valid proofs received – token may be spent or invalid");
      }

      addProofsToMint(activeMint, receivedProofs);

      const receivedAmount = receivedProofs.reduce((sum, p) => sum + (p.amount || 0), 0);

      setDataOutput({
        status: "Claim successful",
        type: "swap-claim",
        amount: receivedAmount,
        receivedCount: receivedProofs.length,
        message: `Added ${receivedAmount} sat to your balance`,
      });
    } catch (error) {
      console.error("[SWAP CLAIM ERROR]", error);
      setDataOutput({ error: "Claim failed", message: error.message || String(error) });
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
    currentProofs,
    hydrated,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
    setDataOutput,
  };
}*/