/*import React from "react";
import Image from "next/image";

export default function Navbar({ activeMint }) {
  return (
    <nav className="glass border-b border-[#4ff4c6]/20 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">


        <div className="flex items-center gap-3">
          <Image 
            src="/jaguar-logo.png" 
            alt="CocoaWallet" 
            width={52}
            height={52}
            className="object-contain drop-shadow-[0_0_25px_#4ff4c6] brightness-125"
            priority
          />
          <h1 className="text-2xl font-semibold tracking-tighter text-[#e8fff7]">
            Cocoa Wallet
          </h1>
        </div>


        {activeMint && (
          <div className="px-5 py-2 text-xs font-medium bg-[#1e3a32] rounded-3xl border border-[#4ff4c6]/30 text-[#e8fff7]/90">
            {activeMint}
          </div>
        )}
      </div>
    </nav>
  );
}

// src/components/layout/Navbar.jsx
import React, { useState, useEffect } from "react";
import Image from "next/image";

export default function Navbar({ activeMint, onSwitchMint }) {
  const [savedMints, setSavedMints] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [newMintUrl, setNewMintUrl] = useState("");

  // Load saved mints from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("savedMints");
    if (saved) {
      setSavedMints(JSON.parse(saved));
    }
  }, []);

  // Save mints to localStorage
  const saveMints = (mints) => {
    localStorage.setItem("savedMints", JSON.stringify(mints));
    setSavedMints(mints);
  };

  const addMint = () => {
    if (!newMintUrl) return;
    let url = newMintUrl.trim();
    if (!url.startsWith("http")) url = "https://" + url;
    if (!savedMints.includes(url)) {
      const updated = [...savedMints, url].slice(0, 3); // max 3 mints
      saveMints(updated);
    }
    setNewMintUrl("");
    setShowConfig(false);
  };

  const removeMint = (urlToRemove) => {
    const updated = savedMints.filter(url => url !== urlToRemove);
    saveMints(updated);
  };

  return (
    <nav className="glass border-b border-[#4ff4c6]/20 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">


        <div className="flex items-center gap-4">
          <Image 
            src="/jaguar-logo.png" 
            alt="CocoaWallet" 
            width={48}
            height={48}
            className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
            priority
          />
          <h1 className="text-2xl font-semibold tracking-tighter text-[#e8fff7]">
            CocoaWallet
          </h1>


          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 hover:bg-white/10 rounded-2xl transition-colors"
          >
            ⚙️
          </button>
        </div>

   
        <div className="flex items-center gap-2">
          {savedMints.map((mint) => (
            <button
              key={mint}
              onClick={() => onSwitchMint(mint)}
              className={`px-4 py-2 text-xs font-medium rounded-3xl transition-all ${
                activeMint === mint
                  ? "bg-[#4ff4c6] text-[#0f1c18]"
                  : "bg-[#1e3a32] border border-[#4ff4c6]/30 text-[#e8fff7]/90 hover:border-[#4ff4c6]"
              }`}
            >
              {mint.replace("https://", "").replace(/\/$/, "")}
            </button>
          ))}
        </div>
      </div>


      {showConfig && (
        <div className="absolute top-16 left-6 bg-[#1e3a32] border border-[#4ff4c6]/30 rounded-3xl shadow-xl p-5 w-80 z-50">
          <h3 className="text-[#4ff4c6] text-sm font-medium mb-3">Manage Mints</h3>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newMintUrl}
              onChange={(e) => setNewMintUrl(e.target.value)}
              placeholder="https://mint.example.com"
              className="flex-1 bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-4 py-3 text-sm text-[#e8fff7]"
            />
            <button
              onClick={addMint}
              className="bg-[#4ff4c6] text-[#0f1c18] px-5 rounded-3xl text-sm font-medium"
            >
              Add
            </button>
          </div>

          <div className="text-xs text-[#e8fff7]/70 mb-2">Saved Mints ({savedMints.length}/3)</div>
          
          {savedMints.map((mint) => (
            <div key={mint} className="flex items-center justify-between py-2 border-b border-white/10 last:border-none">
              <span className="text-sm">{mint}</span>
              <button
                onClick={() => removeMint(mint)}
                className="text-red-400 text-xs hover:text-red-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}*/

