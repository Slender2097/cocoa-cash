// src/pages/privacy.tsx

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#14251f] text-[#e8fff7] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[#4ff4c6] mb-10">Last Updated: October 8, 2026</p>

        <div className="prose prose-invert max-w-none text-[#e8fff7]/90 leading-relaxed text-sm space-y-8">
          <p>Cocoa Cash is a non-custodial wallet. We do not create accounts and we do not store your seed, proofs, or ecash on our servers. Those stay in your browser. The host that delivers this site can see technical request data such as IP address and user agent in ordinary server logs. We also load Vercel Analytics, which collects anonymous usage data and does not include your seed or proofs.</p>

          <p>All data (tokens, keys, and application state) is stored exclusively in your browser’s localStorage on your own device. Cocoa Cash never receives or transmits any of this information to our servers.</p>

          <h2 className="text-xl text-[#4ff4c6]">Data We Do Not Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>No account creation</li>
            <li>No email or personal information required</li>
            <li>No tracking of your transactions or mint usage</li>
            <li>No cookies used for tracking purposes</li>
          </ul>

          <h2 className="text-xl text-[#4ff4c6]">Anonymous Analytics</h2>
          <p>We use Vercel Analytics to understand how the app is used. That data is anonymous usage data. It does not include your seed, proofs, or ecash. It is still third-party processing by the host.</p>

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