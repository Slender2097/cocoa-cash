// src/components/operations/MintSection.jsx
import React from "react";

export default function MintSection({
  mintUrl,
  mintAmount,
  onChange,
  onSetMint,
  onMint,
  isProcessing,
  walletReady,
}) {
  return (
    <div className="section">
      <h2>1. Connect Mint</h2>
      <label htmlFor="mintUrlInput">Mint URL</label>
      <input
        id="mintUrlInput"
        type="text"
        name="mintUrl"
        value={mintUrl}
        onChange={onChange}
        placeholder="https://mint.example.com"
        style={{ width: "100%", padding: "10px", marginBottom: "8px" }}
      />
      <button onClick={() => onSetMint(mintUrl)} disabled={isProcessing}>
        Set Mint
      </button>

      <h2 style={{ marginTop: "2rem" }}>2. Mint Tokens</h2>
      <label htmlFor="mintAmountInput">Amount (sat)</label>
      <input
        id="mintAmountInput"
        type="number"
        name="mintAmount"
        value={mintAmount}
        onChange={onChange}
        style={{ width: "100%", padding: "10px", marginBottom: "8px" }}
      />
      <button onClick={() => onMint(mintAmount)} disabled={isProcessing || !walletReady}>
        Mint
      </button>
    </div>
  );
}