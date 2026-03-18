import useProofStorage from "@/hooks/useProofStorage";
import { Mint, Wallet, getEncodedTokenV4, getDecodedToken} from "@cashu/cashu-ts";
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
  addProofsToMint,
  addProofs,          
  removeProofs
} = useProofStorage();

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
        id: p.id || wallet.keys?.id || wallet.keysets?.find(ks => ks.active)?.id, // fallback chain // ← ensure id is set
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

/*P2PK

const handleSwapSend = async () => {
  const requestedAmount = parseInt(formData.swapAmount, 10);
  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    setDataOutput({ error: "Enter a valid amount > 0" });
    return;
  }

  if (!wallet || !activeMint) {
    setDataOutput({ error: "Wallet or mint not ready" });
    return;
  }

  // 1. Select proofs locally
  const selectedProofs = getProofsByAmount(requestedAmount);

  if (selectedProofs.length === 0 ||
      selectedProofs.reduce((sum, p) => sum + (p?.amount ?? 0), 0) < requestedAmount) {
    setDataOutput({
      error: "Insufficient balance",
      details: `Need ${requestedAmount} sat, available: ${balance ?? 0} sat`
    });
    return;
  }

  console.log("[SWAP SEND] Preparing to send", selectedProofs.length, "proofs →",
    selectedProofs.map(p => p?.amount ?? '?'), "sat total");

  // P2PK pubkey (you need to have this - from Nostr or generated)
  const pubkey = "your_pubkey_here"; // ← replace with real pubkey (npub or hex)

  try {
    // 2. Build P2PK send operation
    const op = wallet.ops
      .send(requestedAmount, selectedProofs)
      .asP2PK({ pubkey })           // ← lock to pubkey
      .includeFees(true);           // sender pays receiver's future fee

    // Execute
    const result = await op.run();

    const sendProofs = result.send ?? [];
    const keepProofs = result.keep ?? result.returnChange ?? result.change ?? [];

    console.log("[SWAP RESULT]", {
      sendCount: sendProofs.length,
      keepCount: keepProofs.length
    });

    // 3. Defensive cleanup
    const safeSend = sendProofs
      .filter(p => p && typeof p === 'object' && p.secret?.length >= 64)
      .map(p => ({
        id: p.id ?? activeKeysetId ?? null,
        amount: Number(p.amount ?? 0),
        secret: (p.secret ?? '').trim(),
        C: p.C ?? ""
      }));

    const safeKeep = keepProofs
      .filter(p => p && typeof p === 'object' && p.secret?.length >= 64)
      .map(p => ({
        id: p.id ?? activeKeysetId ?? null,
        amount: Number(p.amount ?? 0),
        secret: (p.secret ?? '').trim(),
        C: p.C ?? ""
      }));

    let finalSend = safeSend;
    let finalKeep = safeKeep;

    if (safeSend.length === 0 && safeKeep.length > 0) {
      console.warn("[SWAP] Empty send — using keep as token to send");
      finalSend = safeKeep;
      finalKeep = [];
    }

    if (finalSend.length === 0) {
      throw new Error("No valid send proofs after cleanup");
    }

    // 4. Create real token string with getEncodedTokenV4
    const tokenData = {
      mint: activeMint,
      proofs: finalSend
    };

    const tokenString = getEncodedTokenV4(tokenData);

    console.log("[REAL V4 TOKEN STRING]", tokenString);

    // 5. Update storage
    removeProofs(selectedProofs);
    if (finalKeep.length > 0) {
      addProofs(finalKeep);
    }

    // 6. Success — show token string
    setDataOutput({
      status: "P2PK Token ready to send",
      classicTokenString: tokenString,
      sentAmount: finalSend.reduce((s, p) => s + (p?.amount ?? 0), 0),
      sentCount: finalSend.length,
      changeAmount: finalKeep.reduce((s, p) => s + (p?.amount ?? 0), 0),
      changeCount: finalKeep.length,
      message: "Copy the token string below (cashuA...) and send it to the receiver. They can redeem it with their private key."
    });

    setFormData(prev => ({ ...prev, swapAmount: "" }));

  } catch (err) {
    console.error("[SWAP ERROR FULL]", err);
    setDataOutput({
      error: "Swap failed",
      message: err.message || String(err),
      hint: "Check console — library or mint issue"
    });
  }
};

Normal One

const handleSwapSend = async () => {
  const requestedAmount = parseInt(formData.swapAmount, 10);
  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    setDataOutput({ error: "Enter a valid amount > 0" });
    return;
  }

  if (!wallet || !activeMint) {
    setDataOutput({ error: "Wallet or mint not ready" });
    return;
  }

  // 1. Select proofs locally
  const selectedProofs = getProofsByAmount(requestedAmount);

  if (selectedProofs.length === 0 ||
      selectedProofs.reduce((sum, p) => sum + (p?.amount ?? 0), 0) < requestedAmount) {
    setDataOutput({
      error: "Insufficient balance",
      details: `Need ${requestedAmount} sat, available: ${balance ?? 0} sat`
    });
    return;
  }

  console.log("[SWAP SEND] Preparing to send", selectedProofs.length, "proofs →",
    selectedProofs.map(p => p?.amount ?? '?'), "sat total");

  try {
    // 2. Modern send (v3+ API)
    const { keep, send } = await wallet.send(requestedAmount, selectedProofs);

    console.log("[SWAP RESULT]", {
      sendCount: send.length,
      keepCount: keep.length
    });

    // 3. Defensive cleanup (important!)
    const safeSend = send
      .filter(p => p && typeof p === 'object' && p.secret?.length >= 64)
      .map(p => ({
        id: p.id ?? activeKeysetId ?? null,
        amount: Number(p.amount ?? 0),
        secret: (p.secret ?? '').trim(),
        C: p.C ?? ""
      }));

    const safeKeep = keep
      .filter(p => p && typeof p === 'object' && p.secret?.length >= 64)
      .map(p => ({
        id: p.id ?? activeKeysetId ?? null,
        amount: Number(p.amount ?? 0),
        secret: (p.secret ?? '').trim(),
        C: p.C ?? ""
      }));

    if (safeSend.length === 0) {
      throw new Error("No valid send proofs after cleanup");
    }

    // 4. Create real token string with getEncodedTokenV4
    const tokenData = {
      mint: activeMint,
      proofs: safeSend
    };

    const tokenString = getEncodedTokenV4(tokenData);

    console.log("[REAL V4 TOKEN STRING]", tokenString);

    // 5. Update storage
    removeProofs(selectedProofs);           // remove spent
    if (safeKeep.length > 0) {
      addProofs(safeKeep);                  // add change
    }

    // 6. Success — show token string
    setDataOutput({
      status: "Token created successfully",
      classicTokenString: tokenString,
      sentAmount: safeSend.reduce((s, p) => s + (p?.amount ?? 0), 0),
      sentCount: safeSend.length,
      changeAmount: safeKeep.reduce((s, p) => s + (p?.amount ?? 0), 0),
      changeCount: safeKeep.length,
      message: "Copy the token string below (starts with cashuA...) and paste it into Cashu.me, Nutstash, Alby or any wallet to receive it."
    });

    setFormData(prev => ({ ...prev, swapAmount: "" }));

  } catch (err) {
    console.error("[SWAP ERROR FULL]", err);
    setDataOutput({
      error: "Swap failed",
      message: err.message || String(err),
      hint: "Check console — possible library or mint issue"
    });
  }
};*/

