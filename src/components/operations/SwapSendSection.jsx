// src/components/operations/SwapSendSection.jsx
import React from "react";

export default function SwapSendSection({
  swapAmount,
  onChange,
  onSwapSend,
  isProcessing,
  walletReady,
}) {
  return (
    <div className="section">
      <h2>4. Swap → Send</h2>
      <label htmlFor="swapAmountInput">Amount to send (sat)</label>
      <input
        id="swapAmountInput"
        type="number"
        name="swapAmount"
        value={swapAmount}
        onChange={onChange}
        style={{ width: "100%", padding: "10px", marginBottom: "8px", color: "#111111", }}
      />
      <button
        onClick={() => onSwapSend(swapAmount)}
        disabled={!walletReady || isProcessing}
      >
        {walletReady ? "Create Token (Send)" : "Wallet loading..."}
      </button>
    </div>
  );
}