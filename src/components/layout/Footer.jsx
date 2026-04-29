// src/components/layout/Footer.jsx
import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function Footer({ onOpenSecurity }) {
  return (
    <footer className="border-t border-white/10 py-8 bg-[#14251f]">
      <div className="max-w-4xl mx-auto px-6">

        {/* === ORIGINAL TOP ROW (Security logo stays on the right) === */}
        <div className="flex items-center justify-between text-xs text-[#e8fff7]/60 mb-8">
          {/* Left spacer */}
          <div className="w-20"></div>

          {/* Center - Cocoa Standard */}
          <p className="text-sm font-light tracking-widest">• Cocoa Standard •</p>

          {/* Right - Security Button (exactly how it was) */}
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

        {/* === COPYRIGHT TEXT - PERFECTLY CENTERED BELOW === */}
        <div className="text-center text-xs text-[#e8fff7]/50 leading-tight">
          <p>© 2026 Cocoa Cash.</p>
          <p className="mt-1">All rights reserved.</p>
          
          <div className="mt-4 flex items-center justify-center gap-3 text-[#e8fff7]/60">
            <Link 
              href="/privacy"
              className="hover:text-[#4ff4c6] transition-colors"
            >
              Privacy Policy
            </Link>
            <span className="text-[#e8fff7]/30">|</span>
            <Link 
              href="/terms"
              className="hover:text-[#4ff4c6] transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}