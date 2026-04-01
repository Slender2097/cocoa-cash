// src/components/layout/Navbar.jsx
/*import React from "react";

export default function Navbar() {
  return (
    <nav className="bg-gray-900 text-white p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl">🍫</span>
        <h1 className="text-2xl font-bold">Cocoa Wallet</h1>
      </div>
      <p className="text-sm opacity-75">ecash wallet</p>
    </nav>
  );
}*/

// src/components/layout/Navbar.jsx
// src/components/layout/Navbar.jsx
// src/components/layout/Navbar.jsx
import React from "react";
import Image from "next/image";

export default function Navbar({ activeMint }) {
  return (
    <nav className="glass border-b border-[#4ff4c6]/20 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">

        {/* Your neon jaguar logo - clean & glowing */}
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

        {/* Current mint */}
        {activeMint && (
          <div className="px-5 py-2 text-xs font-medium bg-[#1e3a32] rounded-3xl border border-[#4ff4c6]/30 text-[#e8fff7]/90">
            {activeMint}
          </div>
        )}
      </div>
    </nav>
  );
}