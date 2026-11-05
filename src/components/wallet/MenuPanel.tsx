// src/components/wallet/MenuPanel.tsx
// Jaguar menu: source code, donations, legal.
// MIT License

import React from "react";
import Image from "next/image";
import Link from "next/link";
import Sheet from "./Sheet";
import { CopyButton } from "./bits";

const DONATE = "jose@pay.bitcoinjungle.app";

export default function MenuPanel({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="cocoa.cash" onClose={onClose}>
      <div className="space-y-4">
        <a
          href="https://github.com/Slender2097/cocoa-cash"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 rounded-2xl border border-white/5 bg-[#07110d]/40 p-3 transition hover:border-[#4ff4c6]/50"
        >
          <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
            <Image src="/githubDEF.png" alt="" fill sizes="96px" className="scale-[1.35] object-cover" />
          </span>
          <span>
            <span className="block text-[#e8fff7]">Open source on GitHub</span>
            <span className="block text-xs text-[#e8fff7]/45">MIT licensed</span>
          </span>
        </a>

        <div className="rounded-2xl border border-white/5 bg-[#07110d]/40 p-4 text-center">
          <p className="mb-3 text-sm text-[#e8fff7]/70">Support the project with Lightning or Cashu</p>
          <div className="mx-auto w-fit overflow-hidden rounded-2xl bg-white p-2">
            <Image src="/donations.jpg" alt="Donation QR code" width={170} height={172} />
          </div>
          <p className="readout mt-3 text-center text-sm">{DONATE}</p>
          <div className="mt-3">
            <CopyButton text={DONATE} label="Copy address" />
          </div>
        </div>

        <div className="flex justify-center gap-5 pt-1 text-sm text-[#e8fff7]/50">
          <Link href="/privacy" className="hover:text-[#4ff4c6]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[#4ff4c6]">
            Terms
          </Link>
          <Link href="/creator" className="hover:text-[#4ff4c6]">
            Tip button
          </Link>
        </div>
      </div>
    </Sheet>
  );
}
