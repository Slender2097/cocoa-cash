// src/components/layout/SecurityConfig.jsx
// src/components/layout/SecurityConfig.jsx
/*import React from "react";

export default function SecurityConfig({ currentLevel, onUpgrade }) {
  return (
    <>
      <div className="fixed bottom-20 right-6 bg-[#1e3a32] border border-[#4ff4c6]/30 rounded-3xl shadow-2xl p-6 w-80 z-50">
        <h3 className="text-[#4ff4c6] text-base font-medium mb-4">Wallet Security</h3>
        
        <div className="space-y-4">
        //* Level 1 
          <div className={`p-4 rounded-2xl border ${currentLevel === 1 ? 'border-[#4ff4c6]' : 'border-white/10'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">Level 1 — Transient</p>
                <p className="text-xs text-[#e8fff7]/60">No password • Stored in browser</p>
              </div>
              {currentLevel === 1 && <span className="text-[#4ff4c6] text-xs font-medium">ACTIVE</span>}
            </div>
          </div>

          // Level 2 — Silent Seed 
          <div
            onClick={() => onUpgrade(2)}
            className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
              currentLevel === 2 ? 'border-[#4ff4c6]' : 'border-white/10 hover:border-[#4ff4c6]/50'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">Level 2 — Silent Seed</p>
                <p className="text-xs text-[#e8fff7]/60">12-word recovery phrase</p>
              </div>
              {currentLevel === 2 && <span className="text-[#4ff4c6] text-xs font-medium">ACTIVE</span>}
            </div>
          </div>
        </div>

        {currentLevel === 1 && (
          <p className="text-xs text-amber-400 mt-6">
            Your wallet is currently unsecured. Upgrade to Level 2 to back up your seed phrase.
          </p>
        )}
      </div>
    </>
  );
}*/

// src/components/layout/SecurityConfig.jsx
import React from "react";

export default function SecurityConfig({ currentLevel, onUpgrade }) {
  return (
    <>
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

          {/* Level 2 — View Silent Seed */}
          <div
            onClick={() => onUpgrade(2)}
            className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
              currentLevel === 2 ? 'border-[#4ff4c6]' : 'border-white/10 hover:border-[#4ff4c6]/50'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">Level 2 — Silent Seed</p>
                <p className="text-xs text-[#e8fff7]/60">View 12-word recovery phrase</p>
              </div>
              {currentLevel === 2 && <span className="text-[#4ff4c6] text-xs font-medium">ACTIVE</span>}
            </div>
          </div>

          {/* NEW: Restore Wallet (third button) */}
          <div
            onClick={() => onUpgrade("restore")}
            className="p-4 rounded-2xl border cursor-pointer transition-colors border-white/10 hover:border-[#4ff4c6]/50"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-[#4ff4c6]">Restore Wallet</p>
                <p className="text-xs text-[#e8fff7]/60">Import from 12-word seed phrase</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}