// src/pages/privacy.jsx
import React from 'react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#14251f] text-[#e8fff7] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[#4ff4c6] mb-10">Last Updated: April 26, 2026</p>

        <div className="prose prose-invert max-w-none text-[#e8fff7]/90 leading-relaxed text-sm space-y-8">
          <p>Cocoa Cash is a fully non-custodial wallet. We do not collect, store, or have access to any personal data, including IP addresses, email addresses, wallet keys, ecash tokens, or NWC tokens.</p>

          <p>All data (tokens, keys, and application state) is stored exclusively in your browser’s localStorage on your own device. Cocoa Cash never receives or transmits any of this information to our servers.</p>

          <h2 className="text-xl text-[#4ff4c6]">Data We Do Not Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>No account creation</li>
            <li>No email or personal information required</li>
            <li>No tracking of your transactions or mint usage</li>
            <li>No cookies used for tracking purposes</li>
          </ul>

          <h2 className="text-xl text-[#4ff4c6]">Anonymous Analytics</h2>
          <p>We use Vercel Analytics to understand how the app is used. This data is completely anonymous and does not include any personal or wallet-related information.</p>

          <h2 className="text-xl text-[#4ff4c6]">Third-Party Services</h2>
          <p>When you interact with mints or Lightning nodes, you do so directly. Cocoa Cash has no visibility into or control over those interactions.</p>

          <h2 className="text-xl text-[#4ff4c6]">Your Responsibility</h2>
          <p>Because everything is stored locally on your device, you are responsible for the security of your browser and device. We recommend backing up your tokens and not using private/incognito windows if you want to keep your data.</p>

          <p className="text-xs text-[#e8fff7]/50 mt-12">
            Questions or concerns? Contact us at <a href="mailto:jose@cocoa.cash" className="text-[#4ff4c6] underline">jose@cocoa.cash</a>
          </p>

          <p className="text-xs text-[#e8fff7]/50">Cocoa Cash • Global</p>
        </div>
      </div>
    </div>
  );
}