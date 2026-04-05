/*

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
import SecurityConfig from "@/components/layout/SecurityConfig";

export default function Home() {
  const {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    //activeMint,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
  } = useCashu();

  const [showSecurity, setShowSecurity] = useState(false);
  const [securityLevel, setSecurityLevel] = useState(1);   // 1 = transient (default)

  const { activeMint, switchMint } = useProofStorage();

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

  // NEW: When user clicks a mint in the navbar
  const handleSelectMint = (mintUrl) => {
    setFormData((prev) => ({ ...prev, mintUrl }));   
    handleSetMint(mintUrl);                           
    switchMint(mintUrl);                              
  };

  return (
    <>
      <Navbar 
        activeMint={activeMint} 
        onSwitchMint={handleSelectMint}     
      />

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-12">

        // Top Information Area *
        <BalanceDisplay balance={balance || 0} />

        {dataOutput && (
          <div className="mb-10 p-5 glass rounded-3xl border border-[#4ff4c6]/30">
            <pre className="text-xs text-[#e8fff7] whitespace-pre-wrap overflow-auto max-h-40">
              {JSON.stringify(dataOutput, null, 2)}
            </pre>
          </div>
        )}

        // Operations - Lighter cards 
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MintSection
            mintUrl={formData.mintUrl}
            mintAmount={formData.mintAmount}
            onChange={handleChange}
            onSetMint={handleSetMint}
            onMint={handleMint}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <MeltSection
            meltInvoice={formData.meltInvoice}
            onChange={handleChange}
            onMelt={handleMelt}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <SwapSendSection
            swapAmount={formData.swapAmount}
            onChange={handleChange}
            onSwapSend={handleSwapSend}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <SwapClaimSection
            swapToken={formData.swapToken}
            onChange={handleChange}
            onSwapClaim={handleSwapClaim}
            isProcessing={isProcessing}
            className="light-card"
          />
        </div>
      </div>
          // Footer with Security Icon 
      <Footer onOpenSecurity={() => setShowSecurity(!showSecurity)} />

      // Security Config Dropdown 
      {showSecurity && (
        <SecurityConfig 
          currentLevel={securityLevel} 
          onUpgrade={(level) => {
            setSecurityLevel(level);
            setShowSecurity(false);
            // TODO: Later we will add real encryption / seed logic here
            alert(`Upgraded to Level ${level} (logic coming soon)`);
          }} 
        />
      )}

    </>
  );
}

works fine in progress

// src/pages/index.jsx
import React, { useState, useLayoutEffect } from "react";
import useCashu from "@/hooks/useCashu";
import useProofStorage from "@/hooks/useProofStorage";

import Navbar from "@/components/layout/Navbar";
import BalanceDisplay from "@/components/layout/BalanceDisplay";
import Footer from "@/components/layout/Footer";

import MintSection from "@/components/operations/MintSection";
import MeltSection from "@/components/operations/MeltSection";
import SwapSendSection from "@/components/operations/SwapSendSection";
import SwapClaimSection from "@/components/operations/SwapClaimSection";
import SecurityConfig from "@/components/layout/SecurityConfig";
import PasswordPrompt from "@/components/layout/PasswordPrompt";

export default function Home() {
  const {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
  } = useCashu();

  const [showSecurity, setShowSecurity] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [mounted, setMounted] = useState(false);   // ← fixes hydration

  const {
    activeMint,
    switchMint,
    securityLevel,
    setSecurityLevel,
    unlockWallet,
    upgradeToLevel2,
  } = useProofStorage();

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

  const handleSelectMint = (mintUrl) => {
    setFormData((prev) => ({ ...prev, mintUrl }));
    handleSetMint(mintUrl);
    switchMint(mintUrl);
  };

  // Fix hydration mismatch cleanly
  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <Navbar 
        activeMint={activeMint} 
        onSwitchMint={handleSelectMint}     
      />

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-12">
        <BalanceDisplay balance={balance || 0} />

        {dataOutput && (
          <div className="mb-10 p-5 glass rounded-3xl border border-[#4ff4c6]/30">
            <pre className="text-xs text-[#e8fff7] whitespace-pre-wrap overflow-auto max-h-40">
              {JSON.stringify(dataOutput, null, 2)}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MintSection
            mintUrl={formData.mintUrl}
            mintAmount={formData.mintAmount}
            onChange={handleChange}
            onSetMint={handleSetMint}
            onMint={handleMint}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <MeltSection
            meltInvoice={formData.meltInvoice}
            onChange={handleChange}
            onMelt={handleMelt}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <SwapSendSection
            swapAmount={formData.swapAmount}
            onChange={handleChange}
            onSwapSend={handleSwapSend}
            isProcessing={isProcessing}
            walletReady={walletReady}
            className="light-card"
          />
          <SwapClaimSection
            swapToken={formData.swapToken}
            onChange={handleChange}
            onSwapClaim={handleSwapClaim}
            isProcessing={isProcessing}
            className="light-card"
          />
        </div>
      </div>

      <Footer onOpenSecurity={() => setShowSecurity(!showSecurity)} />

      {showSecurity && (
        <SecurityConfig 
          currentLevel={securityLevel} 
          onUpgrade={async (level, password) => {
            if (level === 2 && password) {
              await upgradeToLevel2(password);
              setIsUnlocked(true);
              console.log("✅ Level 2 activated - Wallet encrypted");
            } else if (level === 1) {
              setIsUnlocked(false);
            }
            setSecurityLevel(level);
            setShowSecurity(false);
          }} 
        />
      )}

      // Unlock prompt — only shown after client hydration 
      {mounted && securityLevel === 2 && !isUnlocked && (
        <PasswordPrompt
          mode="unlock"
          onSubmit={async (password) => {
            try {
              await unlockWallet(password);
              setIsUnlocked(true);
              console.log("✅ Wallet unlocked with password");
            } catch (err) {
              alert("Wrong password or corrupted wallet data");
            }
          }}
          onCancel={() => {
            alert("Password is required to use the wallet on Level 2");
          }}
        />
      )}
    </>
  );
}*/

