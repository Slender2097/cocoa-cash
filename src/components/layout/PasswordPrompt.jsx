// src/components/layout/PasswordPrompt.jsx
import React, { useState } from "react";

export default function PasswordPrompt({
  onSubmit,
  onCancel,
  mode = "setup" // "setup" or "unlock"
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const isSetup = mode === "setup";

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }
    if (isSetup && password !== confirmPassword) {
      alert("Passwords do not match");
      return;
    }
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div className="bg-[#1e3a32] border border-[#4ff4c6]/40 rounded-3xl p-8 w-full max-w-md mx-4">
        <h3 className="text-[#4ff4c6] text-xl font-medium mb-2">
          {isSetup ? "Level 2 Protection" : "Unlock Wallet"}
        </h3>
        <p className="text-[#e8fff7]/70 text-sm mb-6">
          {isSetup
            ? "Set a password to encrypt your wallet"
            : "Enter your password to decrypt and access your wallet"}
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-6 py-4 text-[#e8fff7] outline-none"
          />

          {isSetup && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-6 py-4 text-[#e8fff7] outline-none"
            />
          )}

          <div className="flex gap-3 pt-4">
            {/* Cancel & Downgrade to Level 1 (only for setup) */}
            <button
              type="button"
              onClick={() => {
                if (isSetup) {
                  if (window.confirm("Cancel and return to unsecured Level 1?")) {
                    onCancel(true); // true = downgrade
                  }
                } else {
                  onCancel();
                }
              }}
              className="flex-1 py-4 rounded-3xl border border-white/30 text-[#e8fff7] hover:bg-white/10"
            >
              {isSetup ? "Cancel & Use Level 1" : "Cancel"}
            </button>

            <button
              type="submit"
              className="flex-1 py-4 rounded-3xl bg-[#4ff4c6] text-[#0f1c18] font-medium hover:brightness-110"
            >
              {isSetup ? "Encrypt Wallet" : "Unlock Wallet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}