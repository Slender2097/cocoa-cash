
// src/pages/index.jsx
// MIT License
// Copyright (c) 2026 Jose2097

import React, { useState, useEffect, useRef } from "react";
import useCashu from "@/hooks/useCashu";
import useProofStorage from "@/hooks/useProofStorage";

import Navbar from "@/components/layout/Navbar";
import BalanceDisplay from "@/components/layout/BalanceDisplay";
import Footer from "@/components/layout/Footer";
import { QRCodeSVG } from "qrcode.react";

import SecurityConfig from "@/components/layout/SecurityConfig";
import WalletWelcomeModal from "@/components/layout/WalletWelcomeModal";
import Image from "next/image";

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
    setDataOutput,         
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
  const [actionPanel, setActionPanel] = useState(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState(null);

  const [showTransactionHistory, setShowTransactionHistory] = useState(false);
  const [transactions, setTransactions] = useState([]);

// Initialize as false to prevent hydration mismatch with Next.js SSR
const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Ref for click-outside on Security panel
  const securityRef = useRef(null);

  const lastProcessedRef = useRef(null);

// Check localStorage only on the client after mount
useEffect(() => {
  if (typeof window === "undefined") return;   // skip on server

  const hasAccepted = localStorage.getItem('cocoa-welcome-accepted');
  if (hasAccepted !== 'true') {
    setShowWelcomeModal(true);
  }
}, []);

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

  const copyMintUrl = () => {
    if (!activeMint) {
      alert("No mint connected yet");
      return;
    }
    navigator.clipboard.writeText(activeMint);
    alert("Mint URL copied to clipboard!");
  };

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (dataOutput?.status) {
      const timer = setTimeout(() => {
        setDataOutput(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [dataOutput?.status, setDataOutput]);

  // === Sync dataOutput → Action Panel (Mint, Swap Send, etc.) - NO WARNING ===
  useEffect(() => {
    if (!dataOutput || !actionPanel?.type) return;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    setActionPanel((prev) => {
      if (!prev) return prev;

      // 1. Mint → Lightning invoice
      if (prev.type === "mint" && dataOutput.invoice) {
        return {
          ...prev,
          status: "waiting",
          invoice: dataOutput.invoice,
          message: "Scan or pay this invoice with any Lightning wallet",
        };
      }

      // 2. Swap Send → Cashu Token (this was missing before)
      if (prev.type === "swapSend" && dataOutput.token) {
        return {
          ...prev,
          status: "waiting",
          token: dataOutput.token,
          message: "Share this token with the receiver",
        };
      }

      // 3. Success for any operation
      if (
        dataOutput.status?.includes("Mint successful") ||
        dataOutput.status?.includes("Success") ||
        dataOutput.status?.includes("Token created") ||
        dataOutput.success
      ) {
        const updated = {
          ...prev,
          status: "success",
          message: dataOutput.success || dataOutput.message || "Operation completed!",
        };

        // Auto-hide after 4 seconds
        setTimeout(() => setActionPanel(null), 4000);
        return updated;
      }

      // 4. Error
      if (dataOutput.error) {
        return {
          ...prev,
          status: "error",
          message: dataOutput.error + (dataOutput.details ? ` — ${dataOutput.details}` : ""),
        };
      }

      return prev;
    });
  }, [dataOutput]);

    // === CLICK OUTSIDE TO CLOSE SECURITY PANEL ===
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSecurity && securityRef.current && !securityRef.current.contains(event.target)) {
        setShowSecurity(false);
      }
    };

    if (showSecurity) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSecurity]);

    // === QR Scanner (now correctly fills Melt OR Swap Claim) ===
  useEffect(() => {
    if (!showScanner) return;

    const { Html5QrcodeScanner } = require("html5-qrcode");

    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scanner.render(
      (decodedText) => {
        if (scannerTarget === "swapClaim") {
          setFormData((prev) => ({ ...prev, swapToken: decodedText }));
          alert(" Cashu token scanned successfully!");
        } else {
          setFormData((prev) => ({ ...prev, meltInvoice: decodedText }));
          alert(" Lightning invoice scanned successfully!");
        }

        setShowScanner(false);
        setScannerTarget(null);   // reset for next time
      },
      (error) => console.warn(error)
    );

    return () => scanner.clear();
  }, [showScanner, scannerTarget]);

 //transacttion History
  useEffect(() => {
    if (!dataOutput || !activeMint) return;

    const isSuccess = 
      dataOutput.status?.toLowerCase().includes("success") || 
      dataOutput.success === true ||
      dataOutput.token;

    if (!isSuccess) return;

    // Detect type even if actionPanel was already cleared
    let detectedType = actionPanel?.type;
    if (!detectedType && dataOutput.status) {
      if (dataOutput.status.toLowerCase().includes("mint")) detectedType = "mint";
      if (dataOutput.status.toLowerCase().includes("melt")) detectedType = "melt";
    }

    // Prevent duplicates
    const key = `${detectedType || "unknown"}-${dataOutput.status || dataOutput.token || ""}`;
    if (lastProcessedRef.current === key) return;
    lastProcessedRef.current = key;

    let type = "";
    let amount = 0;
    let sign = 1;

    if (detectedType === "mint") {
      type = "mint";
      amount = parseInt(formData.mintAmount) || 0;
      sign = 1;
    } 
    else if (detectedType === "melt") {
      type = "melt";
      amount = dataOutput.amount || dataOutput.paid || dataOutput.sent || 0;
      sign = -1;
    } 
    else if (detectedType === "swapSend") {
      type = "swap-send";
      amount = parseInt(formData.swapAmount) || 0;
      sign = -1;
    } 
    else if (detectedType === "swapClaim") {
      type = "swap-claim";
      amount = dataOutput.amount || dataOutput.received || dataOutput.value || 0;
      sign = 1;
    }

    if (type && amount > 0) {
      const newTx = {
        id: Date.now(),
        type: type,
        amount: amount * sign,
        mint: activeMint,
        timestamp: new Date().toLocaleString(),
      };

      setTransactions(prev => [newTx, ...prev]);
    }
  }, [dataOutput, activeMint, actionPanel, formData]);

    // === LOAD TRANSACTION HISTORY FROM LOCALSTORAGE ===
  useEffect(() => {
    const saved = localStorage.getItem("transaction_history");
    if (saved) {
      try {
        setTransactions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load transaction history");
      }
    }
  }, []);

  // === SAVE TRANSACTION HISTORY TO LOCALSTORAGE ===
  useEffect(() => {
    if (transactions.length > 0) {
      localStorage.setItem("transaction_history", JSON.stringify(transactions));
    }
  }, [transactions]);


  return (
    <>
      <Navbar 
        activeMint={activeMint} 
        onSwitchMint={handleSelectMint}
        onShowTransactionHistory={() => setShowTransactionHistory(true)}
      />


      <div className="max-w-4xl mx-auto px-6 pt-6 pb-12">
         <BalanceDisplay 
          balance={balance || 0} 
          isConnected={walletReady && !!activeMint}
          hasError={!!dataOutput?.error}
        />

        {/* === MINT CONNECTION DISPLAY — ONLY when connecting a mint === */}
        {dataOutput && !actionPanel && (
          dataOutput.status?.includes("Mint connected") || 
          (dataOutput.error && !dataOutput.status?.includes("Mint successful") && !dataOutput.status?.includes("Success"))
        ) && (
          <div className="mb-10 glass neon-glow rounded-3xl border border-[#4ff4c6]/30 p-6">

            {/* SUCCESS - Mint Connected */}
            {dataOutput.status && dataOutput.status.includes("Mint connected") && (
              <>
                <p className="font-mono text-sm text-[#4ff4c6] uppercase tracking-[4px]">
                  Mint connected 
                </p>
                <div className="mt-4 font-mono bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl p-5 text-[#e8fff7] text-base leading-relaxed break-all flex items-start gap-3 shadow-inner">
                  <span className="text-[#4ff4c6] select-none mt-px text-lg">➜</span>
                  <span className="flex-1">
                    {activeMint || "No mint connected"}
                  </span>
                </div>

                <button
                  onClick={copyMintUrl}
                  className="mt-5 px-5 py-2 text-sm font-medium bg-[#14251f] border border-[#4ff4c6]/40 hover:border-[#4ff4c6] rounded-3xl text-[#e8fff7] transition-colors"
                >
                  Copy Mint URL
                </button>
              </>
            )}

            {/* ERROR - Connection Failed */}
            {dataOutput.error && (
              <>
                <p className="font-mono text-sm text-red-400 uppercase tracking-[4px]">
                  Connection failed 
                </p>

                <div className="mt-4 font-mono bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl p-5 text-[#e8fff7] text-base leading-relaxed break-all flex items-start gap-3 shadow-inner">
                  <span className="text-[#4ff4c6] select-none mt-px text-lg">➜</span>
                  <span className="flex-1">
                    {dataOutput.details || dataOutput.error}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* === NEW UNIFIED ACTION PANEL (Mint + Melt + Swap Send + Swap Claim) === */}
        {actionPanel && (
          <div className="mb-10 glass neon-glow rounded-3xl border border-[#4ff4c6]/30 p-6 relative overflow-hidden">

            {/* Close button X */}
            <button
              onClick={() => setActionPanel(null)}
              className="absolute top-5 right-5 text-[#4ff4c6] hover:text-red-400 text-4xl leading-none transition-colors z-10"
            >
              ×
            </button>

            {/* MINT PANEL */}
            {actionPanel?.type === "mint" && (
              <>
                <p className="font-mono text-sm text-[#4ff4c6] uppercase tracking-[4px]">
                  {actionPanel.status === "waiting"
                    ? "WAITING FOR PAYMENT ⚡"
                    : actionPanel.status === "success"
                    ? "PAYMENT RECEIVED!"
                    : "ERROR"}
                </p>

                {actionPanel.status === "waiting" && actionPanel.invoice && (
                  <div className="mt-8 flex justify-center">
                    <div className="bg-[#0a1a14] p-5 rounded-3xl border border-[#4ff4c6]/40 shadow-inner">
                      <QRCodeSVG
                        value={actionPanel.invoice}
                        size={280}
                        bgColor="#0a1a14"
                        fgColor="#4ff4c6"
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                )}

                {actionPanel.invoice && (
                  <div className="mt-6 font-mono bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl p-5 text-[#e8fff7] text-base leading-relaxed break-all flex items-start gap-3 shadow-inner">
                    <span className="text-[#4ff4c6] select-none mt-px text-lg">➜</span>
                    <span className="flex-1 font-light">{actionPanel.invoice}</span>
                  </div>
                )}

                {actionPanel.status === "success" && (
                  <div className="mt-8 flex justify-center items-center gap-6 text-8xl animate-pulse">
                    <span className="text-yellow-300">⚡</span>
                    <span className="text-[#4ff4c6] font-medium tracking-widest">LIGHTNING PAID</span>
                    <span className="text-yellow-300">⚡</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(actionPanel.invoice || "");
                    alert(" Lightning invoice copied to clipboard");
                  }}
                  className="mt-8 w-full py-4 bg-[#14251f] border border-[#4ff4c6]/40 hover:border-[#4ff4c6] rounded-3xl text-[#e8fff7] font-medium transition-colors"
                >
                  Copy Lightning Invoice
                </button>
              </>
            )}

            {/* MELT PANEL */}
            {actionPanel?.type === "melt" && (
              <>
                <p className="font-mono text-sm text-[#4ff4c6] uppercase tracking-[4px]">
                  {actionPanel.status === "success"
                    ? "MELT SUCCESSFUL ✓"
                    : actionPanel.status === "error"
                    ? "MELT FAILED"
                    : "PROCESSING MELT..."}
                </p>
                <div className="mt-6 font-mono bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl p-5 text-[#e8fff7] text-base leading-relaxed break-all flex items-start gap-3 shadow-inner">
                  <span className="text-[#4ff4c6] select-none mt-px text-lg">➜</span>
                  <span className="flex-1">{actionPanel.message}</span>
                </div>
              </>
            )}

            {/* SWAP SEND — QR Code Panel */}
            {actionPanel?.type === "swapSend" && (
              <>
                <p className="font-mono text-sm text-[#4ff4c6] uppercase tracking-[4px]">
                  {actionPanel.status === "waiting"
                    ? "TOKEN GENERATED"
                    : actionPanel.status === "success"
                    ? "TOKEN READY ✓"
                    : "ERROR"}
                </p>

                {actionPanel.status === "waiting" && actionPanel.token && (
                  <div className="mt-8 flex justify-center">
                    <div className="bg-[#0a1a14] p-5 rounded-3xl border border-[#4ff4c6]/40 shadow-inner">
                      <QRCodeSVG
                        value={actionPanel.token}
                        size={280}
                        bgColor="#0a1a14"
                        fgColor="#4ff4c6"
                        level="H"
                        includeMargin={true}
                      />
                    </div>
                  </div>
                )}

                {actionPanel.token && (
                  <div className="mt-6 font-mono bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl p-5 text-[#e8fff7] text-base leading-relaxed break-all flex items-start gap-3 shadow-inner">
                    <span className="text-[#4ff4c6] select-none mt-px text-lg">➜</span>
                    <span className="flex-1 font-light">{actionPanel.token}</span>
                  </div>
                )}

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(actionPanel.token || "");
                    alert(" Cashu Token copied to clipboard");
                  }}
                  className="mt-8 w-full py-4 bg-[#14251f] border border-[#4ff4c6]/40 hover:border-[#4ff4c6] rounded-3xl text-[#e8fff7] font-medium transition-colors"
                >
                  Copy Cashu Token
                </button>
              </>
            )}

            {/* SWAP CLAIM PANEL */}
            {actionPanel?.type === "swapClaim" && (
              <>
                <p className="font-mono text-sm text-[#4ff4c6] uppercase tracking-[4px]">
                  {actionPanel.status === "success"
                    ? "CLAIM SUCCESSFUL ✓"
                    : actionPanel.status === "error"
                    ? "CLAIM FAILED"
                    : "CLAIMING TOKEN..."}
                </p>
                <div className="mt-6 font-mono bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl p-5 text-[#e8fff7] text-base leading-relaxed break-all flex items-start gap-3 shadow-inner">
                  <span className="text-[#4ff4c6] select-none mt-px text-lg">➜</span>
                  <span className="flex-1">{actionPanel.message}</span>
                </div>
              </>
            )}

            {/* Extra message */}
            {actionPanel?.message && (
              <p className="mt-6 text-center text-sm text-[#e8fff7]/80 font-light">
                {actionPanel.message}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Mint Tokens — QR Code Panel */}
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
              onClick={async () => {
                const amount = parseInt(formData.mintAmount);
                if (!amount || amount < 1) return alert("Please enter a valid amount");

                setActionPanel({ type: "mint", status: "waiting", invoice: null });

                await handleMint(amount);
              }}
              disabled={isProcessing || !walletReady}
              className="w-full py-4 bg-[#4ff4c6] text-[#0f1c18] font-medium rounded-3xl hover:brightness-110 disabled:opacity-50"
            >
              Mint
            </button>
          </div>

{/* 2. Melt Tokens — with Camera Scanner (mobile friendly) */}
          <div className="glass neon-glow rounded-3xl p-6">
            <h2 className="text-[#4ff4c6] text-xl font-medium mb-4">Melt Tokens</h2>
            
            <label className="text-sm text-[#e8fff7]/70 block mb-2">Bolt11 Invoice</label>
            
            <div className="flex gap-3">
              <input
                type="text"
                name="meltInvoice"
                value={formData.meltInvoice}
                onChange={handleChange}
                placeholder="lnbc1..."
                className="flex-1 bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-4 py-4 text-[#e8fff7] outline-none text-sm"
              />
              
              <button
                onClick={() => {
                  setScannerTarget("melt");
                  setShowScanner(true);
                }}
                className="px-5 py-4 bg-[#14251f] border border-[#4ff4c6]/40 hover:border-[#4ff4c6] rounded-3xl text-[#4ff4c6] font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                Scan
              </button>
            </div>

            <button
              onClick={async () => {
                if (!formData.meltInvoice) return alert("Please enter a Bolt11 invoice");
                setActionPanel({ type: "melt", status: "waiting", message: "Processing melt..." });
                await handleMelt(formData.meltInvoice);
              }}
              disabled={isProcessing || !walletReady}
              className="mt-6 w-full py-4 bg-[#4ff4c6] text-[#0f1c18] font-medium rounded-3xl hover:brightness-110 disabled:opacity-50"
            >
              Melt
            </button>
          </div>

          {/* 3. Swap → Send — generates QR code */}
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
              onClick={async () => {
                const amount = parseInt(formData.swapAmount);
                if (!amount || amount < 1) return alert("Please enter a valid amount");

                setActionPanel({ type: "swapSend", status: "waiting", token: null });
                await handleSwapSend(amount);
              }}
              disabled={isProcessing || !walletReady}
              className="w-full py-4 bg-[#4ff4c6] text-[#0f1c18] font-medium rounded-3xl hover:brightness-110 disabled:opacity-50"
            >
              Create Token (Send)
            </button>
          </div>

{/* 4. Swap → Claim — with camera scan (mobile friendly) */}
          <div className="glass neon-glow rounded-3xl p-6">
            <h2 className="text-[#4ff4c6] text-xl font-medium mb-4">Swap → Claim</h2>
            <label className="text-sm text-[#e8fff7]/70 block mb-2">Cashu Token</label>
            
            <div className="flex gap-3">
              <input
                type="text"
                name="swapToken"
                value={formData.swapToken}
                onChange={handleChange}
                placeholder="cashuB..."
                className="flex-1 bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-4 py-4 text-[#e8fff7] outline-none text-sm"
              />
              
              <button
                onClick={() => {
                  setScannerTarget("swapClaim");
                  setShowScanner(true);
                }}
                className="px-5 py-4 bg-[#14251f] border border-[#4ff4c6]/40 hover:border-[#4ff4c6] rounded-3xl text-[#4ff4c6] font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                Scan
              </button>
            </div>

            <button
              onClick={async () => {
                if (!formData.swapToken) return alert("Please enter or scan a Cashu token");
                setActionPanel({ type: "swapClaim", status: "waiting", message: "Claiming token..." });
                await handleSwapClaim(formData.swapToken);
              }}
              disabled={isProcessing || !walletReady}
              className="mt-6 w-full py-4 bg-[#4ff4c6] text-[#0f1c18] font-medium rounded-3xl hover:brightness-110 disabled:opacity-50"
            >
              Claim Token
            </button>
          </div>
        </div>
      </div>

      <Footer onOpenSecurity={() => setShowSecurity(!showSecurity)} />

      {showSecurity && (
        <div ref={securityRef}>
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
        </div>
      )}

      {/*Seed Modal*/} 
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
                      alert(" Wallet restored successfully!");
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
                    alert(" Copied to clipboard");
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

            {/* QR SCANNER MODAL */}
      {showScanner && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl">
          <div className="bg-[#1e3a32] border border-[#4ff4c6]/40 rounded-3xl p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[#4ff4c6] text-xl font-medium">Scan Lightning Invoice</h3>
              <button
                onClick={() => setShowScanner(false)}
                className="text-4xl text-[#4ff4c6] hover:text-red-400 leading-none"
              >
                ×
              </button>
            </div>

            <div id="qr-reader" className="rounded-2xl overflow-hidden border border-[#4ff4c6]/30"></div>

            <p className="text-center text-[#e8fff7]/60 text-sm mt-4">
              Point your camera at a Lightning QR code
            </p>

            <button
              onClick={() => setShowScanner(false)}
              className="mt-6 w-full py-4 bg-[#14251f] border border-[#4ff4c6]/40 hover:border-[#4ff4c6] rounded-3xl text-[#e8fff7]"
            >
              Close Scanner
            </button>
          </div>
        </div>
      )}

{/* === MANDATORY WELCOME MODAL (no more flash) === */}
      <WalletWelcomeModal
        isOpen={showWelcomeModal}
        onAccept={() => setShowWelcomeModal(false)}
      />

      {/* === TRANSACTION HISTORY MODAL === */}
      {showTransactionHistory && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl">
          <div className="bg-[#1e3a32] border border-[#4ff4c6]/40 rounded-3xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Image src="/clock.png" alt="History" width={40} height={40} className="object-contain" />
                <h2 className="text-2xl font-medium text-[#e8fff7]">Transaction History</h2>
              </div>
              <button
                onClick={() => setShowTransactionHistory(false)}
                className="text-4xl text-[#4ff4c6] hover:text-red-400 leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {transactions.length === 0 ? (
                <div className="text-center py-16 text-[#e8fff7]/40">
                  <p className="text-7xl mb-6">🕒</p>
                  <p className="text-xl">No transactions yet</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="bg-[#14251f] p-4 rounded-2xl flex justify-between items-center">
                    <div>
                      <p className="text-[#e8fff7] capitalize">{tx.type}</p>
                      <p className="text-xs text-[#e8fff7]/60">{tx.timestamp}</p>
                      <p className="text-xs text-[#4ff4c6]/80 mt-1">
                        {tx.mint ? tx.mint.replace("https://", "").replace(/\/$/, "") : ""}
                      </p>
                    </div>
                    <p className={`font-medium text-lg ${tx.amount > 0 ? "text-[#4ff4c6]" : "text-red-400"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount} sat
                    </p>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowTransactionHistory(false)}
              className="mt-6 w-full py-4 bg-[#14251f] border border-[#4ff4c6]/40 hover:border-[#4ff4c6] rounded-3xl text-[#e8fff7]"
            >
              Close
            </button>
          </div>
        </div>
      )}


    </>
  );
}