// src/pages/index.jsx
import React, { useState } from "react";
import useCashu from "@/hooks/useCashu";
import useProofStorage from "@/hooks/useProofStorage";

import Navbar from "@/components/layout/Navbar";
import BalanceDisplay from "@/components/layout/BalanceDisplay";
import Footer from "@/components/layout/Footer";

import SecurityConfig from "@/components/layout/SecurityConfig";

export default function Home() {
  const {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
  } = useCashu();

  const {
    activeMint,
    switchMint,
    securityLevel,
    setSecurityLevel,
    resetWallet,
    mnemonic,
    restoreFromSeed,
  } = useProofStorage();

  const [showSecurity, setShowSecurity] = useState(false);
  const [showSeedReveal, setShowSeedReveal] = useState(false);
  const [tempSeed, setTempSeed] = useState("");
  const [restoreMode, setRestoreMode] = useState(false);

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

  const handleSelectMint = (mintUrl) => {
    setFormData((prev) => ({ ...prev, mintUrl }));
    handleSetMint(mintUrl);
    switchMint(mintUrl);
  };

  return (
    <>
      <Navbar activeMint={activeMint} onSwitchMint={handleSelectMint} />

      <div className="max-w-4xl mx-auto px-6 pt-6 pb-12">
        <BalanceDisplay balance={balance || 0} />

        {dataOutput && (
          <div className="mb-10 p-5 glass rounded-3xl border border-[#4ff4c6]/30">
            <pre className="text-xs text-[#e8fff7] whitespace-pre-wrap overflow-auto max-h-40">
              {JSON.stringify(dataOutput, null, 2)}
            </pre>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Mint Tokens — Apple-style glass + neon glow */}
          <div className="glass neon-glow rounded-3xl p-6">
            <h2 className="text-[#4ff4c6] text-xl font-medium mb-4">Mint Tokens</h2>
            <label className="text-sm text-[#e8fff7]/70 block mb-2">Amount (sat)</label>
            <input
              type="number"
              name="mintAmount"
              value={formData.mintAmount}
              onChange={handleChange}
              placeholder="1000"
              className="w-full bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-6 py-4 text-[#e8fff7] outline-none mb-6"
            />
            <button
              onClick={() => handleMint(formData.mintAmount)}
              disabled={isProcessing || !walletReady}
              className="w-full py-4 bg-[#4ff4c6] text-[#0f1c18] font-medium rounded-3xl hover:brightness-110 disabled:opacity-50"
            >
              Mint
            </button>
          </div>

          {/* 2. Melt Tokens — Apple-style glass + neon glow */}
          <div className="glass neon-glow rounded-3xl p-6">
            <h2 className="text-[#4ff4c6] text-xl font-medium mb-4">Melt Tokens</h2>
            <label className="text-sm text-[#e8fff7]/70 block mb-2">Bolt11 Invoice</label>
            <input
              type="text"
              name="meltInvoice"
              value={formData.meltInvoice}
              onChange={handleChange}
              placeholder="lnbc1..."
              className="w-full bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-6 py-4 text-[#e8fff7] outline-none mb-6"
            />
            <button
              onClick={() => handleMelt(formData.meltInvoice)}
              disabled={isProcessing || !walletReady}
              className="w-full py-4 bg-[#4ff4c6] text-[#0f1c18] font-medium rounded-3xl hover:brightness-110 disabled:opacity-50"
            >
              Melt
            </button>
          </div>

          {/* 3. Swap → Send — Apple-style glass + neon glow */}
          <div className="glass neon-glow rounded-3xl p-6">
            <h2 className="text-[#4ff4c6] text-xl font-medium mb-4">Swap → Send</h2>
            <label className="text-sm text-[#e8fff7]/70 block mb-2">Amount to send (sat)</label>
            <input
              type="number"
              name="swapAmount"
              value={formData.swapAmount}
              onChange={handleChange}
              placeholder="500"
              className="w-full bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-6 py-4 text-[#e8fff7] outline-none mb-6"
            />
            <button
              onClick={() => handleSwapSend(formData.swapAmount)}
              disabled={isProcessing || !walletReady}
              className="w-full py-4 bg-[#4ff4c6] text-[#0f1c18] font-medium rounded-3xl hover:brightness-110 disabled:opacity-50"
            >
              Create Token (Send)
            </button>
          </div>

          {/* 4. Swap → Claim — Apple-style glass + neon glow */}
          <div className="glass neon-glow rounded-3xl p-6">
            <h2 className="text-[#4ff4c6] text-xl font-medium mb-4">Swap → Claim</h2>
            <label className="text-sm text-[#e8fff7]/70 block mb-2">Token to claim</label>
            <input
              type="text"
              name="swapToken"
              value={formData.swapToken}
              onChange={handleChange}
              placeholder="cashuB..."
              className="w-full bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-6 py-4 text-[#e8fff7] outline-none mb-6 font-mono text-sm"
            />
            <button
              onClick={() => handleSwapClaim(formData.swapToken)}
              disabled={isProcessing || !walletReady}
              className="w-full py-4 bg-[#4ff4c6] text-[#0f1c18] font-medium rounded-3xl hover:brightness-110 disabled:opacity-50"
            >
              Claim Token
            </button>
          </div>
        </div>
      </div>

      <Footer onOpenSecurity={() => setShowSecurity(!showSecurity)} />

      {showSecurity && (
        <SecurityConfig
          currentLevel={securityLevel}
          onUpgrade={(action) => {
            setShowSecurity(false);
            if (action === "restore") {
              setRestoreMode(true);
              setShowSeedReveal(true);
            } else if (action === 2) {
              setRestoreMode(false);
              setShowSeedReveal(true);
            } else if (action === 1) {
              setSecurityLevel(1);
            }
          }}
        />
      )}

      {/* Seed Modal */}
      {showSeedReveal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl">
          <div className="bg-[#1e3a32] border border-[#4ff4c6]/40 rounded-3xl p-8 max-w-md w-full mx-4">
            <h3 className="text-[#4ff4c6] text-xl font-medium mb-2">
              {restoreMode ? "Restore Wallet" : "Silent Seed"}
            </h3>
            <p className="text-[#e8fff7]/70 text-sm mb-6">
              {restoreMode
                ? "Paste your 12-word seed phrase below"
                : "Your recovery phrase"}
            </p>

            {!restoreMode && mnemonic && (
              <div className="bg-[#14251f] p-6 rounded-2xl text-[#e8fff7] font-mono text-center leading-relaxed mb-6 break-all">
                {mnemonic}
              </div>
            )}

            {restoreMode && (
              <textarea
                placeholder="Paste your 12-word seed phrase here..."
                className="w-full bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl p-6 text-[#e8fff7] outline-none h-28 resize-none mb-6"
                onChange={(e) => setTempSeed(e.target.value)}
              />
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSeedReveal(false);
                  setRestoreMode(false);
                }}
                className="flex-1 py-4 rounded-3xl border border-white/30 text-[#e8fff7] hover:bg-white/10"
              >
                Close
              </button>

              {restoreMode ? (
                <button
                  onClick={() => {
                    const success = restoreFromSeed(tempSeed);
                    if (success) {
                      alert("✅ Wallet restored successfully!");
                      setShowSeedReveal(false);
                      setRestoreMode(false);
                      setTempSeed("");
                    }
                  }}
                  className="flex-1 py-4 rounded-3xl bg-[#4ff4c6] text-[#0f1c18] font-medium"
                >
                  Restore Wallet
                </button>
              ) : (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(mnemonic);
                    alert("✅ Copied to clipboard");
                  }}
                  className="flex-1 py-4 rounded-3xl bg-[#4ff4c6] text-[#0f1c18] font-medium"
                >
                  Copy Seed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}