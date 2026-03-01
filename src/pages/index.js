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

const {
  addProofs: hookAddProofs,
  balance,
  removeProofs: hookRemoveProofs,
  getProofsByAmount,
  activeMint,         
  switchMint,   
  hydrated,
  currentProofs,   
} = useProofStorage();


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
      })
      .catch(err => console.error("Failed to load stored mint:", err));
  } catch (err) {
    console.error("Error loading stored mint:", err);
  }
}, []);  // empty array = run once on mount

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
    const mint = new Mint(url);
    const info = await mint.getInfo();
    setDataOutput(info);

    const newWallet = new Wallet(mint);
    await newWallet.loadMint();
    setWallet(newWallet);

    const { keysets } = await mint.getKeys();
    const satKeyset = keysets.find((k) => k.unit === "sat");

    localStorage.setItem(
      `mintData_${url}`,
      JSON.stringify({ url, keyset: satKeyset })
    );

    // This line now works because switchMint is destructured
    switchMint(url);

    setFormData((prev) => ({ ...prev, mintUrl: url }));
  } catch (error) {
    console.error(error);
    setDataOutput({
      error: "Failed to connect to mint",
      details: error.message || String(error),
    });
  }
};

  const handleMint = async () => {
    if (!wallet) {
      setDataOutput({ error: "Wallet not connected" });
      return;
    }

    const amount = parseInt(formData.mintAmount);
    if (isNaN(amount) || amount <= 0) {
      setDataOutput({ error: "Enter amount > 0" });
      return;
    }

    let quote;
    try {
      quote = await wallet.createMintQuoteBolt11(amount);
      setDataOutput(quote);
      console.log("[MINT] Quote created:", quote.state, quote.quote);
    } catch (err) {
      console.error("[MINT] Quote creation failed:", err);
      setDataOutput({ error: "Failed to create quote", details: err.message });
      return;
    }

    let attempts = 0;
    const maxAttempts = 10000;

    const intervalId = setInterval(async () => {
      attempts++;
      console.log(`[MINT] Attempt ${attempts}/${maxAttempts} - checking quote ${quote.quote}`);

      if (attempts > maxAttempts) {
        clearInterval(intervalId);
        setDataOutput({ error: "Mint timed out" });
        return;
      }

      try {
        const checked = await wallet.checkMintQuoteBolt11(quote.quote);
        console.log(`[MINT] State: ${checked.state} (paid: ${checked.paid})`);

        if (checked.state === "PAID" || checked.state === "ISSUED") {
          console.log("[MINT] PAID detected. Trying to mint...");

          const proofs = await wallet.mintProofsBolt11(amount, quote.quote, {
            keysetId: wallet.keys?.id,
          });

          if (proofs && Array.isArray(proofs) && proofs.length > 0) {
            hookAddProofs(proofs);
            setFormData((prev) => ({ ...prev, mintAmount: "" }));

            setDataOutput(prev => ({ ...prev }));
          }

          setDataOutput({ "minted proofs": proofs });
          clearInterval(intervalId);
        }
      } catch (err) {
        console.error("[MINT] Error during check/mint:", err);
        clearInterval(intervalId);
        setDataOutput({ error: "Mint failed", details: err.message });
      }
    }, 5000);
  };


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
        hookAddProofs(readyChangeProofs);
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
};

  const handleSwapSend = async () => {
    const swapAmount = parseInt(formData.swapAmount);
    const proofs = getProofsByAmount(swapAmount);

    if (proofs.length === 0) {
      alert("Insufficient balance");
      return;
    }

    try {
      const { send, returnChange } = await wallet.send(swapAmount, proofs);

      const encodedToken = getEncodedToken({
        token: [{ proofs: send, mint: wallet.mint.mintUrl }],
      });

      hookRemoveProofs(proofs);
      hookAddProofs(returnChange);

      setDataOutput(prev => ({ ...prev }));

      setDataOutput(encodedToken);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to swap tokens", details: error.message });
    }
  };

  

  

  const handleSwapClaim = async () => {
    const token = formData.swapToken;

    try {
      const { token: newToken, tokensWithErrors } = await wallet.receive(token);

      const { proofs } = newToken.token[0];

      hookAddProofs(proofs);
      setDataOutput(proofs);
    } catch (error) {
      console.error(error);
      setDataOutput({ error: "Failed to claim swap tokens", details: error.message });
    }
  };

  return (
    <main>
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
            type="number"
            name="swapAmount"
            className="swap-amount"
            value={formData.swapAmount}
            onChange={handleChange}
          />
          <button className="swap-send-button" onClick={handleSwapSend}>
            Swap to Send
          </button>
          <label htmlFor="swap-token">Token:</label>
          <input
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
            <h2>Balance: {balance} sat</h2>
            {activeMint && <p>Current mint: {activeMint}</p>}
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