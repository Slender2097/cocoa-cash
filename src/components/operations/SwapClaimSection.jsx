// src/components/operations/SwapClaimSection.jsx
import React from "react";

export default function SwapClaimSection({
  swapToken,
  onChange,
  onSwapClaim,
  isProcessing,
}) {
  return (
    <div className="section">
      <h2>5. Swap → Claim</h2>
      <label htmlFor="swapTokenInput">Token to claim</label>
      <input
        id="swapTokenInput"
        type="text"
        name="swapToken"
        value={swapToken}
        onChange={onChange}
        placeholder="cashuA..."
        style={{ width: "100%", padding: "10px", marginBottom: "8px", color: "#111111", }}
      />
      <button onClick={() => onSwapClaim(swapToken)} disabled={isProcessing}>
        Claim Token
      </button>
    </div>
  );
}