const handleSwapSend = async () => {
  const requestedAmount = parseInt(formData.swapAmount, 10);
  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    setDataOutput({ error: "Enter a valid amount > 0" });
    return;
  }

  if (!wallet || !activeMint) {
    setDataOutput({ error: "Wallet or mint not ready" });
    return;
  }

  // 1. Select proofs locally
  const selectedProofs = getProofsByAmount(requestedAmount);

  if (selectedProofs.length === 0 ||
      selectedProofs.reduce((sum, p) => sum + (p?.amount ?? 0), 0) < requestedAmount) {
    setDataOutput({
      error: "Insufficient balance",
      details: `Need ${requestedAmount} sat, available: ${balance ?? 0} sat`
    });
    return;
  }

  console.log("[SWAP SEND] Preparing to send", selectedProofs.length, "proofs →",
    selectedProofs.map(p => p?.amount ?? '?'), "sat total");

  try {
    // 2. Modern v3+ API: build and run send operation
    const op = wallet.ops.send(requestedAmount, selectedProofs);

    // Optional customizations (uncomment as needed)
    // op.keepAsRandom();                  // random change secrets
    // op.includeFees(true);               // sender pays receiver fee
    // op.offlineExactOnly();              // try offline exact match first

    // Execute the swap
    const result = await op.run();

    // result contains send + keep/returnChange/change
    const sendProofs = result.send ?? [];
    const keepProofs = result.keep ?? result.returnChange ?? result.change ?? [];

    console.log("[SWAP RESULT]", {
      sendCount: sendProofs.length,
      keepCount: keepProofs.length
    });

    // 3. Defensive cleanup
    const safeSend = sendProofs
      .filter(p => p && typeof p === 'object' && p.secret?.length >= 64)
      .map(p => ({
        id: p.id ?? activeKeysetId ?? null,
        amount: Number(p.amount ?? 0),
        secret: (p.secret ?? '').trim(),
        C: p.C ?? ""
      }));

    const safeKeep = keepProofs
      .filter(p => p && typeof p === 'object' && p.secret?.length >= 64)
      .map(p => ({
        id: p.id ?? activeKeysetId ?? null,
        amount: Number(p.amount ?? 0),
        secret: (p.secret ?? '').trim(),
        C: p.C ?? ""
      }));

    let finalSend = safeSend;
    let finalKeep = safeKeep;

    if (safeSend.length === 0 && safeKeep.length > 0) {
      console.warn("[SWAP] Empty send — using keep as token to send");
      finalSend = safeKeep;
      finalKeep = [];
    }

    if (finalSend.length === 0) {
      throw new Error("No valid send proofs after cleanup");
    }

    // 4. Create real v4 token string
    const tokenData = {
      mint: activeMint,
      proofs: finalSend
    };

    const tokenString = getEncodedTokenV4(tokenData);

    console.log("[REAL V4 TOKEN STRING]", tokenString);

    // 5. Update storage
    removeProofs(selectedProofs);
    if (finalKeep.length > 0) {
      addProofs(finalKeep);
    }

    // 6. Success — show token string
    setDataOutput({
      status: "Token created successfully",
      classicTokenString: tokenString,
      sentAmount: finalSend.reduce((s, p) => s + (p?.amount ?? 0), 0),
      sentCount: finalSend.length,
      changeAmount: finalKeep.reduce((s, p) => s + (p?.amount ?? 0), 0),
      changeCount: finalKeep.length,
      message: "Copy the token string below (starts with cashuA...) and paste it into Cashu.me, Nutstash, Alby or any wallet to receive it."
    });

    setFormData(prev => ({ ...prev, swapAmount: "" }));

  } catch (err) {
    console.error("[SWAP ERROR FULL]", err);
    setDataOutput({
      error: "Swap failed",
      message: err.message || String(err),
      hint: "Check console — library or mint issue"
    });
  }
};

