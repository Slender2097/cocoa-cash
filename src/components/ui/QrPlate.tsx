// src/components/ui/QrPlate.tsx
// White plate around a QR code.
// MIT License

import { QRCodeSVG } from "qrcode.react";

export function QrPlate({ value }: { value: string }) {
  return (
    <div className="mx-auto w-fit rounded-3xl bg-white p-3 shadow-[0_0_60px_-12px_rgba(79,244,198,0.8)]">
      <QRCodeSVG value={value} size={232} level="L" marginSize={1} />
    </div>
  );
}