// src/components/layout/Navbar.jsx
import React, { useState, useEffect } from "react";
import Image from "next/image";

export default function Navbar({ activeMint, onSwitchMint }) {
  const [savedMints, setSavedMints] = useState([]);
  const [showConfig, setShowConfig] = useState(false);
  const [newMintUrl, setNewMintUrl] = useState("");

  // Load saved mints
  useEffect(() => {
    const saved = localStorage.getItem("savedMints");
    if (saved) {
      setSavedMints(JSON.parse(saved));
    }
  }, []);

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

  // Move mint up
  const moveUp = (index) => {
    if (index === 0) return;
    const updated = [...savedMints];
    [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
    saveMints(updated);
  };

  // Move mint down
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
          <Image 
            src="/jaguar-logo.png" 
            alt="CocoaWallet" 
            width={69}
            height={69}
            className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
            priority
          />
          <h1 className="text-2xl font-semibold tracking-tighter text-[#e8fff7]">
            CocoaWallet
          </h1>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 hover:bg-white/10 rounded-2xl transition-colors"
          >
          <Image 
            src="/palenque-logo2.png" 
            alt="CocoaWallet" 
            width={100}
            height={100}
            className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
            priority
          />
          </button>
        </div>

        {/* RIGHT SIDE - First 3 mints */}
        <div className="flex items-center gap-2">
          {savedMints.slice(0, 3).map((mint) => (
            <button
              key={mint}
              onClick={() => onSwitchMint(mint)}
              className={`px-6 py-3 text-xs font-medium rounded-3xl transition-all ${
                activeMint === mint
                  ? "bg-[#4ff4c6] text-[#0f1c18]"
                  : "bg-[#1e3a32] border border-[#4ff4c6]/30 text-[#e8fff7]/90 hover:border-[#4ff4c6]"
              }`}
            >
              {mint.replace("https://", "").replace(/\/$/, "")}
            </button>
          ))}
        </div>
      </div>

      {/* CONFIGURATION DROPDOWN */}
      {showConfig && (
        <div className="absolute top-16 left-6 bg-[#1e3a32] border border-[#4ff4c6]/30 rounded-3xl shadow-xl p-10 w-90 z-70">
          <h3 className="text-[#4ff4c6] text-sm font-medium mb-4">Manage Mints</h3>

          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={newMintUrl}
              onChange={(e) => setNewMintUrl(e.target.value)}
              placeholder="https://mint.example.com"
              className="flex-1 bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl px-4 py-3 text-sm text-[#e8fff7]"
            />
            <button
              onClick={addMint}
              className="bg-[#4ff4c6] text-[#0f1c18] px-6 rounded-3xl text-sm font-medium"
            >
              Add
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {savedMints.map((mint, index) => (
              <div key={mint} className="flex items-center justify-between py-3 border-b border-white/10 last:border-none">
                <span className="text-sm text-[#e8fff7]">{mint.replace("https://", "")}</span>

                <div className="flex items-center gap-1">
                  {/* Move Up */}
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="px-3 py-1 text-xs text-[#4ff4c6] hover:bg-white/10 rounded-xl disabled:opacity-30"
                  >
                    ↑
                  </button>

                  {/* Move Down */}
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === savedMints.length - 1}
                    className="px-3 py-1 text-xs text-[#4ff4c6] hover:bg-white/10 rounded-xl disabled:opacity-30"
                  >
                    ↓
                  </button>

                  {/* Remove */}
                  <button
                    onClick={() => removeMint(mint)}
                    className="px-3 py-1 text-xs text-red-400 hover:bg-white/10 rounded-xl"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

