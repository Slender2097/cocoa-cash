/*import useProofStorage from "@/hooks/useProofStorage";
import { Mint, Wallet, getEncodedTokenV4, getDecodedToken} from "@cashu/cashu-ts";
import React, { useState, useEffect, useRef } from "react";

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
  const [isProcessing, setIsProcessing] = useState(false);
  const isRestored = useRef(false);
  const [pendingMints, setPendingMints] = useState([]);

const {
  addProofs,
  balance,
  removeProofs: hookRemoveProofs,
  getProofsByAmount,
  activeMint,         
  switchMint,   
  hydrated,
  currentProofs, 
  proofsByMint,                         
  addProofsToMint,      
  removeProofs
} = useProofStorage();

const replacer = (key, value) => 
  typeof value === 'bigint' ? value.toString() + 'n' : value;

const reviver = (key, value) => {
  if (typeof value === 'string' && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
};

useEffect(() => {
  if (typeof window === 'undefined') return;

  const saved = localStorage.getItem("pendingMints");
  if (saved) {
    try {
      const parsed = JSON.parse(saved, reviver);
      if (Array.isArray(parsed)) {
        setPendingMints(parsed);
        console.log(`[PENDING] Loaded ${parsed.length} pending mint(s)`);
      }
    } catch (e) {
      console.error("[PENDING] Load failed", e);
      localStorage.removeItem("pendingMints");
    }
  }
}, []);

// Auto-resume pending mints + recovery
useEffect(() => {
  // Ensure wallet exists AND has finished loadMint() before proceeding
  if (!wallet || !wallet.keys?.id || !hydrated || pendingMints.length === 0) {
    return;
  }

  console.log("[WATCHER] Wallet ready. Checking", pendingMints.length, "pending mint(s)...");

  pendingMints.forEach((pending) => {
    if (pending.mintUrl !== activeMint) return;

    if (pending.preview && pending.state === "ISSUED") {
      recoverMint(pending.preview, pending.id, pending.mintUrl);
    } else {
      pollMintQuote(pending.id, pending.amount, pending.mintUrl);
    }
  });
}, [wallet, hydrated, activeMint, pendingMints.length]);

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
  let url = formData.mintUrl.trim();
  if (!url) {
    setDataOutput({ error: "Enter a mint URL" });
    return;
  }
  if (!url.endsWith('/')) url += '/';

  try {
    console.log("[SET MINT] Connecting to", url);
    const mint = new Mint(url);
    const info = await mint.getInfo();
    const newWallet = new Wallet(mint, { unit: "sat" });

    console.log("[SET MINT] Calling loadMint()...");
    await newWallet.loadMint();

    const rawKeys = await mint.getKeys();
    console.log("[SET MINT] Raw keysets from mint.getKeys():", rawKeys);

    if (!rawKeys?.keysets?.length) {
      throw new Error("Mint returned no keysets");
    }

    const keysets = rawKeys.keysets;
    const satKeyset = keysets.find(ks => ks.unit === "sat" && ks.active === true) ||
                      keysets.find(ks => ks.unit === "sat") ||
                      keysets[0];

    if (!satKeyset?.id) {
      throw new Error("No sat keyset found");
    }

    // ←←← BIND WITH FULL 64-CHAR ID (this is what the library expects)
    const fullKeysetId = satKeyset.id;
    console.log("[SET MINT] Binding to FULL keyset ID:", fullKeysetId);

    newWallet.bindKeyset(fullKeysetId);
    await newWallet.loadMint();

    const finalKeysetId = newWallet.keys?.id || newWallet.keysetId;
    console.log("[SET MINT] SUCCESS - Active keyset:", finalKeysetId);

    setWallet(newWallet);
    setWallets(prev => ({ ...prev, [url]: newWallet }));
    setWalletReady(true);
    localStorage.setItem("activeMint", url);
    switchMint(url);
    setFormData(prev => ({ ...prev, mintUrl: url }));

    setDataOutput({
      status: "Mint connected ✓ (sats only)",
      keysId: finalKeysetId,
      info
    });
  } catch (error) {
    console.error("[SET MINT] Failed:", error);
    setWalletReady(false);
    setDataOutput({
      error: "Connection failed",
      details: error.message
    });
  }
};

// === MAIN MINT FUNCTION ===
const handleMint = async () => {
  const amount = parseInt(formData.mintAmount);
  if (isNaN(amount) || amount <= 0) {
    setDataOutput({ error: "Enter amount > 0" });
    return;
  }

  const mintUrl = activeMint || formData.mintUrl.trim();
  if (!mintUrl || !wallet) {
    setDataOutput({ error: "Wallet or mint not ready" });
    return;
  }

  setIsProcessing(true);

  try {
    console.log("[MINT] Creating quote for", amount, "sat");

    const quote = await wallet.createMintQuoteBolt11(amount);

    const pendingEntry = {
      id: quote.quote,
      amount,
      mintUrl,
      state: "UNPAID",
      timestamp: Date.now(),
      invoice: quote.request
    };

    const updatedMints = [...pendingMints, pendingEntry];

    setPendingMints(updatedMints);
    localStorage.setItem("pendingMints", JSON.stringify(updatedMints, replacer));

    setDataOutput({
      status: "Invoice created",
      invoice: quote.request,
      quoteId: quote.quote,
      amount,
      message: "Pay this Lightning invoice in any wallet (Zeus, Alby, Strike...)"
    });

    pollMintQuote(quote.quote, amount, mintUrl);

  } catch (err) {
    console.error("[MINT] Quote creation failed:", err);
    setDataOutput({ error: "Failed to create invoice", details: err.message });
  } finally {
    setIsProcessing(false);
  }
};

// === POLLING + PREPARE/COMPLETE ===
const pollMintQuote = async (quoteId, amount, mintUrl) => {
  const check = async () => {
    try {
      const checked = await wallet.checkMintQuoteBolt11(quoteId);

      if (checked.state === "PAID" || checked.state === "ISSUED") {
        console.log(`[MINT] Quote ${quoteId} paid → preparing proofs`);

        // Prepare locally
        const preview = await wallet.ops.mintBolt11(amount, quoteId).prepare();

        // Save preview safely with BigInt support
        setPendingMints((prev) => {
          const updated = prev.map((p) =>
            p.id === quoteId ? { ...p, preview, state: "ISSUED" } : p
          );
          localStorage.setItem("pendingMints", JSON.stringify(updated, replacer));
          return updated;
        });

        // Complete the mint
        const proofs = await wallet.completeMint(preview);

        if (proofs?.length > 0) {
          addProofsToMint(mintUrl, proofs);

          // Remove from pending safely
          setPendingMints((prev) => {
            const remaining = prev.filter((p) => p.id !== quoteId);
            localStorage.setItem("pendingMints", JSON.stringify(remaining, replacer));
            return remaining;
          });

          setDataOutput({
            status: "Mint successful ✓",
            receivedProofs: proofs.length,
            totalAmount: proofs.reduce((sum, p) => sum + p.amount, 0),
          });
        }
        return;
      }

      // Still pending
      setTimeout(check, 5000);
    } catch (err) {
      console.error(`[POLL ${quoteId}] Error:`, err);
      setTimeout(check, 10000);
    }
  };

  check();
};

// === RECOVERY FUNCTION ===
const recoverMint = async (preview, quoteId, mintUrl) => {
  try {
    console.log("[RECOVER] Recovering mint:", quoteId);

    const proofs = await wallet.completeMint(preview);

    if (proofs?.length > 0) {
      addProofsToMint(mintUrl, proofs);

      setPendingMints((prev) => {
        const remaining = prev.filter((p) => p.id !== quoteId);
        localStorage.setItem("pendingMints", JSON.stringify(remaining, replacer));
        return remaining;
      });

      setDataOutput({
        status: "Recovered mint ✓",
        receivedProofs: proofs.length,
        totalAmount: proofs.reduce((sum, p) => sum + p.amount, 0),
        message: "Recovered from previous session"
      });
    }
  } catch (err) {
    console.error("[RECOVER] Failed:", err);
  }
};

const handleMelt = async () => {
  if (!wallet) {
    return setDataOutput({ error: "No wallet connected" });
  }

  // Auto-reload if keys are missing
  if (!wallet.keys?.id && !wallet.keysetId) {
    try {
      await wallet.loadMint();
    } catch (e) {
      return setDataOutput({ 
        error: "Wallet connection lost", 
        details: "Click 'Set Mint' again" 
      });
    }
  }

  const invoice = formData.meltInvoice?.trim();
  if (!invoice) {
    return setDataOutput({ error: "Please enter a Bolt11 invoice" });
  }

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

    if (!isPaid) {
      throw new Error("Mint could not pay the invoice");
    }

    // Remove spent proofs
    removeProofs(proofsToSpend);

    // Handle change proofs — with keyset repair
    let changeAmount = 0;
    const changeArray = effective.change || effective.quote?.change || [];

    if (Array.isArray(changeArray) && changeArray.length > 0) {
      const currentKeysetId = wallet.keys?.id || wallet.keysetId;

      const readyChange = changeArray.map(p => ({
        secret: p.secret,
        C: p.C || p.C_,
        amount: Number(p.amount),
        id: p.id || currentKeysetId,        // ← important
      }));

      // Pass keysetId to repair any missing IDs
      addProofsToMint(activeMint, readyChange, currentKeysetId);

      changeAmount = readyChange.reduce((sum, p) => sum + p.amount, 0);
      console.log(`[MELT] Added ${changeAmount} sat change with keyset ${currentKeysetId}`);
    }

    const netSent = quote.amount;

    setDataOutput({
      status: "Success ✓",
      success: `Paid ${netSent} sats successfully!`,
      preimage: effective.payment_preimage || effective.quote?.payment_preimage || "N/A",
      amountPaid: netSent,
      feeReserve: quote.fee_reserve,
      changeReceived: changeAmount,
      estimatedNewBalance: balance - netSent - quote.fee_reserve + changeAmount,
    });

    setFormData(prev => ({ ...prev, meltInvoice: "" }));

  } catch (err) {
    console.error("[MELT ERROR]", err);
    setDataOutput({
      error: "Melt failed",
      details: err.message || String(err)
    });
  } finally {
    setIsProcessing(false);
  }
};

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

  if (!wallet.keys?.id && !wallet.keysetId) {
    console.log(" [RECOVERY] No active keyset → calling loadMint()");
    try { await wallet.loadMint(); } catch (e) { console.error("[RECOVERY] Failed", e); }
  }

  const activeKeysetId = wallet.keys?.id || wallet.keysetId;
  if (!activeKeysetId) {
    return setDataOutput({ error: "No active keyset found", details: "Click 'Set Mint' again" });
  }

  const shortKeysetId = activeKeysetId.slice(0, 16);   // ← "general ID" for tokens

  const selectedProofs = getProofsByAmount(requestedAmount);
  const selectedTotal = selectedProofs.reduce((sum, p) => sum + (p?.amount ?? 0), 0);

  if (selectedProofs.length === 0 || selectedTotal < requestedAmount) {
    setDataOutput({ error: "Insufficient balance", details: `Need ${requestedAmount} sat, available: ${balance ?? 0} sat` });
    return;
  }

  try {
    console.log(`[SEND] Creating V4 token using short general ID: ${shortKeysetId}`);

    const result = await wallet.ops.send(requestedAmount, selectedProofs).run();
    const sendProofs = result.send ?? [];

    const finalSend = sendProofs
      .filter(p => p && typeof p === 'object' && p.secret?.length >= 64)
      .map(p => ({
        id: shortKeysetId,           // ← short ID in token
        amount: Number(p.amount),
        secret: p.secret,
        C: p.C,
        ...(p.dleq && { dleq: p.dleq })
      }));

    console.log("FINAL PROOFS KEYSET IDs in token:", finalSend.map(p => p.id));

    const normalizedMint = activeMint.trim().replace(/\/+$/, "");
    const tokenData = { mint: normalizedMint, proofs: finalSend, unit: "sat" };

    const tokenString = getEncodedTokenV4(tokenData);

    console.log(" [V4 TOKEN CREATED]");
    console.log("   • token starts with:", tokenString.substring(0, 10) + "...");
    console.log("   • full token   :", tokenString.substring(0, 120) + "...");

    removeProofs(selectedProofs);
    if (result.keep && result.keep.length > 0) addProofs(result.keep);

    setDataOutput({
      status: "V4 Token created successfully",
      classicTokenString: tokenString,
      sentAmount: finalSend.reduce((s, p) => s + (p.amount ?? 0), 0),
      sentCount: finalSend.length,
      message: "Copy this token and paste it into Nutstash / Cashu.me"
    });

    setFormData(prev => ({ ...prev, swapAmount: "" }));
  } catch (err) {
    console.error(" [V4 SWAP ERROR]", err);
    setDataOutput({ error: "Swap failed", message: err.message || String(err) });
  }
};

const resolveKeysetId = async (shortOrFullId) => {
  if (!shortOrFullId) throw new Error("Missing keyset ID");
  if (shortOrFullId.length >= 64) return shortOrFullId;

  await wallet.loadMint();
  const raw = await wallet.mint.getKeys();
  const fullId = raw.keysets?.find(ks => ks.id?.startsWith(shortOrFullId))?.id;

  if (!fullId) throw new Error(`Couldn't map short keyset ID ${shortOrFullId}`);
  return fullId;
};

const handleSwapClaim = async () => {
  if (isProcessing || !wallet) return;
  setIsProcessing(true);

  const tokenString = formData.swapToken.trim();
  if (!tokenString) {
    setIsProcessing(false);
    return setDataOutput({ error: "Enter a token string" });
  }

  try {
    console.log("[CLAIM] Starting claim with token:", tokenString.substring(0, 60) + "...");

    const decoded = getDecodedToken(tokenString);
    const tokenEntry = decoded.token?.[0] || decoded;

    const tokenMintUrl = tokenEntry.mint?.replace(/\/+$/, "");
    const currentMintUrl = activeMint?.replace(/\/+$/, "");
    if (tokenMintUrl && tokenMintUrl !== currentMintUrl) {
      throw new Error(`Mint mismatch: Token is for ${tokenMintUrl}`);
    }

    const normalizedProofs = await Promise.all(
      (tokenEntry.proofs || []).map(async (p) => ({
        ...p,
        id: await resolveKeysetId(p.id)
      }))
    );

    console.log("[CLAIM] Normalized short → full IDs:", normalizedProofs.map(p => p.id.substring(0, 16) + "..."));

    const normalizedTokenData = {
      mint: tokenEntry.mint || activeMint,
      proofs: normalizedProofs,
      unit: tokenEntry.unit || "sat"
    };
    const normalizedTokenString = getEncodedTokenV4(normalizedTokenData);

    const receiveResult = await wallet.receive(normalizedTokenString);

    let receivedProofs = Array.isArray(receiveResult)
      ? receiveResult
      : (receiveResult.proofs || receiveResult.received || receiveResult.change || []);

    if (receivedProofs.length === 0) throw new Error("No proofs received from mint");

    addProofsToMint(activeMint, receivedProofs);

    const receivedAmount = receivedProofs.reduce((sum, p) => sum + (p.amount || 0), 0);
    setDataOutput({
      status: "Claim successful ✓",
      receivedAmount: receivedAmount,
      receivedCount: receivedProofs.length,
      message: `Added ${receivedAmount} sat`
    });

    setFormData(prev => ({ ...prev, swapToken: "" }));
  } catch (error) {
    console.error("[SWAP CLAIM] Error:", error);
    setDataOutput({ error: "Claim failed", message: error.message || String(error) });
  } finally {
    setIsProcessing(false);
  }
};

  return (
  <main>
    <div className="cashu-operations-container">

      // Mint URL section 
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

      // Minting Tokens 
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

      // Melt Tokens 
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

      // Swap Tokens 
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

export default CocoaWallet;*/

