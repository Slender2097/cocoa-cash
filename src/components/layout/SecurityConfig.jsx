// src/components/layout/SecurityConfig.jsx
import React from "react";

export default function SecurityConfig({ currentLevel, onUpgrade }) {
  return (
    <div className="fixed bottom-20 right-6 bg-[#1e3a32] border border-[#4ff4c6]/30 rounded-3xl shadow-2xl p-6 w-80 z-50">
      <h3 className="text-[#4ff4c6] text-base font-medium mb-4">Wallet Security</h3>
      
      <div className="space-y-4">
        {/* Level 1 */}
        <div className={`p-4 rounded-2xl border ${currentLevel === 1 ? 'border-[#4ff4c6]' : 'border-white/10'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium">Level 1 — Transient</p>
              <p className="text-xs text-[#e8fff7]/60">No password • Stored in browser</p>
            </div>
            {currentLevel === 1 && <span className="text-[#4ff4c6] text-xs font-medium">ACTIVE</span>}
          </div>
        </div>

        {/* Level 2 */}
        <div 
          onClick={() => onUpgrade(2)}
          className="p-4 rounded-2xl border border-white/10 hover:border-[#4ff4c6]/50 cursor-pointer transition-colors"
        >
          <p className="text-sm font-medium">Level 2 — Password Protection</p>
          <p className="text-xs text-[#e8fff7]/60">Encrypt wallet with password</p>
        </div>

        {/* Level 3 */}
        <div 
          onClick={() => onUpgrade(3)}
          className="p-4 rounded-2xl border border-white/10 hover:border-[#4ff4c6]/50 cursor-pointer transition-colors"
        >
          <p className="text-sm font-medium">Level 3 — Seed Phrase</p>
          <p className="text-xs text-[#e8fff7]/60">12-word recovery phrase</p>
        </div>
      </div>

      {currentLevel === 1 && (
        <p className="text-xs text-amber-400 mt-6">
          Your wallet is currently unsecured. Upgrade to protect your funds.
        </p>
      )}
    </div>
  );
}