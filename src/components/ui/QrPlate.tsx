// src/components/ui/QrPlate.tsx
// White plate around a QR code. Long Cashu tokens get an animated QR
// (NUT-16: UR fountain-coded parts, cycled on screen) via TokenQrPlate.
// MIT License

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function QrPlate({ value }: { value: string }) {
  return (
    <div className="mx-auto w-fit rounded-3xl bg-white p-3 shadow-[0_0_60px_-12px_rgba(79,244,198,0.8)]">
      <QRCodeSVG value={value} size={232} level="L" marginSize={1} />
    </div>
  );
}

/** Longest token that still scans reliably as one static QR. */
const STATIC_MAX = 450;
/** Bytes of token per UR part, and how long each part stays on screen. */
const FRAGMENT = 150;
const FRAME_MS = 200;

/** Static QR for a short token, animated NUT-16 QR for a long one. */
export function TokenQrPlate({ token }: { token: string }) {
  const [part, setPart] = useState("");
  const animated = token.length > STATIC_MAX;

  useEffect(() => {
    if (!animated) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    import("@gandlaf21/bc-ur").then(({ UR, UREncoder }) => {
      if (cancelled) return;
      const encoder = new UREncoder(UR.from(token), FRAGMENT, 0);
      setPart(encoder.nextPart());
      timer = setInterval(() => setPart(encoder.nextPart()), FRAME_MS);
    });
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, animated]);

  if (!animated) return <QrPlate value={token} />;
  return part ? <QrPlate value={part} /> : <div className="mx-auto h-[256px] w-[256px] rounded-3xl bg-white" />;
}