// src/pages/index.jsx
import React, { useState } from "react";
import useCashu from "@/hooks/useCashu";
import useProofStorage from "@/hooks/useProofStorage";

import Navbar from "@/components/layout/Navbar";
import BalanceDisplay from "@/components/layout/BalanceDisplay";
import Footer from "@/components/layout/Footer";

import MintSection from "@/components/operations/MintSection";
import MeltSection from "@/components/operations/MeltSection";
import SwapSendSection from "@/components/operations/SwapSendSection";
import SwapClaimSection from "@/components/operations/SwapClaimSection";

export default function Home() {
  const {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    activeMint,
    hydrated,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
    setDataOutput,
  } = useCashu();

  const { proofsByMint } = useProofStorage();

  const [formData, setFormData] = useState({
    mintUrl: "",
    mintAmount: "",
    meltInvoice: "",
    swapAmount: "",
    swapToken: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <Navbar />
      <main className="max-w-4xl mx-auto p-6">
        <BalanceDisplay balance={balance} activeMint={activeMint} proofsByMint={proofsByMint} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <MintSection
            mintUrl={formData.mintUrl}
            mintAmount={formData.mintAmount}
            onChange={handleChange}
            onSetMint={handleSetMint}
            onMint={handleMint}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <MeltSection
            meltInvoice={formData.meltInvoice}
            onChange={handleChange}
            onMelt={handleMelt}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <SwapSendSection
            swapAmount={formData.swapAmount}
            onChange={handleChange}
            onSwapSend={handleSwapSend}
            isProcessing={isProcessing}
            walletReady={walletReady}
          />
          <SwapClaimSection
            swapToken={formData.swapToken}
            onChange={handleChange}
            onSwapClaim={handleSwapClaim}
            isProcessing={isProcessing}
          />
        </div>

        <pre className="mt-12 p-6 bg-gray-900 text-white rounded-3xl text-sm overflow-auto">
          {JSON.stringify(dataOutput, null, 2)}
        </pre>
      </main>
      <Footer />
    </>
  );
}