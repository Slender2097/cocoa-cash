// src/components/operations/MeltSection.jsx
import React from "react";

export default function MeltSection({
  meltInvoice,
  onChange,
  onMelt,
  isProcessing,
  walletReady,
}) {
  return (
    <div className="section">
      <h2>3. Melt Tokens</h2>
      <label htmlFor="meltInvoiceInput">Bolt11 Invoice</label>
      <input
        id="meltInvoiceInput"
        type="text"
        name="meltInvoice"
        value={meltInvoice}
        onChange={onChange}
        placeholder="lnbc1..."
        style={{ width: "100%", padding: "10px", marginBottom: "8px" }}
      />
      <button onClick={() => onMelt(meltInvoice)} disabled={isProcessing || !walletReady}>
        Melt
      </button>
    </div>
  );
}