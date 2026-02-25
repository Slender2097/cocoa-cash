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
    const maxAttempts = 12;

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
    setDataOutput({ error: "No wallet" });
    return;
  }

  const invoice = formData.meltInvoice?.trim();
  if (!invoice) {
    setDataOutput({ error: "No invoice" });
    return;
  }

  try {
    const quote = await wallet.createMeltQuoteBolt11(invoice);
    setDataOutput({ "Melt quote": quote });

    const totalNeeded = quote.amount + quote.fee_reserve;

    // Better: use wallet.send() for selection + change handling (more reliable in cashu-ts)
    const { send: proofsToSpend, returnChange } = await wallet.send(totalNeeded, currentProofs);

    if (proofsToSpend.length === 0) {
      alert("No suitable proofs for melt (balance may be fragmented)");
      return;
    }

    console.log("Proofs selected to spend:", proofsToSpend.map(p => ({amount: p.amount, secret: p.secret.slice(0,10)})));

    const meltResult = await wallet.meltProofsBolt11(quote, proofsToSpend, {
      keysetId: wallet.keys?.id,
    });

    console.log("Full meltResult:", JSON.stringify(meltResult, null, 2));

    if (meltResult.paid) {
      // Remove spent proofs (critical!)
      hookRemoveProofs(proofsToSpend);

      // Add change if any
      if (meltResult.change?.length > 0 || returnChange?.length > 0) {
        const changeToAdd = meltResult.change || returnChange || [];
        hookAddProofs(changeToAdd);
        console.log("Added change:", changeToAdd.map(p => ({amount: p.amount, secret: p.secret.slice(0,10)})));
      }

      // Force re-render + UI update (sometimes React misses state change)
      setTimeout(() => {
        setDataOutput(prev => ({
          ...prev,
          success: "Melt successful! Invoice paid.",
          preimage: meltResult.preimage || "-",
          spent: totalNeeded,
          changeReceived: (meltResult.change || []).reduce((s, p) => s + p.amount, 0),
          newBalanceEstimate: balance - totalNeeded + (meltResult.change || []).reduce((s, p) => s + p.amount, 0)
        }));
      }, 100);

      setFormData(prev => ({ ...prev, meltInvoice: "" }));
    } else {
      setDataOutput({
        error: "Mint paid invoice but meltResult.paid = false",
        details: meltResult
      });
    }
  } catch (err) {
    console.error("Melt error:", err);
    setDataOutput({
      error: "Melt failed",
      details: err.message || String(err)
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