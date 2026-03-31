// src/components/layout/BalanceDisplay.jsx
import React from "react";

export default function BalanceDisplay({ balance, activeMint, proofsByMint }) {
  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 text-center">
      <p className="text-sm text-gray-500">Your Balance</p>
      <h2 className="text-6xl font-bold text-green-600">{balance} <span className="text-2xl">sat</span></h2>
      {activeMint && (
        <p className="text-xs mt-2 text-gray-400">
          on {activeMint}
          {proofsByMint[activeMint] && ` • ${proofsByMint[activeMint].length} proofs`}
        </p>
      )}
    </div>
  );
}