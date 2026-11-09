// src/components/wallet/Scanner.tsx
// Camera QR scanner (html5-qrcode, loaded on demand). Strips "lightning:".
// Opens the right camera straight away (rear on phones, default on computers)
// with no camera picker. Full-screen on phones, a large centered frame on
// computers, with a clear Cancel. If the preferred camera fails it falls back
// silently; only then, with several cameras, a small "Switch camera" appears.
// Animated QRs (NUT-16 / UR parts) are collected until the token is complete.
// MIT License

import { useCallback, useEffect, useRef, useState } from "react";
import type { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";
import type { URDecoder } from "@gandlaf21/bc-ur";
import { CameraBlockedError, startBestCamera, stopCamera } from "@/lib/qrCamera";

const READER_ID = "qr-reader";

const config: Html5QrcodeCameraScanConfig = {
  fps: 20,
  aspectRatio: 1,
  disableFlip: true,
  // aim box: most of the frame, so a code is easy to catch
  qrbox: (w, h) => {
    const s = Math.max(120, Math.floor(Math.min(w, h) * 0.72));
    return { width: s, height: s };
  },
};

export default function Scanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const cb = useRef({ onResult, onClose });
  useEffect(() => {
    cb.current = { onResult, onClose };
  });

  const scanner = useRef<Html5Qrcode | null>(null);
  const alive = useRef(true);
  const done = useRef(false);
  const [status, setStatus] = useState<"starting" | "live" | "blocked" | "none">("starting");
  const [fallback, setFallback] = useState<{ cameras: string[]; index: number } | null>(null);
  // NUT-16 animated QR: the decoder class (loaded with the camera) and the parts so far
  const urLib = useRef<typeof URDecoder | null>(null);
  const ur = useRef<URDecoder | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const handle = useCallback((raw: string) => {
    if (done.current) return;
    let text = raw;
    if (/^ur:/i.test(raw.trim())) {
      if (!urLib.current) return; // decoder still loading: wait for the next frame
      const d = (ur.current ??= new urLib.current());
      try {
        d.receivePart(raw.trim().toLowerCase());
      } catch {
        return; // misread frame: skip it, the next one will do
      }
      if (!d.isComplete()) return setProgress(Math.floor(d.estimatedPercentComplete() * 100));
      if (!d.isSuccess()) {
        ur.current = null;
        return setProgress(0);
      }
      text = d.resultUR().decodeCBOR().toString();
    }
    done.current = true;
    stopCamera(scanner.current);
    cb.current.onResult(text.trim().replace(/^lightning:/i, ""));
    cb.current.onClose();
  }, []);

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    import("@gandlaf21/bc-ur").then((m) => (urLib.current = m.URDecoder));
    import("html5-qrcode").then(async ({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
      if (cancelled) return;
      const s = new Html5Qrcode(READER_ID, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        // native BarcodeDetector where the browser has it: faster, smoother
        useBarCodeDetectorIfSupported: true,
      });
      scanner.current = s;
      try {
        const r = await startBestCamera(s, config, handle);
        if (cancelled) return stopCamera(s);
        if (r.cameras.length > 1) setFallback(r);
        setStatus("live");
      } catch (e) {
        if (!cancelled) setStatus(e instanceof CameraBlockedError ? "blocked" : "none");
      }
    });
    // Escape closes only the scanner, not the sheet underneath it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      cb.current.onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      cancelled = true;
      alive.current = false;
      window.removeEventListener("keydown", onKey, true);
      stopCamera(scanner.current);
    };
  }, [handle]);

  const switchCamera = async () => {
    const s = scanner.current;
    if (!s || !fallback) return;
    const next = (fallback.index + 1) % fallback.cameras.length;
    setStatus("starting");
    await stopCamera(s);
    try {
      await s.start(fallback.cameras[next], config, handle, () => {});
      if (!alive.current) return stopCamera(s);
      setFallback({ ...fallback, index: next });
      setStatus("live");
    } catch {
      if (alive.current) setStatus("none");
    }
  };

  const message =
    status === "blocked"
      ? "Camera access is blocked. Allow the camera for this site in your browser settings, then try again."
      : status === "none"
        ? "No camera could be opened on this device."
        : null;

  return (
    <div
      className="anim-fade fixed inset-0 z-[70] flex flex-col bg-[#020806]/95 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex w-full flex-1 flex-col sm:max-w-[560px] sm:flex-none">
        <div
          className="flex items-center justify-between px-5 pb-3 sm:px-1"
          style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
        >
          <h2 className="text-xl font-medium tracking-wide text-[#e8fff7]">Scan QR</h2>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="-mr-2 grid h-12 w-12 place-items-center rounded-full bg-white/5 text-3xl leading-none text-[#e8fff7] transition hover:bg-white/10"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center sm:flex-none">
          {/* square viewfinder: full width on phones, never taller than the screen allows */}
          <div
            className="relative flex aspect-square w-full items-center overflow-hidden bg-black sm:rounded-3xl sm:border sm:border-[#4ff4c6]/30"
            style={{ maxWidth: "calc(100dvh - 240px)" }}
          >
            <div id={READER_ID} className="w-full" />
            {status !== "live" && (
              <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm text-[#e8fff7]/70">
                {message ?? "Opening camera…"}
              </div>
            )}
          </div>
        </div>

        <div
          className="flex flex-col items-center gap-3 px-5 pt-4 sm:px-0"
          style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          {!message && (
            <p className="text-center text-sm text-[#e8fff7]/60">
              {progress === null
                ? "Point the camera at an invoice or token"
                : `Hold steady, reading animated QR… ${progress}%`}
            </p>
          )}
          {fallback && status === "live" && (
            <button onClick={switchCamera} className="text-sm text-[#4ff4c6]/80 underline-offset-4 hover:underline">
              Switch camera
            </button>
          )}
          <button
            onClick={onClose}
            className="h-14 w-full rounded-2xl border border-[#4ff4c6]/40 bg-white/5 text-base font-medium text-[#e8fff7] transition hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