const handleSwapClaim = async () => {
  if (!wallet || (!wallet.keys?.id && (!wallet.keysets || wallet.keysets.length === 0))) {
    return setDataOutput({ 
      error: "Wallet not ready", 
      details: "Mint keys/keysets missing — click 'Set Mint' again"
    });
  }

  const tokenString = formData.swapToken.trim();
  if (!tokenString) return setDataOutput({ error: "Enter a token" });

  try {
    console.log("[CLAIM] Starting claim with token:", tokenString.substring(0, 50) + "...");

    // Decode to validate
    const decoded = getDecodedToken(tokenString);
    console.log("[CLAIM] Decoded token:", {
      mint: decoded.mint,
      unit: decoded.unit || "unknown",
      proofsCount: decoded.proofs?.length || 0,
      totalAmount: decoded.proofs?.reduce((s, p) => s + (p.amount || 0), 0) || 0
    });

    // Optional: force outputs for small amounts (helps with mint policy)
    const totalAmount = decoded.proofs?.reduce((s, p) => s + (p.amount || 0), 0) || 0;
    const outputs = totalAmount > 0 ? [{ amount: totalAmount }] : []; // simple: request same amount back

    console.log("[CLAIM] Receiving with outputs:", outputs);

    // Receive with explicit outputs (fixes "no outputs provided")
    const receiveResult = await wallet.receive(tokenString, { outputs });

    console.log("[CLAIM] Full receive result:", JSON.stringify(receiveResult, null, 2));

    const receivedProofs = receiveResult.proofs ?? receiveResult.token?.proofs ?? [];

    if (receivedProofs.length === 0) {
      console.warn("[CLAIM] Mint returned no proofs — token may be spent or mint issue");
      throw new Error("No proofs received from mint (token may be already redeemed or mint policy error)");
    }

    console.log("[CLAIM] Received proofs:", receivedProofs.length, "amounts:", 
      receivedProofs.map(p => p.amount || "?"));

    addProofsToMint(activeMint, receivedProofs);

    const receivedAmount = receivedProofs.reduce((sum, p) => sum + (p.amount || 0), 0);

    setDataOutput({
      status: "Claim successful",
      receivedCount: receivedProofs.length,
      receivedAmount: receivedAmount,
      message: `Claimed ${receivedProofs.length} proofs (${receivedAmount} sat). Added to your wallet.`
    });

    setFormData(prev => ({ ...prev, swapToken: "" }));

  } catch (error) {
    console.error("[SWAP CLAIM] Error:", error);

    let userMessage = "Claim failed";
    let details = error.message || String(error);

    if (error.message.includes("no outputs provided") || error.message.includes("outputs")) {
      userMessage = "Mint rejected claim (no outputs)";
      details = "The mint could not provide new proofs. Try a different amount or mint.";
    } else if (error.message.includes("no proofs") || error.message.includes("spent")) {
      userMessage = "Token already redeemed or spent";
      details = "This token was likely claimed before. Send a **new** token and claim it immediately.";
    } else if (error.message.includes("witness") || error.message.includes("p2pk")) {
      userMessage = "P2PK token requires private key";
      details = "This token is P2PK-locked. You need the private key to claim it.";
    } else if (error.message.includes("invalid") || error.message.includes("decode")) {
      userMessage = "Invalid token format";
      details = "The pasted string is not a valid Cashu token. Make sure it's complete and starts with cashuA...";
    }

    setDataOutput({
      error: userMessage,
      message: details,
      hint: "Send a new token and claim it right away. Try pasting into Cashu.me to test."
    });
  }
};

  return (
  <main>
    <div className="cashu-operations-container">

      {/* Mint URL section */}
      <div className="section">
        <label htmlFor="mintUrlInput">Mint URL:</label>
        <input
          id="mintUrlInput"                     // ← added missing id
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

      {/* Minting Tokens */}
      <div className="section">
        <h2>Minting Tokens</h2>
        <label htmlFor="mintAmountInput">Amount:</label>
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

      {/* Melt Tokens */}
      <div className="section">
        <h2>Melt Tokens</h2>
        <label htmlFor="meltInvoiceInput">Bolt11 Invoice:</label>
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

      {/* Swap Tokens */}
      <div className="section">
        <h2>Swap Tokens</h2>

        <label htmlFor="swapAmountInput">Amount:</label>
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

        <label htmlFor="swapTokenInput">Token:</label>
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
              <small>
                {' '}
                ({proofsByMint[activeMint].reduce((sum, p) => sum + p.amount, 0)} from this mint)
              </small>
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