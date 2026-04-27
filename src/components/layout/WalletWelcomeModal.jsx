// src/components/WalletWelcomeModal.jsx
import React from 'react';
import Link from 'next/link';

export default function WalletWelcomeModal({ isOpen, onAccept }) {
if (!isOpen) return null;

const handleContinue = () => {
  try {
    localStorage.setItem('cocoa-welcome-accepted', 'true');
    console.log("cocoa-welcome-accepted saved to localStorage");
  } catch (err) {
    console.error("localStorage failed (proceeding anyway):", err);
  }
  
  // Always close the modal, even if localStorage fails
  onAccept();
};

return (
<div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[9999] p-6">
<div className="max-w-md w-full bg-[#14251f] border border-[#4ff4c6]/30 rounded-3xl p-8 text-center">
<h1 className="text-4xl font-bold text-[#e8fff7] mb-6">Welcome to Cocoa Cash</h1>

<p className="text-[#e8fff7]/80 text-lg leading-relaxed mb-10">
Cocoa Cash is a free, open-source Chaumian ecash protocol Wallet built for Bitcoin that uses ecash to keep your funds secure and private.
</p>

<div className="text-[#e8fff7]/70 text-sm mb-10">
By continuing, you agree to our{' '}
<Link
href="/terms"
className="text-[#4ff4c6] underline hover:text-[#3be0b0] transition-colors"
target="_blank"
>
Terms of Service
</Link>
</div>

<button
onClick={handleContinue}
className="w-full py-5 bg-[#4ff4c6] hover:bg-[#3be0b0] text-[#14251f] font-semibold rounded-3xl text-xl transition-all"
>
Continue
</button>
</div>
</div>
);
}
