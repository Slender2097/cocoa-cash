// src/components/layout/Footer.jsx
/*import React from "react";

export default function Footer() {
  return (
    <footer className="text-center text-xs text-gray-400 py-6">
      • Cocoa Standard •
    </footer>
  );
}*/

// src/components/layout/Footer.jsx
import React from "react";
import Image from "next/image";

export default function Footer({ onOpenSecurity }) {
  return (
    <footer className="border-t border-white/10 py-6 bg-[#14251f]">
      <div className="max-w-4xl mx-auto px-6 flex items-center justify-between text-xs text-[#e8fff7]/60">

        {/* Left spacer (empty) */}
        <div className="w-20"></div>

        {/* Center - Cocoa Standard */}
        <p className="text-sm font-light tracking-widest">• Cocoa Standard •</p>

        {/* Right - Security Button */}
        <button
          onClick={onOpenSecurity}
          className="flex items-center gap-1.5 hover:text-[#4ff4c6] transition-colors"
        >
                    <Image 
                      src="/security-logo.png" 
                      alt="CocoaWallet" 
                      width={100}
                      height={100}
                      className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
                      priority
                    />
        </button>
      </div>
    </footer>
  );
}