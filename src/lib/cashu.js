// src/lib/cashu.js
import { getEncodedTokenV4, getDecodedToken } from "@cashu/cashu-ts";

export const replacer = (key, value) =>
  typeof value === "bigint" ? value.toString() + "n" : value;

export const reviver = (key, value) => {
  if (typeof value === "string" && /^\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
};

export const cleanProof = (p) => {
  if (!p || typeof p !== "object" || !p.secret || typeof p.secret !== "string" || p.secret.length < 64) {
    return null;
  }
  return {
    ...p,
    id: p.id || null,
    amount: Number(p.amount) || 0,
  };
};

export const resolveKeysetId = async (wallet, shortOrFullId) => {
  if (!shortOrFullId) throw new Error("Missing keyset ID");
  if (shortOrFullId.length >= 64) return shortOrFullId;

  await wallet.loadMint();
  const raw = await wallet.mint.getKeys();
  const fullId = raw.keysets?.find((ks) => ks.id?.startsWith(shortOrFullId))?.id;
  if (!fullId) throw new Error(`Couldn't map short keyset ID ${shortOrFullId}`);
  return fullId;
};

export const normalizeMintUrl = (url) => url.trim().replace(/\/+$/, "");