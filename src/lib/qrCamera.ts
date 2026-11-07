// src/lib/qrCamera.ts
// Opens the right camera for QR scanning without asking the user to pick one.
// Phones and tablets ask for the rear camera (facingMode "environment");
// computers take the browser's default camera. If that camera fails, the
// other cameras are tried in turn, silently. A refused permission is not
// retried, so the user never sees more than the one normal camera prompt.
// MIT License

import type { Html5Qrcode, Html5QrcodeCameraScanConfig } from "html5-qrcode";

export type CameraStart = {
  /** Device ids of every camera, when the preferred one failed and we fell back. */
  cameras: string[];
  /** Index into `cameras` of the one now running (-1 when the preferred camera runs). */
  index: number;
};

export class CameraBlockedError extends Error {}

/** Phones and tablets, including iPadOS which reports itself as a Mac. */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

const blocked = (e: unknown) => /NotAllowed|Permission|denied|Security/i.test(String(e));

/** Starts `scanner` on the best camera. Rejects with CameraBlockedError if permission is refused. */
export async function startBestCamera(
  scanner: Html5Qrcode,
  config: Html5QrcodeCameraScanConfig,
  onText: (text: string) => void
): Promise<CameraStart> {
  const noop = () => {};
  const mobile = isMobileDevice();
  try {
    // videoConstraints replaces the first argument: { facingMode: "environment" }
    // on phones, and plain {} (the default camera) on computers.
    await scanner.start(
      { facingMode: "environment" },
      { ...config, videoConstraints: mobile ? { facingMode: "environment" } : {} },
      onText,
      noop
    );
    return { cameras: [], index: -1 };
  } catch (e) {
    if (blocked(e)) throw new CameraBlockedError(String(e));
  }

  // Preferred camera failed: try the others, rear-facing ones first on phones.
  // enumerateDevices never opens a camera or prompts again.
  let list: MediaDeviceInfo[] = [];
  try {
    list = (await navigator.mediaDevices.enumerateDevices()).filter((c) => c.kind === "videoinput" && c.deviceId);
  } catch {}
  const rear = (c: MediaDeviceInfo) => Number(/back|rear|environment/i.test(c.label));
  const ordered = mobile ? [...list].sort((a, b) => rear(b) - rear(a)) : list;
  const cameras = ordered.map((c) => c.deviceId);
  for (let i = 0; i < cameras.length; i++) {
    try {
      await scanner.start(cameras[i], config, onText, noop);
      return { cameras, index: i };
    } catch (e) {
      if (blocked(e)) throw new CameraBlockedError(String(e));
    }
  }
  throw new Error("No camera available");
}

/** Stops the camera if it is running; safe to call at any time. */
export async function stopCamera(scanner: Html5Qrcode | null | undefined) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch {}
}
