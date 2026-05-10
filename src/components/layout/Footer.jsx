// src/components/layout/Footer.jsx
import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function Footer({ onOpenSecurity }) {
  return (
    <footer className="border-t border-white/10 py-8 bg-[#14251f]">
      <div className="max-w-4xl mx-auto px-6">

        <div className="flex items-center justify-between">

          {/* LEFT SPACER - only on desktop */}
          <div className="hidden md:block w-20"></div>

          {/* CENTER - Copyright + Links */}
          <div className="text-center text-xs text-[#e8fff7]/50 leading-tight md:ml-20">
            <p>© 2026 cocoa.cash</p>
            <p className="mt-1">All rights reserved.</p>
            
            <div className="mt-3 flex items-center justify-center gap-3 text-[#e8fff7]/60 md:ml-5">
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

          {/* RIGHT - Security Logo */}
          <button
            onClick={onOpenSecurity}
            className="flex items-center hover:text-[#4ff4c6] transition-colors"
          >
            <Image 
              src="/security-logo.png" 
              alt="Security Settings" 
              width={160}
              height={160}
              className="object-contain drop-shadow-[0_0_20px_#4ff4c6]"
              priority
            />
          </button>

        </div>

      </div>
    </footer>
  );
}