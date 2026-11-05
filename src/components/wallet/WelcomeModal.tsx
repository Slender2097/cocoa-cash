// src/components/wallet/WelcomeModal.tsx
// First-visit welcome; stores `cocoa-welcome-accepted`.
// MIT License

import Image from "next/image";
import Link from "next/link";

export default function WelcomeModal({ onAccept }: { onAccept: () => void }) {
  const accept = () => {
    try {
      localStorage.setItem("cocoa-welcome-accepted", "true");
    } catch {
      // still close
    }
    onAccept();
  };

  return (
    <div className="anim-fade fixed inset-0 z-[90] grid place-items-center bg-[#020806]/85 p-6 backdrop-blur-md">
      <div className="glass anim-rise w-full max-w-sm rounded-[2rem] p-8 text-center">
        <Image src="/jaguar-logo.png" alt="" width={120} height={90} className="mx-auto drop-shadow-[0_0_24px_#4ff4c6]" priority />
        <h1 className="mt-5 text-3xl font-light tracking-wide glow-text">cocoa.cash</h1>
        <p className="mt-4 leading-relaxed text-[#e8fff7]/70">
          A free, open-source Cashu ecash wallet for Bitcoin. Your sats stay in this browser.
        </p>
        <button onClick={accept} className="btn-neon mt-8">
          Enter
        </button>
        <p className="mt-4 text-xs text-[#e8fff7]/45">
          By continuing you agree to the{" "}
          <Link href="/terms" target="_blank" className="text-[#4ff4c6] underline underline-offset-2">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
