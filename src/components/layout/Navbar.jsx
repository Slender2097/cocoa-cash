// src/components/layout/Navbar.jsx
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";

export default function Navbar({ activeMint, onSwitchMint, onShowTransactionHistory }) {
  const [savedMints, setSavedMints] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [newMintUrl, setNewMintUrl] = useState("");
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showJaguarMenu, setShowJaguarMenu] = useState(false);

  // Refs for click-outside detection
  const configRef = useRef(null);
  const mobileRef = useRef(null);
  const jaguarRef = useRef(null);

  // Load saved mints
  useEffect(() => {
    const saved = localStorage.getItem("savedMints");
    if (saved) {
      setSavedMints(JSON.parse(saved));
    }
  }, []);

  // === CLICK OUTSIDE TO CLOSE ALL MENUS ===
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showConfig && configRef.current && !configRef.current.contains(event.target)) {
        setShowConfig(false);
      }
      if (showMobileMenu && mobileRef.current && !mobileRef.current.contains(event.target)) {
        setShowMobileMenu(false);
      }
      if (showJaguarMenu && jaguarRef.current && !jaguarRef.current.contains(event.target)) {
        setShowJaguarMenu(false);
      }
    };

    if (showConfig || showMobileMenu || showJaguarMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showConfig, showMobileMenu, showJaguarMenu]);

  const saveMints = (mints) => {
    localStorage.setItem("savedMints", JSON.stringify(mints));
    setSavedMints(mints);
  };

  const addMint = () => {
    if (!newMintUrl) return;
    let url = newMintUrl.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    if (!savedMints.includes(url)) {
      saveMints([...savedMints, url]);
    }
    setNewMintUrl("");
    setShowConfig(false);
  };

  const removeMint = (urlToRemove) => {
    const updated = savedMints.filter(url => url !== urlToRemove);
    saveMints(updated);
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const updated = [...savedMints];
    [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
    saveMints(updated);
  };

  const moveDown = (index) => {
    if (index === savedMints.length - 1) return;
    const updated = [...savedMints];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    saveMints(updated);
  };

  return (
    <nav className="glass border-b border-[#4ff4c6]/20 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">

        {/* LEFT SIDE */}
        <div className="flex items-center gap-4">
          {/* JAGUAR LOGO - CLICKABLE */}
          <button
            onClick={() => setShowJaguarMenu(!showJaguarMenu)}
            className="p-1 hover:bg-white/10 rounded-2xl transition-colors"
          >
            <Image 
              src="/jaguar-logo.png" 
              alt="CocoaWallet Menu" 
              width={69}
              height={69}
              className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
              priority
            />
          </button>

          <h1 className="text-2xl font-semibold tracking-tighter text-[#e8fff7]">
            CocoaWallet
          </h1>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 hover:bg-white/10 rounded-2xl transition-colors"
          >
            <Image 
              src="/palenque-logo2.png" 
              alt="Manage Mints" 
              width={100}
              height={100}
              className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
              priority
            />
          </button>
        </div>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            {savedMints.slice(0, 3).map((mint) => (
              <button
                key={mint}
                onClick={() => onSwitchMint(mint)}
                className={`px-6 py-3 text-xs font-medium rounded-3xl transition-all whitespace-nowrap ${
                  activeMint === mint
                    ? "bg-[#4ff4c6] text-[#0f1c18] shadow-[0_0_30px_#4ff4c6] scale-105 ring-2 ring-[#a3ffe0]/50"
                    : "bg-[#1e3a32] border border-[#4ff4c6]/30 text-[#e8fff7]/90 hover:border-[#4ff4c6]"
                }`}
              >
                {mint.replace("https://", "").replace(/\/$/, "")}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 text-2xl text-[#e8fff7] hover:bg-white/10 rounded-xl"
          >
            ☰
          </button>
        </div>
      </div>

      {/* CONFIG MENU (Palenque) */}
      {showConfig && (
        <div ref={configRef} className="absolute top-16 left-6 bg-[#1e3a32] border border-[#4ff4c6]/30 rounded-3xl shadow-xl p-10 w-90 z-70">
          <h3 className="text-[#4ff4c6] text-sm font-medium mb-4">Manage Mints</h3>
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newMintUrl}
              onChange={(e) => setNewMintUrl(e.target.value)}
              placeholder="https://mint.example.com"
              className="flex-1 bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-4 py-3 text-sm text-[#e8fff7]"
            />
            <button onClick={addMint} className="bg-[#4ff4c6] text-[#0f1c18] px-6 rounded-3xl text-sm font-medium">Add</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {savedMints.map((mint, index) => (
              <div key={mint} className="flex items-center justify-between py-3 border-b border-white/10 last:border-none">
                <span className="text-sm text-[#e8fff7]">{mint.replace("https://", "")}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => moveUp(index)} disabled={index === 0} className="px-3 py-1 text-xs text-[#4ff4c6] hover:bg-white/10 rounded-xl disabled:opacity-30">↑</button>
                  <button onClick={() => moveDown(index)} disabled={index === savedMints.length - 1} className="px-3 py-1 text-xs text-[#4ff4c6] hover:bg-white/10 rounded-xl disabled:opacity-30">↓</button>
                  <button onClick={() => removeMint(mint)} className="px-3 py-1 text-xs text-red-400 hover:bg-white/10 rounded-xl">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MOBILE MENU */}
      {showMobileMenu && (
        <div ref={mobileRef} className="md:hidden absolute top-16 right-6 bg-[#1e3a32] border border-[#4ff4c6]/30 rounded-3xl shadow-xl p-4 w-64 z-50">
          {savedMints.slice(0, 3).map((mint) => (
            <button
              key={mint}
              onClick={() => { onSwitchMint(mint); setShowMobileMenu(false); }}
              className={`w-full text-left px-6 py-4 rounded-2xl mb-2 transition-all ${
                activeMint === mint ? "bg-[#4ff4c6] text-[#0f1c18]" : "hover:bg-white/10 text-[#e8fff7]"
              }`}
            >
              {mint.replace("https://", "").replace(/\/$/, "")}
            </button>
          ))}
        </div>
      )}

      {/* === JAGUAR MENU === */}
      {showJaguarMenu && (
        <div ref={jaguarRef} className="absolute top-16 left-6 bg-[#1e3a32] border border-[#4ff4c6]/30 rounded-3xl shadow-xl p-6 w-80 z-70">
          <div className="space-y-2">

            {/* Transaction History */}
            <button
              onClick={() => {
                if (onShowTransactionHistory) onShowTransactionHistory(activeMint);
                setShowJaguarMenu(false);
              }}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/10 rounded-2xl text-left transition-colors"
            >
              <span className="text-2xl">
              <Image 
              src="/clock.png" 
              alt="CocoaWallet Menu" 
              width={69}
              height={69}
              className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
              priority
            />
              </span>
              <div>
                <p className="text-[#e8fff7] font-medium">Transaction History</p>
                <p className="text-xs text-[#e8fff7]/60">
                  {activeMint ? activeMint.replace("https://", "").replace(/\/$/, "") : "No mint connected"}
                </p>
              </div>
            </button>

            <div className="h-px bg-white/10 my-2"></div>

            {/* GitHub */}
            <a
              href="https://github.com/Slender2097/cocoa-cash"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setShowJaguarMenu(false)}
              className="w-full flex items-center gap-3 px-5 py-4 hover:bg-white/10 rounded-2xl text-left transition-colors"
            >
              <span className="text-2xl">            
                
                <Image 
              src="/githubDEF.png" 
              alt="CocoaWallet Menu" 
              width={150}
              height={150}
              className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
              priority
            />
            
            </span>
              <p className="text-[#e8fff7] font-medium">Github Repository</p>
            </a>

            {/* Donation - QR Code + Copy */}
            <div className="px-5 py-4 bg-[#14251f] rounded-2xl border border-[#4ff4c6]/20">
              <p className="text-xs text-[#e8fff7]/70 mb-3 flex items-center gap-2">
                <span className="text-2xl"></span>
                Donate with Lightning or Cashu
              </p>

              <div className="flex justify-center bg-white p-3 rounded-2xl mb-4">
            <Image 
              src="/donations.jpg" 
              alt="CocoaWallet Menu" 
              width={180}
              height={180}
              className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
              priority
            />
              </div>

              <div className="font-mono text-sm text-[#e8fff7] bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl p-3 break-all text-center mb-3">
                jose@pay.bitcoinjungle.app
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText("jose@pay.bitcoinjungle.app");
                  alert("Donation address copied to clipboard!");
                  setShowJaguarMenu(false);
                }}
                className="w-full py-3 bg-[#4ff4c6] hover:bg-[#3be0b0] text-[#0f1c18] font-medium rounded-3xl transition-colors"
              >
                Copy Address
              </button>
            </div>

          </div>
        </div>
      )}
    </nav>
  );
}