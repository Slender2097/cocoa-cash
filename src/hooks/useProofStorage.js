/*

ONE

import { useState, useEffect, useMemo, useCallback } from "react";

export default function useProofStorage() {
  const [activeMint, setActiveMint] = useState("");
  const [proofsByMint, setProofsByMint] = useState({});
  const [hydrated, setHydrated] = useState(false);

  const replacer = (key, value) =>
    typeof value === 'bigint' ? value.toString() + 'n' : value;

  const reviver = (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  };

  const cleanProof = (p) => {
    if (!p || typeof p !== "object" || !p.secret || typeof p.secret !== "string" || p.secret.length < 64) {
      return null;
    }
    return {
      ...p,
      id: p.id || null,           // keeps FULL 64-char ID internally
      amount: Number(p.amount) || 0,
    };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedActive = localStorage.getItem("activeMint") || "";
      setActiveMint(storedActive);

      const stored = localStorage.getItem("proofsByMint");
      if (stored) {
        const parsed = JSON.parse(stored, reviver);
        if (typeof parsed === "object" && parsed !== null) {
          const cleaned = {};
          Object.entries(parsed).forEach(([mintUrl, proofs]) => {
            if (Array.isArray(proofs)) {
              cleaned[mintUrl] = proofs.map(cleanProof).filter(Boolean);
            }
          });
          setProofsByMint(cleaned);
        }
      }
    } catch (err) {
      console.error("Failed to load proof storage:", err);
      localStorage.removeItem("proofsByMint");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("activeMint", activeMint); }, [activeMint]);
  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint, replacer)); }, [proofsByMint]);

  const currentProofs = useMemo(() => proofsByMint[activeMint] || [], [proofsByMint, activeMint]);
  const balance = useMemo(() => currentProofs.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0), [currentProofs]);

  const getProofsByAmount = useCallback((targetAmount) => {
    if (!targetAmount || targetAmount <= 0) return [];
    const sorted = [...currentProofs].sort((a, b) => b.amount - a.amount);
    let sum = 0;
    const selected = [];
    for (const proof of sorted) {
      if (sum >= targetAmount) break;
      if (sum + proof.amount <= targetAmount * 3 || selected.length === 0) {
        selected.push(proof);
        sum += proof.amount;
      }
    }
    return selected;
  }, [currentProofs]);

  const getProofsByAmountFromMint = useCallback((mintUrl, targetAmount) => {
    const mintProofs = proofsByMint[mintUrl] || [];
    if (!mintProofs.length) return { selected: [], remaining: targetAmount };
    const sorted = [...mintProofs].sort((a, b) => b.amount - a.amount);
    let remaining = targetAmount;
    const selected = [];
    for (const proof of sorted) {
      if (remaining <= 0) break;
      if (proof.amount <= remaining) {
        selected.push(proof);
        remaining -= proof.amount;
      }
    }
    return { selected, remaining };
  }, [proofsByMint]);

  const addProofsToMint = useCallback((mintUrl, newProofs, keysetId = null) => {
    if (!mintUrl || !Array.isArray(newProofs) || newProofs.length === 0) return;
    setProofsByMint(prev => {
      const existing = prev[mintUrl] || [];
      const existingSecrets = new Set(existing.map(p => p.secret));
      const uniqueNew = newProofs
        .map(p => {
          const cleaned = cleanProof(p);
          if (!cleaned) return null;
          if (!cleaned.id && keysetId) cleaned.id = keysetId;
          return cleaned;
        })
        .filter(Boolean)
        .filter(p => !existingSecrets.has(p.secret));

      if (uniqueNew.length === 0) return prev;

      const newList = [...existing, ...uniqueNew];
      console.log(`[HOOK ADD] Added ${uniqueNew.length} proofs to ${mintUrl} → total: ${newList.length}`);
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const removeProofsFromMint = useCallback((mintUrl, proofsToRemove) => {
    if (!mintUrl || !proofsToRemove?.length) return;
    const secretsToRemove = new Set(proofsToRemove.map(p => p.secret).filter(Boolean));
    setProofsByMint(prev => {
      const mintProofs = prev[mintUrl] || [];
      const newList = mintProofs.filter(p => !secretsToRemove.has(p.secret));
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const addProofs = useCallback((newProofs, keysetId = null) => {
    if (!activeMint) return;
    addProofsToMint(activeMint, newProofs, keysetId);
  }, [activeMint, addProofsToMint]);

  const removeProofs = useCallback((proofsToRemove) => {
    removeProofsFromMint(activeMint, proofsToRemove);
  }, [activeMint, removeProofsFromMint]);

  const switchMint = useCallback((newUrl) => {
    if (newUrl && typeof newUrl === "string") setActiveMint(newUrl.trim());
  }, []);

  const resetMint = useCallback((mintUrl) => {
    setProofsByMint(prev => {
      const newState = { ...prev };
      delete newState[mintUrl];
      return newState;
    });
  }, []);

  return {
    activeMint,
    switchMint,
    currentProofs,
    balance,
    hydrated,
    getProofsByAmount,
    getProofsByAmountFromMint,
    addProofs,
    removeProofs,
    proofsByMint,
    addProofsToMint,
    removeProofsFromMint,
    resetMint,
  };
}

two

import { useState, useEffect, useMemo, useCallback } from "react";
import { replacer, reviver, cleanProof } from "@/lib/cashu";

export default function useProofStorage() {
  const [activeMint, setActiveMint] = useState("");
  const [proofsByMint, setProofsByMint] = useState({});
  const [hydrated, setHydrated] = useState(false);

  const replacerLocal = (key, value) =>
    typeof value === 'bigint' ? value.toString() + 'n' : value;

  const reviverLocal = (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  };

  const cleanProofLocal = (p) => {
    if (!p || typeof p !== "object" || !p.secret || typeof p.secret !== "string" || p.secret.length < 64) {
      return null;
    }
    return {
      ...p,
      id: p.id || null,
      amount: Number(p.amount) || 0,
    };
  };

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedActive = localStorage.getItem("activeMint") || "";
      setActiveMint(storedActive);

      const stored = localStorage.getItem("proofsByMint");
      if (stored) {
        const parsed = JSON.parse(stored, reviverLocal);
        if (typeof parsed === "object" && parsed !== null) {
          const cleaned = {};
          Object.entries(parsed).forEach(([mintUrl, proofs]) => {
            if (Array.isArray(proofs)) {
              cleaned[mintUrl] = proofs.map(cleanProofLocal).filter(Boolean);
            }
          });
          setProofsByMint(cleaned);
        }
      }
    } catch (err) {
      console.error("Failed to load proof storage:", err);
      localStorage.removeItem("proofsByMint");
    } finally {
      setHydrated(true);
    }
  }, []);

  // SAVE ONLY AFTER HYDRATION IS COMPLETE
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    localStorage.setItem("activeMint", activeMint);
  }, [activeMint, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint, replacerLocal));
  }, [proofsByMint, hydrated]);

  const currentProofs = useMemo(() => proofsByMint[activeMint] || [], [proofsByMint, activeMint]);
  const balance = useMemo(() => currentProofs.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0), [currentProofs]);

  const getProofsByAmount = useCallback((targetAmount) => {
    if (!targetAmount || targetAmount <= 0) return [];
    const sorted = [...currentProofs].sort((a, b) => b.amount - a.amount);
    let sum = 0;
    const selected = [];
    for (const proof of sorted) {
      if (sum >= targetAmount) break;
      if (sum + proof.amount <= targetAmount * 3 || selected.length === 0) {
        selected.push(proof);
        sum += proof.amount;
      }
    }
    return selected;
  }, [currentProofs]);

  const getProofsByAmountFromMint = useCallback((mintUrl, targetAmount) => {
    const mintProofs = proofsByMint[mintUrl] || [];
    if (!mintProofs.length) return { selected: [], remaining: targetAmount };
    const sorted = [...mintProofs].sort((a, b) => b.amount - a.amount);
    let remaining = targetAmount;
    const selected = [];
    for (const proof of sorted) {
      if (remaining <= 0) break;
      if (proof.amount <= remaining) {
        selected.push(proof);
        remaining -= proof.amount;
      }
    }
    return { selected, remaining };
  }, [proofsByMint]);

  const addProofsToMint = useCallback((mintUrl, newProofs, keysetId = null) => {
    if (!mintUrl || !Array.isArray(newProofs) || newProofs.length === 0) return;
    setProofsByMint(prev => {
      const existing = prev[mintUrl] || [];
      const existingSecrets = new Set(existing.map(p => p.secret));
      const uniqueNew = newProofs
        .map(p => {
          const cleaned = cleanProofLocal(p);
          if (!cleaned) return null;
          if (!cleaned.id && keysetId) cleaned.id = keysetId;
          return cleaned;
        })
        .filter(Boolean)
        .filter(p => !existingSecrets.has(p.secret));

      if (uniqueNew.length === 0) return prev;

      const newList = [...existing, ...uniqueNew];
      console.log(`[HOOK ADD] Added ${uniqueNew.length} proofs to ${mintUrl} → total: ${newList.length}`);
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const removeProofsFromMint = useCallback((mintUrl, proofsToRemove) => {
    if (!mintUrl || !proofsToRemove?.length) return;
    const secretsToRemove = new Set(proofsToRemove.map(p => p.secret).filter(Boolean));
    setProofsByMint(prev => {
      const mintProofs = prev[mintUrl] || [];
      const newList = mintProofs.filter(p => !secretsToRemove.has(p.secret));
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const addProofs = useCallback((newProofs, keysetId = null) => {
    if (!activeMint) return;
    addProofsToMint(activeMint, newProofs, keysetId);
  }, [activeMint, addProofsToMint]);

  const removeProofs = useCallback((proofsToRemove) => {
    removeProofsFromMint(activeMint, proofsToRemove);
  }, [activeMint, removeProofsFromMint]);

  const switchMint = useCallback((newUrl) => {
    if (newUrl && typeof newUrl === "string") setActiveMint(newUrl.trim());
  }, []);

  const resetMint = useCallback((mintUrl) => {
    setProofsByMint(prev => {
      const newState = { ...prev };
      delete newState[mintUrl];
      return newState;
    });
  }, []);

  return {
    activeMint,
    switchMint,
    currentProofs,
    balance,
    hydrated,
    getProofsByAmount,
    getProofsByAmountFromMint,
    addProofs,
    removeProofs,
    proofsByMint,
    addProofsToMint,
    removeProofsFromMint,
    resetMint,
  };
}

towk fine in progress

import { useState, useEffect, useMemo, useCallback } from "react";
import { replacer, reviver, cleanProof } from "@/lib/cashu";
import { encrypt, decrypt } from "@/lib/encryption";

let currentPassword = null;

export function setCurrentPassword(password) {
  currentPassword = password;
}

export function clearCurrentPassword() {
  currentPassword = null;
}

export default function useProofStorage() {
  const [securityLevel, setSecurityLevel] = useState(() => {
    if (typeof window === "undefined") return 1;
    return parseInt(localStorage.getItem("securityLevel") || "1", 10);
  });

  const [activeMint, setActiveMint] = useState("");
  const [storedRaw, setStoredRaw] = useState(null);
  const [proofsByMint, setProofsByMint] = useState({});
  const [hydrated, setHydrated] = useState(false);

  const replacerLocal = (key, value) =>
    typeof value === 'bigint' ? value.toString() + 'n' : value;

  const reviverLocal = (key, value) => {
    if (typeof value === 'string' && /^\d+n$/.test(value)) {
      return BigInt(value.slice(0, -1));
    }
    return value;
  };

  const cleanProofLocal = (p) => {
    if (!p || typeof p !== "object" || !p.secret || typeof p.secret !== "string" || p.secret.length < 64) {
      return null;
    }
    return {
      ...p,
      id: p.id || null,
      amount: Number(p.amount) || 0,
    };
  };

  const processStoredProofs = (parsed) => {
    const cleaned = {};
    Object.entries(parsed || {}).forEach(([mintUrl, proofs]) => {
      if (Array.isArray(proofs)) {
        cleaned[mintUrl] = proofs.map(cleanProofLocal).filter(Boolean);
      }
    });
    return cleaned;
  };

  // Load from localStorage (runs once on mount)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedActive = localStorage.getItem("activeMint") || "";
      setActiveMint(storedActive);

      const stored = localStorage.getItem("proofsByMint");
      setStoredRaw(stored);

      // Level 1: auto-load plaintext immediately
      if (stored && securityLevel === 1) {
        const parsed = JSON.parse(stored, reviverLocal);
        if (typeof parsed === "object" && parsed !== null) {
          setProofsByMint(processStoredProofs(parsed));
          console.log("Level 1 wallet loaded (plain text)");
        }
      }
      // Level > 1: remain locked until unlockWallet is called
    } catch (err) {
      console.error("Failed to load proof storage:", err);
      localStorage.removeItem("proofsByMint");
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist activeMint
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    localStorage.setItem("activeMint", activeMint);
  }, [activeMint, hydrated]);

  // Persist securityLevel
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    localStorage.setItem("securityLevel", securityLevel.toString());
  }, [securityLevel, hydrated]);

  // Save proofsByMint (plain or encrypted depending on securityLevel)
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;

    const saveProofs = async () => {
      try {
        if (securityLevel > 1 && currentPassword) {
          const encrypted = await encrypt(proofsByMint, currentPassword);
          const encryptedStr = JSON.stringify(encrypted);
          localStorage.setItem("proofsByMint", encryptedStr);
          setStoredRaw(encryptedStr);
        } else {
          const plainStr = JSON.stringify(proofsByMint, replacerLocal);
          localStorage.setItem("proofsByMint", plainStr);
          setStoredRaw(plainStr);
        }
      } catch (err) {
        console.error("Failed to save proofs:", err);
      }
    };

    saveProofs();
  }, [proofsByMint, hydrated, securityLevel]);

  // UNLOCK (called manually for encrypted wallets)
  const unlockWallet = useCallback(async (password) => {
    if (!storedRaw) return;
    setCurrentPassword(password);
    try {
      const encryptedData = JSON.parse(storedRaw);
      const decrypted = await decrypt(encryptedData, password);
      setProofsByMint(processStoredProofs(decrypted));
      console.log("Wallet successfully decrypted and loaded");
    } catch (err) {
      console.error("Decryption failed:", err.message);
      clearCurrentPassword();
      throw err;
    }
  }, [storedRaw]);

  // UPGRADE from Level 1 to Level 2 (encrypts existing data immediately)
  const upgradeToLevel2 = useCallback(async (password) => {
    setCurrentPassword(password);
    setSecurityLevel(2);

    try {
      const encrypted = await encrypt(proofsByMint, password);
      const encryptedStr = JSON.stringify(encrypted);
      localStorage.setItem("proofsByMint", encryptedStr);
      setStoredRaw(encryptedStr);
      console.log("Immediate encryption on upgrade complete");
    } catch (e) {
      console.error("Upgrade encryption failed", e);
    }
  }, [proofsByMint]);

  const currentProofs = useMemo(() => proofsByMint[activeMint] || [], [proofsByMint, activeMint]);
  const balance = useMemo(() => currentProofs.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0), [currentProofs]);

  const getProofsByAmount = useCallback((targetAmount) => {
    if (!targetAmount || targetAmount <= 0) return [];
    const sorted = [...currentProofs].sort((a, b) => b.amount - a.amount);
    let sum = 0;
    const selected = [];
    for (const proof of sorted) {
      if (sum >= targetAmount) break;
      if (sum + proof.amount <= targetAmount * 3 || selected.length === 0) {
        selected.push(proof);
        sum += proof.amount;
      }
    }
    return selected;
  }, [currentProofs]);

  const getProofsByAmountFromMint = useCallback((mintUrl, targetAmount) => {
    const mintProofs = proofsByMint[mintUrl] || [];
    if (!mintProofs.length) return { selected: [], remaining: targetAmount };
    const sorted = [...mintProofs].sort((a, b) => b.amount - a.amount);
    let remaining = targetAmount;
    const selected = [];
    for (const proof of sorted) {
      if (remaining <= 0) break;
      if (proof.amount <= remaining) {
        selected.push(proof);
        remaining -= proof.amount;
      }
    }
    return { selected, remaining };
  }, [proofsByMint]);

  const addProofsToMint = useCallback((mintUrl, newProofs, keysetId = null) => {
    if (!mintUrl || !Array.isArray(newProofs) || newProofs.length === 0) return;
    setProofsByMint(prev => {
      const existing = prev[mintUrl] || [];
      const existingSecrets = new Set(existing.map(p => p.secret));
      const uniqueNew = newProofs
        .map(p => {
          const cleaned = cleanProofLocal(p);
          if (!cleaned) return null;
          if (!cleaned.id && keysetId) cleaned.id = keysetId;
          return cleaned;
        })
        .filter(Boolean)
        .filter(p => !existingSecrets.has(p.secret));

      if (uniqueNew.length === 0) return prev;

      const newList = [...existing, ...uniqueNew];
      console.log(`[HOOK ADD] Added ${uniqueNew.length} proofs to ${mintUrl} → total: ${newList.length}`);
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const removeProofsFromMint = useCallback((mintUrl, proofsToRemove) => {
    if (!mintUrl || !proofsToRemove?.length) return;
    const secretsToRemove = new Set(proofsToRemove.map(p => p.secret).filter(Boolean));
    setProofsByMint(prev => {
      const mintProofs = prev[mintUrl] || [];
      const newList = mintProofs.filter(p => !secretsToRemove.has(p.secret));
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const addProofs = useCallback((newProofs, keysetId = null) => {
    if (!activeMint) return;
    addProofsToMint(activeMint, newProofs, keysetId);
  }, [activeMint, addProofsToMint]);

  const removeProofs = useCallback((proofsToRemove) => {
    removeProofsFromMint(activeMint, proofsToRemove);
  }, [activeMint, removeProofsFromMint]);

  const switchMint = useCallback((newUrl) => {
    if (newUrl && typeof newUrl === "string") setActiveMint(newUrl.trim());
  }, []);

  const resetMint = useCallback((mintUrl) => {
    setProofsByMint(prev => {
      const newState = { ...prev };
      delete newState[mintUrl];
      return newState;
    });
  }, []);

  return {
    activeMint,
    switchMint,
    currentProofs,
    balance,
    hydrated,
    getProofsByAmount,
    getProofsByAmountFromMint,
    addProofs,
    removeProofs,
    proofsByMint,
    addProofsToMint,
    removeProofsFromMint,
    resetMint,
    securityLevel,
    setSecurityLevel,
    setCurrentPassword,
    clearCurrentPassword,
    unlockWallet,
    upgradeToLevel2,
  };
}

works ifi

// src/hooks/useProofStorage.js
import { useState, useEffect, useMemo, useCallback, useLayoutEffect, useRef } from "react";
import { replacer, reviver } from "@/lib/cashu";
import * as bip39 from "bip39";

export default function useProofStorage() {
  const [securityLevel, setSecurityLevel] = useState(() => {
    if (typeof window === "undefined") return 1;
    return parseInt(localStorage.getItem("securityLevel") || "1", 10);
  });

  const [activeMint, setActiveMint] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("activeMint") || "";
  });

  const [proofsByMint, setProofsByMint] = useState({});
  const [mnemonic, setMnemonic] = useState("");
  const [lastUsedIndex, setLastUsedIndex] = useState(0);
  const hydrated = typeof window !== "undefined";
  const hasLoaded = useRef(false);

  // ── SILENT SEED ──
  useEffect(() => {
    if (!hydrated || mnemonic) return;
    const savedMnemonic = localStorage.getItem("mnemonic");
    const savedIndex = parseInt(localStorage.getItem("lastUsedIndex") || "0", 10);

    if (savedMnemonic) {
      setMnemonic(savedMnemonic);
      setLastUsedIndex(savedIndex);
    } else {
      const newMnemonic = bip39.generateMnemonic(128);
      setMnemonic(newMnemonic);
      localStorage.setItem("mnemonic", newMnemonic);
      console.log("🌱 Silent Seed mnemonic generated");
    }
  }, [hydrated, mnemonic]);

  // ── LOAD PROOFS ──
  useLayoutEffect(() => {
    if (!hydrated || hasLoaded.current) return;
    hasLoaded.current = true;
    const stored = localStorage.getItem("proofsByMint");
    if (stored) {
      try {
        const parsed = JSON.parse(stored, reviver);
        setProofsByMint(parsed || {});
        console.log("✅ Level 1 wallet loaded (plain text)");
      } catch (err) {
        console.error("Failed to load proofs:", err);
      }
    }
  }, [hydrated]);

  // ── SAVE ──
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint, replacer));
    localStorage.setItem("securityLevel", securityLevel.toString());
    localStorage.setItem("mnemonic", mnemonic);
    localStorage.setItem("lastUsedIndex", lastUsedIndex.toString());
    localStorage.setItem("activeMint", activeMint);
  }, [proofsByMint, securityLevel, mnemonic, lastUsedIndex, activeMint, hydrated]);

  const cleanProofLocal = (p) => {
    if (!p || typeof p !== "object" || !p.secret || typeof p.secret !== "string" || p.secret.length < 64) {
      return null;
    }
    return { ...p, id: p.id || null, amount: Number(p.amount) || 0 };
  };

  const processStoredProofs = (parsed) => {
    const cleaned = {};
    Object.entries(parsed || {}).forEach(([mintUrl, proofs]) => {
      if (Array.isArray(proofs)) {
        cleaned[mintUrl] = proofs.map(cleanProofLocal).filter(Boolean);
      }
    });
    return cleaned;
  };

  // ── DERIVE SECRET + SCAN (Silent Seed) ──
  const deriveSecret = useCallback(async (index) => {
    const encoder = new TextEncoder();
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const data = encoder.encode(seed.toString('hex') + index.toString());
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, [mnemonic]);

  const scanForProofs = useCallback(async (mintUrl, maxIndex = 200) => {
    if (!mintUrl || !mnemonic) {
      alert("No mint or seed available");
      return;
    }
    console.log(`🔍 Scanning mint ${mintUrl} (0-${maxIndex})...`);
    console.log("Scan placeholder active — real Cashu proof checking coming next");
  }, [mnemonic]);

  const restoreFromSeed = useCallback((words) => {
    const trimmed = words.trim().toLowerCase();
    if (!bip39.validateMnemonic(trimmed)) {
      alert("❌ Invalid seed phrase");
      return false;
    }
    setMnemonic(trimmed);
    setSecurityLevel(2);
    localStorage.setItem("mnemonic", trimmed);
    console.log("✅ Wallet successfully restored from seed");
    if (activeMint) scanForProofs(activeMint);
    return true;
  }, [activeMint, scanForProofs]);

  const resetWallet = useCallback(() => {
    if (confirm("ARE YOU SURE? This will PERMANENTLY delete everything.")) {
      localStorage.clear();
      window.location.reload();
    }
  }, []);

  // ── CORE COMPUTED VALUES (moved UP so they are available to functions below) ──
  const currentProofs = useMemo(() => proofsByMint[activeMint] || [], [proofsByMint, activeMint]);
  const balance = useMemo(() => currentProofs.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0), [currentProofs]);

  // ── FUNCTIONS THAT DEPEND ON currentProofs ──
  const getProofsByAmount = useCallback((targetAmount) => {
    if (!targetAmount || targetAmount <= 0) return [];
    const sorted = [...currentProofs].sort((a, b) => b.amount - a.amount);
    let sum = 0;
    const selected = [];
    for (const proof of sorted) {
      if (sum >= targetAmount) break;
      if (sum + proof.amount <= targetAmount * 3 || selected.length === 0) {
        selected.push(proof);
        sum += proof.amount;
      }
    }
    return selected;
  }, [currentProofs]);

  const getProofsByAmountFromMint = useCallback((mintUrl, targetAmount) => {
    const mintProofs = proofsByMint[mintUrl] || [];
    if (!mintProofs.length) return { selected: [], remaining: targetAmount };
    const sorted = [...mintProofs].sort((a, b) => b.amount - a.amount);
    let remaining = targetAmount;
    const selected = [];
    for (const proof of sorted) {
      if (remaining <= 0) break;
      if (proof.amount <= remaining) {
        selected.push(proof);
        remaining -= proof.amount;
      }
    }
    return { selected, remaining };
  }, [proofsByMint]);

  const addProofsToMint = useCallback((mintUrl, newProofs, keysetId = null) => {
    if (!mintUrl || !Array.isArray(newProofs) || newProofs.length === 0) return;
    setProofsByMint(prev => {
      const existing = prev[mintUrl] || [];
      const existingSecrets = new Set(existing.map(p => p.secret));
      const uniqueNew = newProofs
        .map(p => {
          const cleaned = cleanProofLocal(p);
          if (!cleaned) return null;
          if (!cleaned.id && keysetId) cleaned.id = keysetId;
          return cleaned;
        })
        .filter(Boolean)
        .filter(p => !existingSecrets.has(p.secret));

      if (uniqueNew.length === 0) return prev;

      const newList = [...existing, ...uniqueNew];
      console.log(`[HOOK ADD] Added ${uniqueNew.length} proofs to ${mintUrl} → total: ${newList.length}`);
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const removeProofsFromMint = useCallback((mintUrl, proofsToRemove) => {
    if (!mintUrl || !proofsToRemove?.length) return;
    const secretsToRemove = new Set(proofsToRemove.map(p => p.secret).filter(Boolean));
    setProofsByMint(prev => {
      const mintProofs = prev[mintUrl] || [];
      const newList = mintProofs.filter(p => !secretsToRemove.has(p.secret));
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const addProofs = useCallback((newProofs, keysetId = null) => {
    if (!activeMint) return;
    addProofsToMint(activeMint, newProofs, keysetId);
  }, [activeMint, addProofsToMint]);

  const removeProofs = useCallback((proofsToRemove) => {
    removeProofsFromMint(activeMint, proofsToRemove);
  }, [activeMint, removeProofsFromMint]);

  const switchMint = useCallback((newUrl) => {
    if (newUrl && typeof newUrl === "string") setActiveMint(newUrl.trim());
  }, []);

  const resetMint = useCallback((mintUrl) => {
    setProofsByMint(prev => {
      const newState = { ...prev };
      delete newState[mintUrl];
      return newState;
    });
  }, []);

  return {
    activeMint,
    switchMint,
    currentProofs,
    balance,
    hydrated,
    proofsByMint,
    addProofs,
    removeProofs,
    addProofsToMint,
    removeProofsFromMint,
    resetMint,
    securityLevel,
    setSecurityLevel,
    resetWallet,
    mnemonic,
    restoreFromSeed,
    scanForProofs,
    getProofsByAmount,
    getProofsByAmountFromMint,
  };
}*/

