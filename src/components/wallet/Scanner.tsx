// src/components/wallet/Scanner.tsx
// Camera QR scanner (html5-qrcode, loaded on demand). Strips "lightning:".
// MIT License

import { useEffect, useRef } from "react";
import Sheet from "./Sheet";

export default function Scanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const cb = useRef({ onResult, onClose });
  useEffect(() => {
    cb.current = { onResult, onClose };
  });

  useEffect(() => {
    let scanner: import("html5-qrcode").Html5QrcodeScanner | null = null;
    let cancelled = false;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 25, qrbox: { width: 260, height: 260 }, aspectRatio: 1.0, videoConstraints: { facingMode: "environment" }, rememberLastUsedCamera: true },
        false
      );
      scanner.render(
        (text: string) => {
          cb.current.onResult(text.trim().replace(/^lightning:/i, ""));
          cb.current.onClose();
        },
        () => {} // per-frame "no QR found"
      );
    });
    return () => {
      cancelled = true;
      scanner?.clear().catch(() => {});
    };
  }, []);

  return (
    <Sheet title="Scan QR" onClose={onClose} z={70}>
      <div id="qr-reader" className="overflow-hidden rounded-2xl border border-[#4ff4c6]/30" />
      <p className="mt-4 text-center text-sm text-[#e8fff7]/50">Point the camera at an invoice or token</p>
    </Sheet>
  );
}
