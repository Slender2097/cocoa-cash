// src/lib/tip/seal.ts
// Passphrase sealing for the creator's receiving key and for read-only
// exports. WebCrypto only: PBKDF2-SHA256 (random salt) -> AES-GCM.
// MIT License

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (bytes: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const ITERATIONS = 210000;

async function keyFrom(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export type Sealed = { v: 1; kdf: string; iter: number; salt: string; iv: string; data: string };

export async function seal(value: unknown, passphrase: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(passphrase, salt);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { v: 1, kdf: "PBKDF2-SHA256", iter: ITERATIONS, salt: b64(salt), iv: b64(iv), data: b64(data) };
}

export async function unseal<T = unknown>(box: Sealed, passphrase: string): Promise<T> {
  const key = await keyFrom(passphrase, unb64(box.salt));
  const data = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(box.iv) as BufferSource }, key, unb64(box.data) as BufferSource);
  return JSON.parse(dec.decode(data)) as T;
}