// src/hooks/useProofStorage.js
// MIT License
// Copyright (c) 2026 Jose2097

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { replacer, reviver } from "@/lib/cashu";
import * as bip39 from "bip39";

export default function useProofStorage() {
  const [mnemonic, setMnemonic] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("mnemonic") || "";
  });

  const [securityLevel, setSecurityLevel] = useState(() => {
    if (typeof window === "undefined") return 1;
    return parseInt(localStorage.getItem("securityLevel") || "1", 10);
  });

  const [activeMint, setActiveMint] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("activeMint") || "";
  });

  const [proofsByMint, setProofsByMint] = useState({});
  const hasInitialized = useRef(false);   // ← Important guard

  // Generate seed ONLY once
  useEffect(() => {
    if (hasInitialized.current || mnemonic) return;

    hasInitialized.current = true;
    const newMnemonic = bip39.generateMnemonic(128);
    setMnemonic(newMnemonic);
    localStorage.setItem("mnemonic", newMnemonic);
    console.log(" New Silent Seed mnemonic generated");
  }, [mnemonic]);

  // Load proofs from localStorage
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const stored = localStorage.getItem("proofsByMint");
    if (stored) {
      try {
        const parsed = JSON.parse(stored, reviver);
        setProofsByMint(parsed || {});
        console.log(" Level 1 wallet loaded (plain text)");
      } catch (err) {
        console.error("Failed to load proofs:", err);
      }
    }
  }, []);

  // SAVE - with strong guard to prevent deleting proofs
  useEffect(() => {
    if (!hasInitialized.current || typeof window === "undefined") return;

    // Prevent ghost save (empty object overwriting real data)
    if (Object.keys(proofsByMint).length === 0 && hasInitialized.current) {
      console.log(" Save skipped - proofs still loading");
      return;
    }

    localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint, replacer));
    localStorage.setItem("securityLevel", securityLevel.toString());
    localStorage.setItem("mnemonic", mnemonic);
    localStorage.setItem("activeMint", activeMint);

    console.log(" Wallet saved successfully");
  }, [proofsByMint, securityLevel, mnemonic, activeMint]);

  const cleanProofLocal = (p) => {
    if (!p || typeof p !== "object" || !p.secret || typeof p.secret !== "string" || p.secret.length < 64) {
      return null;
    }
    return { ...p, id: p.id || null, amount: Number(p.amount) || 0 };
  };

  const restoreFromSeed = useCallback((words) => {
    const trimmed = words.trim().toLowerCase();
    if (!bip39.validateMnemonic(trimmed)) {
      alert("❌ Invalid seed phrase. Please check the 12 words.");
      return false;
    }
    setMnemonic(trimmed);
    setSecurityLevel(2);
    localStorage.setItem("mnemonic", trimmed);
    console.log(" Seed restored successfully");
    return true;
  }, []);

  const resetWallet = useCallback(() => {
    if (confirm("ARE YOU SURE? This will PERMANENTLY delete everything.")) {
      localStorage.clear();
      window.location.reload();
    }
  }, []);

  const currentProofs = useMemo(() => proofsByMint[activeMint] || [], [proofsByMint, activeMint]);
  const balance = useMemo(() => currentProofs.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0), [currentProofs]);

  const getProofsByAmount = useCallback((targetAmount) => {
    if (!targetAmount || targetAmount <= 0) return [];
    const sorted = [...currentProofs].sort((a, b) => b.amount - a.amount);
    let sum = 0;
    const selected = [];
    for (const proof of sorted) {
      if (sum >= targetAmount) break;
      if (sum + proof.amount <= targetAmount * 3 || selected.length === 0) {
        selected.push(proof);
        sum += proof.amount;
      }
    }
    return selected;
  }, [currentProofs]);

  const getProofsByAmountFromMint = useCallback((mintUrl, targetAmount) => {
    const mintProofs = proofsByMint[mintUrl] || [];
    if (!mintProofs.length) return { selected: [], remaining: targetAmount };
    const sorted = [...mintProofs].sort((a, b) => b.amount - a.amount);
    let remaining = targetAmount;
    const selected = [];
    for (const proof of sorted) {
      if (remaining <= 0) break;
      if (proof.amount <= remaining) {
        selected.push(proof);
        remaining -= proof.amount;
      }
    }
    return { selected, remaining };
  }, [proofsByMint]);

  const addProofsToMint = useCallback((mintUrl, newProofs, keysetId = null) => {
    if (!mintUrl || !Array.isArray(newProofs) || newProofs.length === 0) return;
    setProofsByMint(prev => {
      const existing = prev[mintUrl] || [];
      const existingSecrets = new Set(existing.map(p => p.secret));
      const uniqueNew = newProofs
        .map(p => {
          const cleaned = cleanProofLocal(p);
          if (!cleaned) return null;
          if (!cleaned.id && keysetId) cleaned.id = keysetId;
          return cleaned;
        })
        .filter(Boolean)
        .filter(p => !existingSecrets.has(p.secret));

      if (uniqueNew.length === 0) return prev;

      const newList = [...existing, ...uniqueNew];
      console.log(`[HOOK ADD] Added ${uniqueNew.length} proofs to ${mintUrl} → total: ${newList.length}`);
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const removeProofsFromMint = useCallback((mintUrl, proofsToRemove) => {
    if (!mintUrl || !proofsToRemove?.length) return;
    const secretsToRemove = new Set(proofsToRemove.map(p => p.secret).filter(Boolean));
    setProofsByMint(prev => {
      const mintProofs = prev[mintUrl] || [];
      const newList = mintProofs.filter(p => !secretsToRemove.has(p.secret));
      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  const addProofs = useCallback((newProofs, keysetId = null) => {
    if (!activeMint) return;
    addProofsToMint(activeMint, newProofs, keysetId);
  }, [activeMint, addProofsToMint]);

  const removeProofs = useCallback((proofsToRemove) => {
    removeProofsFromMint(activeMint, proofsToRemove);
  }, [activeMint, removeProofsFromMint]);

  const switchMint = useCallback((newUrl) => {
    if (newUrl && typeof newUrl === "string") setActiveMint(newUrl.trim());
  }, []);

  const resetMint = useCallback((mintUrl) => {
    setProofsByMint(prev => {
      const newState = { ...prev };
      delete newState[mintUrl];
      return newState;
    });
  }, []);

  return {
    activeMint,
    switchMint,
    currentProofs,
    balance,
    hydrated: typeof window !== "undefined",
    proofsByMint,
    addProofs,
    removeProofs,
    addProofsToMint,
    removeProofsFromMint,
    resetMint,
    securityLevel,
    setSecurityLevel,
    resetWallet,
    mnemonic,
    restoreFromSeed,
    getProofsByAmount,
    getProofsByAmountFromMint,
  };
}