import useProofStorage from "@/hooks/useProofStorage";
import { Mint, Wallet, getEncodedToken } from "@cashu/cashu-ts";
import React, { useState, useEffect } from "react";

const CocoaWallet = () => {
  const [formData, setFormData] = useState({
    mintUrl: "",
    mintAmount: "",
    meltInvoice: "",
    swapAmount: "",
    swapToken: "",
  });
  const [dataOutput, setDataOutput] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [wallets, setWallets] = useState({});
  const [walletReady, setWalletReady] = useState(false);
  //const [renderKey, setRenderKey] = useState(0);

const {
  addProofs: hookAddProofs,
  balance,
  removeProofs: hookRemoveProofs,
  getProofsByAmount,
  activeMint,         
  switchMint,   
  hydrated,
  currentProofs, 
  proofsByMint,                    
  getProofsByAmountFromMint,       
  addProofsToMint,
  removeProofsFromMint,  
} = useProofStorage();


/*
THIS USEEFFECT
useEffect(() => {
  // Only run on client (after mount)
  if (typeof window === 'undefined') return;

  const storedActive = localStorage.getItem("activeMint");
  if (!storedActive) return;

  try {
    const storedData = JSON.parse(localStorage.getItem(`mintData_${storedActive}`) || "{}");
    if (!storedData.url) return;

    const mint = new Mint(storedData.url);
    const walletInstance = new Wallet(mint, { keys: storedData.keyset, unit: "sat" });

    walletInstance.loadMint()
      .then(() => {
        setWallet(walletInstance);
        setFormData(prev => ({ ...prev, mintUrl: storedActive }));
        setWalletReady(true);
      })
      .catch(err => console.error("Failed to load stored mint:", err));
      setWalletReady(false);
  } catch (err) {
    console.error("Error loading stored mint:", err);
  }
}, []);*/  // empty array = run once on mount

useEffect(() => {
  if (typeof window === 'undefined') return;

  const storedActive = localStorage.getItem("activeMint");
  if (!storedActive) return;

  (async () => {
    try {
      console.log("[INIT] Restoring mint:", storedActive);
      const storedData = JSON.parse(localStorage.getItem(`mintData_${storedActive}`) || "{}");
      if (!storedData.url) return;

      const mint = new Mint(storedData.url);
      const walletInstance = new Wallet(mint, { unit: "sat" }); // ← no old keys

      await walletInstance.loadMint();

      if (!walletInstance.keys?.id) {
        throw new Error("loadMint succeeded but keys.id missing");
      }

      console.log("[INIT] Wallet restored with keys:", walletInstance.keys.id);
      setWallet(walletInstance);
      setFormData(prev => ({ ...prev, mintUrl: storedActive }));
      setWalletReady(true);
    } catch (err) {
      console.error("[INIT] Restore failed:", err);
      setDataOutput({ 
        error: "Failed to restore wallet", 
        details: "Please click 'Set Mint' again" 
      });
    }
  })();
}, []);

useEffect(() => {
  console.log("[RENDER] Balance / proofs updated:", { balance, proofsCount: currentProofs.length });
  // Optional: force a small re-render delay if needed
}, [balance, currentProofs.length, activeMint]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

/*

THIS HANDLESETMINT

const handleSetMint = async () => {
  const url = formData.mintUrl.trim();
  if (!url) {
    setDataOutput({ error: "Enter a mint URL" });
    return;
  }

  try {
    const mint = new Mint(url);
    const info = await mint.getInfo();
    setDataOutput(info);

    const newWallet = new Wallet(mint);
    await newWallet.loadMint();

    setWallet(newWallet);
    setWalletReady(true);

    // Save to multi-mint map
    setWallets(prev => ({
      ...prev,
      [url]: newWallet,
    }));

    const { keysets } = await mint.getKeys();
    const satKeyset = keysets.find((k) => k.unit === "sat");

    localStorage.setItem(
      `mintData_${url}`,
      JSON.stringify({ url, keyset: satKeyset })
    );

    // Call switchMint
    switchMint(url);

    // Update form (safe – setFormData is always stable)
    setFormData(prev => ({ ...prev, mintUrl: url }));

  } catch (error) {
    console.error("Mint connection failed:", error);
    setDataOutput({
      error: "Failed to connect to mint",
      details: error.message || String(error),
    });
    setWalletReady(false);
  }
};*/

const handleSetMint = async () => {
  const url = formData.mintUrl.trim();
  if (!url) {
    setDataOutput({ error: "Enter a mint URL" });
    return;
  }

  try {
    console.log("[SET MINT] Connecting to", url);

    // Original: get mint info
    const mint = new Mint(url);
    const info = await mint.getInfo();
    setDataOutput(info);  // ← keeps original behavior

    // Create wallet (no unit option to avoid filtering issues)
    const newWallet = new Wallet(mint);

    // Original flow: try loadMint first (keep it for compatibility)
    console.log("[SET MINT] Trying loadMint()...");
    await newWallet.loadMint();

    // Debug after loadMint
    console.log("[SET MINT] After loadMint — wallet.keys:", newWallet.keys);
    console.log("[SET MINT] After loadMint — wallet.keysets length:", newWallet.keysets?.length);

    // Manual fetch + auto-select (fallback if loadMint didn't populate properly)
    console.log("[SET MINT] Fetching keysets directly as fallback...");
    const rawKeys = await mint.getKeys();
    console.log("[SET MINT] Raw keysets from mint.getKeys():", rawKeys);

    if (!rawKeys?.keysets?.length) {
      throw new Error("Mint /keys returned no keysets");
    }

    // Assign keysets to wallet
    newWallet.keysets = rawKeys.keysets;

    // Auto-select active sat keyset (this mimics what loadMint *should* do automatically)
    const activeSat = rawKeys.keysets.find(ks => ks.unit === "sat" && ks.active === true);
    if (activeSat) {
      newWallet.keys = activeSat;
      console.log("[SET MINT] Auto-selected active sat keyset:", activeSat.id);
    } else {
      console.warn("[SET MINT] No active sat keyset found — falling back to first sat");
      newWallet.keys = rawKeys.keysets.find(ks => ks.unit === "sat") || rawKeys.keysets[0];
    }

    // Final safety check
    if (!newWallet.keys?.id) {
      throw new Error("Could not select any valid keyset");
    }

    console.log("[SET MINT] SUCCESS - keys.id =", newWallet.keys.id);

    // Original: set wallet state
    setWallet(newWallet);
    setWalletReady(true);

    // Original: save to multi-mint map
    setWallets(prev => ({
      ...prev,
      [url]: newWallet,
    }));

    // Original: save to localStorage
    const satKeyset = rawKeys.keysets.find(k => k.unit === "sat" && k.active) ||
                      rawKeys.keysets.find(k => k.unit === "sat") ||
                      rawKeys.keysets[0];

    localStorage.setItem(
      `mintData_${url}`,
      JSON.stringify({ url, keyset: satKeyset })
    );
    localStorage.setItem("activeMint", url);

    // Original: switch mint & update form
    switchMint(url);
    setFormData(prev => ({ ...prev, mintUrl: url }));

    // Final success message with more info
    setDataOutput({ 
      status: "Mint connected ✓", 
      keysId: newWallet.keys.id,
      keysetsCount: newWallet.keysets.length,
      info: info  // keeps original info
    });

  } catch (error) {
    console.error("[SET MINT] Failed:", error);
    setDataOutput({
      error: "Failed to connect to mint",
      details: error.message || String(error),
    });
    setWalletReady(false);
  }
};

/*const handleMint = async () => {
  const amount = parseInt(formData.mintAmount);
  if (isNaN(amount) || amount <= 0) {
    setDataOutput({ error: "Enter amount > 0" });
    return;
  }

  const mintUrl = activeMint || formData.mintUrl.trim();
  if (!mintUrl) {
    setDataOutput({ error: "No mint URL" });
    return;
  }

  console.log("[MINT] Starting for", amount, "sat → mint:", mintUrl);

  let targetWallet = wallets[mintUrl];
  if (!targetWallet) {
    try {
      const mint = new Mint(mintUrl);
      targetWallet = new Wallet(mint);
      await targetWallet.loadMint();
      setWallets(prev => ({ ...prev, [mintUrl]: targetWallet }));
      if (!wallet || activeMint === mintUrl) {
        setWallet(targetWallet);
        setWalletReady(true);
      }
    } catch (err) {
      console.error("[MINT] Wallet init failed:", err);
      setDataOutput({ error: "Wallet failed" });
      return;
    }
  }

  let quote;
  try {
    quote = await targetWallet.createMintQuoteBolt11(amount);
    setDataOutput(quote);
    console.log("[MINT] Quote:", quote.state, quote.quote);
  } catch (err) {
    console.error("[MINT] Quote failed:", err);
    setDataOutput({ error: "Quote failed" });
    return;
  }

  const checkQuote = async () => {
    try {
      const checked = await targetWallet.checkMintQuoteBolt11(quote.quote);
      console.log("[MINT] State:", checked.state, "paid:", checked.paid);

      if (checked.state === "PAID" || checked.state === "ISSUED") {
        console.log("[MINT] Minting proofs...");

        const proofs = await targetWallet.mintProofsBolt11(amount, quote.quote, {
          keysetId: targetWallet.keys?.id,
        });

        console.log("[MINT] Proofs:", proofs?.length || 0);
        if (proofs?.length) {
          console.log("[MINT] Amounts:", proofs.map(p => p.amount));
        }

        if (proofs?.length > 0) {
          console.log("[MINT] Adding to:", mintUrl);

          //addProofsToMint(mintUrl, proofs);

          // Force the entire component to re-render (this fixes the first-mint visibility delay)
         // setRenderKey(k => k + 1);

          //setFormData(prev => ({ ...prev, mintAmount: "" }));
          //setDataOutput({ status: "Proofs added" });

          addProofsToMint(mintUrl, proofs);
          setRenderKey(k => k + 1); // keep if you still need force render

          // Better immediate debug – no timeout
          console.log("[MINT DEBUG IMMEDIATE]");
          console.log("  activeMint:", activeMint);
          console.log("  currentProofs length:", currentProofs.length);
          console.log("  balance:", balance);
          console.log("  proofsByMint keys:", Object.keys(proofsByMint || {}));
          if (proofsByMint[mintUrl]) {
            console.log("  proofs for this mint:", proofsByMint[mintUrl].map(p => p.amount));
          }
        }

        setDataOutput({ minted: proofs });
      } else {
        setTimeout(checkQuote, 5000);
      }
    } catch (err) {
      console.error("[MINT] Error:", err);
      setDataOutput({ error: "Mint check failed" });
    }
  };

  checkQuote();
};*/

const handleMint = async () => {
  const amount = parseInt(formData.mintAmount);
  if (isNaN(amount) || amount <= 0) {
    setDataOutput({ error: "Enter amount > 0" });
    return;
  }

  const mintUrl = activeMint || formData.mintUrl.trim();
  if (!mintUrl) {
    setDataOutput({ error: "No mint URL" });
    return;
  }

  console.log("[MINT] Starting for", amount, "sat → mint:", mintUrl);

  let targetWallet = wallets[mintUrl];
  if (!targetWallet) {
    try {
      const mint = new Mint(mintUrl);
      targetWallet = new Wallet(mint);
      await targetWallet.loadMint();
      setWallets(prev => ({ ...prev, [mintUrl]: targetWallet }));
      if (!wallet || activeMint === mintUrl) {
        setWallet(targetWallet);
        setWalletReady(true);
      }
    } catch (err) {
      console.error("[MINT] Wallet init failed:", err);
      setDataOutput({ error: "Wallet failed" });
      return;
    }
  }

  let quote;
  try {
    quote = await targetWallet.createMintQuoteBolt11(amount);
    setDataOutput(quote);
    console.log("[MINT] Quote:", quote.state, quote.quote);
  } catch (err) {
    console.error("[MINT] Quote failed:", err);
    setDataOutput({ error: "Quote failed" });
    return;
  }

  const checkQuote = async () => {
    try {
      const checked = await targetWallet.checkMintQuoteBolt11(quote.quote);
      console.log("[MINT] State:", checked.state, "paid:", checked.paid);

      if (checked.state === "PAID" || checked.state === "ISSUED") {
        console.log("[MINT] Minting proofs...");

        const proofs = await targetWallet.mintProofsBolt11(amount, quote.quote, {
          keysetId: targetWallet.keys?.id,
        });

        console.log("[MINT] Proofs:", proofs?.length || 0);
        if (proofs?.length) {
          console.log("[MINT] Amounts:", proofs.map(p => p.amount));
        }

        if (proofs?.length > 0) {
          console.log("[MINT] Adding to:", mintUrl);

          addProofsToMint(mintUrl, proofs);

          // Debug after flush (kept from previous fix)
          setTimeout(() => {
            console.log("[MINT DEBUG AFTER FLUSH]");
            console.log("  activeMint:", activeMint);
            console.log("  currentProofs length:", currentProofs.length);
            console.log("  balance:", balance);
            console.log("  proofsByMint keys:", Object.keys(proofsByMint || {}));
            if (proofsByMint[mintUrl]) {
              console.log("  proofs for this mint:", proofsByMint[mintUrl].map(p => p.amount));
            }
          }, 0);

          setFormData(prev => ({ ...prev, mintAmount: "" }));
          setDataOutput({ status: "Proofs added", minted: proofs });
        }
      } else {
        setTimeout(checkQuote, 5000);
      }
    } catch (err) {
      console.error("[MINT] Error:", err);
      setDataOutput({ error: "Mint check failed" });
    }
  };

  checkQuote();
};

/*
THIS HANDLEMELT

const handleMelt = async () => {
  if (!wallet) {
    setDataOutput({ error: "No wallet connected" });
    return;
  }

  const invoice = formData.meltInvoice?.trim();
  if (!invoice) {
    setDataOutput({ error: "Please enter a Bolt11 invoice" });
    return;
  }

  try {
    // Step 1: Create quote
    const quote = await wallet.createMeltQuoteBolt11(invoice);
    setDataOutput({
      status: "Creating quote...",
      meltQuote: quote
    });

    const totalAmountNeeded = quote.amount + quote.fee_reserve;

    // ── DEBUG LOGS FOR PROOF SELECTION ──────────────────────────────────────────
    console.log("Current wallet keyset ID:", wallet.keys?.id);
    console.log("All stored proofs:", currentProofs.map(p => ({ 
      amount: p.amount, 
      id: p.id, 
      secretPrefix: p.secret?.slice(0, 8) + "..." 
    })));
    console.log("Needed amount:", totalAmountNeeded);
    // ─────────────────────────────────────────────────────────────────────────────

    // Use ALL proofs that are small enough (ignore keyset filter for now)
    const proofs = currentProofs.filter(p => p.amount <= totalAmountNeeded);

    console.log("Selected proofs (all keysets):", proofs.map(p => p.amount));
    console.log("Selected total:", proofs.reduce((sum, p) => sum + p.amount, 0));

    if (proofs.length === 0 || proofs.reduce((sum, p) => sum + p.amount, 0) < totalAmountNeeded) {
      setDataOutput({ 
        error: "Insufficient balance", 
        details: "No suitable proofs found. Total available: " + balance + " sat" 
      });
      alert("Insufficient balance");
      return;
    }

    // Step 2: Melt
    const meltResult = await wallet.meltProofsBolt11(quote, proofs, {
      keysetId: wallet.keys?.id, // still pass current keyset for the melt request
    });

    console.log("Full meltResult from library:", JSON.stringify(meltResult, null, 2));

    // ── Workaround for wrapped "error" on success ──
    let effectiveResult = meltResult;
    let isWrappedError = false;

    if (meltResult.error && meltResult.details?.quote) {
      console.warn("Mint/library wrapped success in 'error' → using inner details");
      isWrappedError = true;
      effectiveResult = meltResult.details;
    }

    const isPaid = effectiveResult.paid === true ||
                   effectiveResult.quote?.paid === true;

    if (!isPaid) {
      setDataOutput({
        error: "Mint could not pay the invoice (or paid status missing)",
        details: meltResult,
        meltResultRaw: JSON.stringify(meltResult, null, 2)
      });
      return;
    }

    // ── Success path ──
    console.log("Melt SUCCESS - removing spent proofs:", proofs.map(p => p.amount));
    hookRemoveProofs(proofs);

    console.log("Proofs removed. Current count:", currentProofs.length);

    let changeAmount = 0;
    const changeArray = effectiveResult.change || [];

    if (Array.isArray(changeArray) && changeArray.length > 0) {
      const readyChangeProofs = changeArray.map(p => ({
        secret: p.secret,
        C: p.C,
        amount: p.amount,
        id: p.id,
      }));

      if (readyChangeProofs.length > 0) {
        console.log("Adding change proofs:", readyChangeProofs.map(p => p.amount));
        //hookAddProofs(readyChangeProofs);
        addProofsToMint(activeMint, readyChangeProofs);
        changeAmount = readyChangeProofs.reduce((sum, p) => sum + p.amount, 0);

        console.log("Proofs added. New count:", currentProofs.length);
        console.log("Calculated balance right now:", balance);
      } else {
        console.warn("Change proofs array was empty after mapping");
      }
    } else {
      console.warn("No change proofs found in response");
    }

    // Final success output – merge with previous data
    setDataOutput(prev => ({
      ...prev,
      status: "Success",
      success: `Melt OK - invoice paid! ${isWrappedError ? '(wrapped error workaround applied)' : ''}`,
      preimage: effectiveResult.quote?.payment_preimage || effectiveResult.payment_preimage || "-",
      amountPaid: quote.amount,
      feeReserve: quote.fee_reserve,
      changeReceived: changeAmount,
      estimatedNewBalance: (balance ?? 0) - quote.amount - quote.fee_reserve + changeAmount,
      fullMeltResult: meltResult,
      changeProofsAdded: changeAmount > 0 ? changeArray : null
    }));

    setFormData(prev => ({ ...prev, meltInvoice: "" }));

    // Comment out reload – state should update live now
    // window.location.reload();

  } catch (err) {
    console.error("Melt error:", err);
    setDataOutput({
      error: "Melt failed",
      details: err.message || String(err),
      stack: err.stack
    });
  }
};*/

const handleMelt = async () => {
  if (!wallet) {
    return setDataOutput({ error: "No wallet connected" });
  }

  // Relaxed guard: allow if either keys.id exists OR keysets array is populated
  if (!wallet.keys?.id && (!wallet.keysets || wallet.keysets.length === 0)) {
    console.error("[MELT] No keys.id and no keysets loaded");
    return setDataOutput({ 
      error: "Wallet not initialized", 
      details: "Mint keys/keysets missing — click 'Set Mint' again"
    });
  }

  // Optional: warn if we're using keysets fallback
  if (!wallet.keys?.id) {
    console.warn("[MELT] Proceeding with keysets array only (keys.id missing)");
  }

  const invoice = formData.meltInvoice?.trim();
  if (!invoice) {
    setDataOutput({ error: "Please enter a Bolt11 invoice" });
    return;
  }

  try {
    // Step 1: Create quote
    const quote = await wallet.createMeltQuoteBolt11(invoice);
    setDataOutput({
      status: "Creating quote...",
      meltQuote: quote,
    });

    const totalAmountNeeded = quote.amount + quote.fee_reserve;

    // ── DEBUG LOGS FOR PROOF SELECTION ──────────────────────────────────────
    console.log("Current wallet keyset ID:", wallet.keys?.id || "(using keysets)");
    console.log("All stored proofs:", currentProofs.map(p => ({
      amount: p.amount,
      id: p.id,
      secretPrefix: p.secret?.slice(0, 8) + "..."
    })));
    console.log("Needed amount:", totalAmountNeeded);

    // Use proofs from current mint only (small enough)
    const proofs = currentProofs.filter(p => p.amount <= totalAmountNeeded);

    console.log("Selected proofs:", proofs.map(p => p.amount));
    console.log("Selected total:", proofs.reduce((sum, p) => sum + p.amount, 0));

    if (proofs.length === 0 || proofs.reduce((sum, p) => sum + p.amount, 0) < totalAmountNeeded) {
      setDataOutput({
        error: "Insufficient balance",
        details: `Needed ${totalAmountNeeded} sat, available: ${balance} sat`
      });
      alert("Insufficient balance");
      return;
    }

    // Step 2: Melt – no keysetId option
    console.log("[MELT] Sending proofs to meltProofsBolt11...");
    const meltResult = await wallet.meltProofsBolt11(quote, proofs);

    console.log("Full meltResult from library:", JSON.stringify(meltResult, null, 2));

    // ── Workaround for wrapped "error" on success ───────────────────────────
    let effectiveResult = meltResult;
    let isWrappedError = false;

    if (meltResult.error && meltResult.details?.quote) {
      console.warn("Mint/library wrapped success in 'error' → using inner details");
      isWrappedError = true;
      effectiveResult = meltResult.details;
    }

    const isPaid = effectiveResult.paid === true ||
                   effectiveResult.quote?.paid === true;

    if (!isPaid) {
      setDataOutput({
        error: "Mint could not pay the invoice",
        details: effectiveResult,
        meltResultRaw: JSON.stringify(meltResult, null, 2),
      });
      return;
    }

    // ── Success path ────────────────────────────────────────────────────────
    console.log("Melt SUCCESS - removing spent proofs:", proofs.map(p => p.amount));
    hookRemoveProofs(proofs);

    let changeAmount = 0;
    const changeArray = effectiveResult.change || [];

    if (Array.isArray(changeArray) && changeArray.length > 0) {
      const readyChangeProofs = changeArray.map(p => ({
        secret: p.secret,
        C: p.C,
        amount: p.amount,
        id: p.id || wallet.keys?.id || wallet.keysets?.find(ks => ks.active)?.id, // fallback chain
      }));

      if (readyChangeProofs.length > 0) {
        console.log("Adding change proofs:", readyChangeProofs.map(p => p.amount));
        addProofsToMint(activeMint, readyChangeProofs);
        changeAmount = readyChangeProofs.reduce((sum, p) => sum + p.amount, 0);

        console.log("Proofs added. New count:", currentProofs.length);
        console.log("Calculated balance right now:", balance);
      } else {
        console.warn("Change proofs array was empty after mapping");
      }
    } else {
      console.warn("No change proofs found in response");
    }

    // Final success output
    setDataOutput(prev => ({
      ...prev,
      status: "Success",
      success: `Melt OK - invoice paid! ${isWrappedError ? '(wrapped success detected)' : ''}`,
      preimage: effectiveResult.quote?.payment_preimage || effectiveResult.payment_preimage || "—",
      amountPaid: quote.amount,
      feeReserve: quote.fee_reserve,
      changeReceived: changeAmount,
      estimatedNewBalance: (balance ?? 0) - quote.amount - quote.fee_reserve + changeAmount,
      fullMeltResult: meltResult,
      changeProofsAdded: changeAmount > 0 ? changeArray : null,
    }));

    setFormData(prev => ({ ...prev, meltInvoice: "" }));

  } catch (err) {
    console.error("Melt error:", err);
    setDataOutput({
      error: "Melt failed",
      details: err.message || String(err),
      stack: err.stack,
    });
  }
};

const handleSwapSend = async () => {
  const amount = parseInt(formData.swapAmount, 10);
  if (isNaN(amount) || amount <= 0) {
    return setDataOutput({ error: "Enter a valid amount" });
  }

  if (!activeMint) {
    return setDataOutput({ error: "No active mint selected" });
  }

  // Recreate fresh wallet every time (long-term fix)
  let currentWallet;
  try {
    const mint = new Mint(activeMint);
    currentWallet = new Wallet(mint);
    await currentWallet.loadMint();

    if (!currentWallet.keys?.id) {
      throw new Error("Failed to load mint keys for swap");
    }

    console.log("[SWAP] Fresh wallet loaded with keyset ID:", currentWallet.keys.id);
  } catch (err) {
    console.error("[SWAP] Wallet recreation failed:", err);
    return setDataOutput({
      error: "Wallet initialization failed",
      details: "Click 'Set Mint' again",
    });
  }

  console.log("=== SWAP START ===");
  console.log("Requested amount:", amount);
  console.log("Available proofs:", currentProofs.map(p => ({ amount: p.amount, id: p.id || "missing" })));

  // Permissive selection — allow overspend + change (same logic as melt)
  const proofs = currentProofs.filter(p => p.id === currentWallet.keys.id);

  // Greedy: largest first (optional but recommended)
  proofs.sort((a, b) => b.amount - a.amount);

  console.log("Selected proofs:", proofs.map(p => p.amount));
  console.log("Total selected:", proofs.reduce((sum, p) => sum + p.amount, 0));

  if (proofs.length === 0 || proofs.reduce((sum, p) => sum + p.amount, 0) < amount) {
    return setDataOutput({
      error: "Insufficient balance",
      details: `Need ${amount} sat, have ${balance} sat`,
    });
  }

  try {
    console.log("[SWAP] Calling wallet.send...");
    const result = await currentWallet.send(amount, proofs);
    const { keep, send } = result;

    console.log("[SWAP] Change returned:", keep.map(p => p.amount));
    console.log("[SWAP] Spent proofs:", send.map(p => p.amount));
    console.log("[SWAP] Total change value:", keep.reduce((sum, p) => sum + p.amount, 0));

    const encodedToken = getEncodedToken({
      token: [{ mint: activeMint, proofs: send }],
    });

    console.log("[SWAP] Token generated");

    // Update storage
    removeProofsFromMint(activeMint, proofs);  // remove spent
    addProofsToMint(activeMint, keep);         // add change back

    setDataOutput(encodedToken);
  } catch (err) {
    console.error("[SWAP] Error:", err);
    setDataOutput({
      error: "Swap failed",
      message: err.message || String(err),
      hint: "Check console for details",
    });
  }
};

const handleSwapClaim = async () => {
  // Relaxed guard
  if (!wallet || (!wallet.keys?.id && (!wallet.keysets || wallet.keysets.length === 0))) {
    return setDataOutput({ 
      error: "Wallet not ready", 
      details: "Mint keys/keysets missing — click 'Set Mint' again"
    });
  }

  const token = formData.swapToken.trim();
  if (!token) return setDataOutput({ error: "Enter a token" });

  try {
    const { token: newToken } = await wallet.receive(token);
    const proofs = newToken.token[0].proofs;

    addProofsToMint(activeMint, proofs);
    setDataOutput({ status: "Claimed", count: proofs.length });
  } catch (error) {
    console.error("[SWAP CLAIM] Error:", error);
    setDataOutput({ error: "Claim failed", details: error.message });
  }
};

  return (
    <main >
      <div className="cashu-operations-container">
        <div className="section">
          <label htmlFor="mint-url">Mint URL:</label>
          <input
            type="text"
            name="mintUrl"
            className="mint-url"
            value={formData.mintUrl}
            onChange={handleChange}
          />
          <button className="mint-connect-button" onClick={handleSetMint}>
            Set Mint
          </button>
        </div>

        <div className="section">
          <h2>Minting Tokens</h2>
          <label htmlFor="mint-amount">Amount:</label>
          <input
            id="mintAmountInput"
            type="number"
            name="mintAmount"
            className="mint-amount"
            value={formData.mintAmount}
            onChange={handleChange}
          />
          <button className="mint-button" onClick={handleMint}>
            Mint
          </button>
        </div>

        <div className="section">
          <h2>Melt Tokens</h2>
          <label htmlFor="melt-invoice">Bolt11 Invoice:</label>
          <input
            id="meltInvoiceInput"
            type="text"
            name="meltInvoice"
            className="melt-invoice"
            value={formData.meltInvoice}
            onChange={handleChange}
          />
          <button className="melt-button" onClick={handleMelt}>
            Melt
          </button>
        </div>

        <div className="section">
          <h2>Swap Tokens</h2>
          <label htmlFor="swap-amount">Amount:</label>
          <input
            id="swapAmountInput"
            type="number"
            name="swapAmount"
            className="swap-amount"
            value={formData.swapAmount}
            onChange={handleChange}
          />

          <button 
            className="swap-send-button" 
            onClick={handleSwapSend}
            disabled={!walletReady}
          >
            {walletReady ? "Swap to Send" : "Wallet Loading..."}
          </button>


          <label htmlFor="swap-token">Token:</label>
          <input
            id="swapTokenInput"
            type="text"
            name="swapToken"
            className="swap-token"
            value={formData.swapToken}
            onChange={handleChange}
          />
          <button className="swap-claim-button" onClick={handleSwapClaim}>
            Swap to Claim
          </button>
        </div>
      </div>

      <div className="data-display-container">
        {hydrated ? (
          <>
        <h2>
          Balance: {balance} sat 
          {activeMint && proofsByMint[activeMint] && (
            <small> ({proofsByMint[activeMint].reduce((sum, p) => sum + p.amount, 0)} from this mint)</small>
          )}
        </h2>
        <p>Current mint: {activeMint || "None"}</p>
          </>
        ) : (
          <h2>Balance: … sat</h2>
        )}
        <pre id="data-output" className="data-output">
          {JSON.stringify(dataOutput, null, 2)}
        </pre>
      </div>
    </main>
  );
};

export default CocoaWallet;