// src/components/layout/SecurityConfig.jsx
import React, { useState } from "react";
import PasswordPrompt from "./PasswordPrompt";

export default function SecurityConfig({ currentLevel, onUpgrade }) {
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  const handleLevel2Upgrade = () => {
    setShowPasswordPrompt(true);
  };

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

          {/* Level 2 */}
          <div
            onClick={handleLevel2Upgrade}
            className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
              currentLevel === 2 ? 'border-[#4ff4c6]' : 'border-white/10 hover:border-[#4ff4c6]/50'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">Level 2 — Password Protection</p>
                <p className="text-xs text-[#e8fff7]/60">Encrypt wallet with password</p>
              </div>
              {currentLevel === 2 && <span className="text-[#4ff4c6] text-xs font-medium">ACTIVE</span>}
            </div>
          </div>

          {/* Level 3 */}
          <div
            onClick={() => onUpgrade(3)}
            className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
              currentLevel === 3 ? 'border-[#4ff4c6]' : 'border-white/10 hover:border-[#4ff4c6]/50'
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium">Level 3 — Seed Phrase</p>
                <p className="text-xs text-[#e8fff7]/60">12-word recovery phrase</p>
              </div>
              {currentLevel === 3 && <span className="text-[#4ff4c6] text-xs font-medium">ACTIVE</span>}
            </div>
          </div>
        </div>

        {currentLevel === 1 && (
          <p className="text-xs text-amber-400 mt-6">
            Your wallet is currently unsecured. Upgrade to protect your funds.
          </p>
        )}
      </div>

      {/* Password Prompt Modal (setup mode) */}
      {showPasswordPrompt && (
        <PasswordPrompt
          mode="setup"
          onSubmit={(password) => {
            setShowPasswordPrompt(false);
            onUpgrade(2, password);
          }}
          onCancel={() => setShowPasswordPrompt(false)}
        />
      )}
    </>
  );
}