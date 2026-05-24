// src/hooks/useProofStorage.js
// MIT License
// Copyright (c) 2026 Jose2097

/*import { useState, useEffect, useMemo, useCallback } from "react";
import { replacer, reviver } from "@/lib/cashu";
import * as bip39 from "bip39";

export default function useProofStorage() {
  const [mnemonic, setMnemonic] = useState(() => {
    if (typeof window === "undefined") return "";

    const saved = localStorage.getItem("mnemonic");
    if (saved) return saved;

    // Generate new silent seed ONLY the first time
    const newMnemonic = bip39.generateMnemonic(128);
    localStorage.setItem("mnemonic", newMnemonic);
    console.log(" New Silent Seed mnemonic generated");
    return newMnemonic;
  });

  const [securityLevel, setSecurityLevel] = useState(() => {
    if (typeof window === "undefined") return 1;
    return parseInt(localStorage.getItem("securityLevel") || "1", 10);
  });

  const [activeMint, setActiveMint] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("activeMint") || "";
  });

  const [proofsByMint, setProofsByMint] = useState(() => {
    if (typeof window === "undefined") return {};

    const stored = localStorage.getItem("proofsByMint");
    if (stored) {
      try {
        const parsed = JSON.parse(stored, reviver);
        console.log(" Level 1 wallet loaded (plain text)");
        return parsed || {};
      } catch (err) {
        console.error("Failed to load proofs:", err);
        return {};
      }
    }
    return {};
  });

  // SAVE to localStorage whenever state changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip saving completely empty state on first render (prevents accidental wipe)
    if (Object.keys(proofsByMint).length === 0) {
      console.log(" Save skipped - no proofs yet");
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
}*/

//This one works fine

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

// src/hooks/useProofStorage.js
// MIT License
// Copyright (c) 2026 Jose2097
// FINAL PRODUCTION VERSION – Hardened NUT-13 Cross-Device Restore

/*import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { replacer, reviver } from "@/lib/cashu";
import * as bip39 from "bip39";
import { Wallet, Mint } from "@cashu/cashu-ts";

export default function useProofStorage() {
  const hasLoaded = useRef(false);
  const isRestoring = useRef(false);

  // Safe lazy initialization
  const [mnemonic, setMnemonic] = useState(() => {
    if (typeof window === "undefined") return "";
    const stored = localStorage.getItem("mnemonic");
    if (stored) return stored;

    const newMnemonic = bip39.generateMnemonic(128);
    try {
      localStorage.setItem("mnemonic", newMnemonic);
      console.log("🌱 New Silent Seed mnemonic generated");
    } catch (e) {
      console.error("Failed to persist initial mnemonic:", e);
    }
    return newMnemonic;
  });

  const [securityLevel, setSecurityLevel] = useState(() => {
    if (typeof window === "undefined") return 1;
    return parseInt(localStorage.getItem("securityLevel") || "1", 10);
  });

  const [activeMint, setActiveMint] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("activeMint") || "";
  });

  const [proofsByMint, setProofsByMint] = useState(() => {
    if (typeof window === "undefined") return {};
    const stored = localStorage.getItem("proofsByMint");
    if (stored) {
      try {
        const parsed = JSON.parse(stored, reviver);
        console.log("✅ Level 1 wallet loaded");
        return parsed || {};
      } catch (err) {
        console.error("Failed to load proofs:", err);
        return {};
      }
    }
    return {};
  });

  // Save engine – protected during restore
  useEffect(() => {
    if (typeof window === "undefined" || isRestoring.current) return;

    if (!hasLoaded.current) {
      hasLoaded.current = true;
      console.log(" Wallet sync engine armed");
      return;
    }

    try {
      localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint, replacer));
      localStorage.setItem("securityLevel", securityLevel.toString());
      localStorage.setItem("mnemonic", mnemonic);
      localStorage.setItem("activeMint", activeMint);
      console.log(" Wallet saved successfully");
    } catch (err) {
      console.error("Failed to save wallet:", err);
    }
  }, [proofsByMint, securityLevel, mnemonic, activeMint]);

  const cleanProofLocal = useCallback((p) => {
    if (!p || typeof p !== "object" || !p.secret || typeof p.secret !== "string" || p.secret.length < 64) {
      return null;
    }
    return { ...p, id: p.id || null, amount: Number(p.amount) || 0 };
  }, []);

  // HARDENED NUT-13 RESTORE (both seed formats + finally guard)
  const restoreFromSeed = useCallback(async (words, scanMintUrls = []) => {
    const trimmed = words.trim().toLowerCase();
    if (!bip39.validateMnemonic(trimmed)) {
      alert("❌ Invalid seed phrase. Please check the 12 words.");
      return false;
    }

    isRestoring.current = true;
    setMnemonic(trimmed);
    setSecurityLevel(2);

    if (scanMintUrls.length === 0 && activeMint) scanMintUrls = [activeMint];

    if (scanMintUrls.length === 0) {
      alert("⚠️ No mints to scan. Please connect a mint first.");
      isRestoring.current = false;
      return false;
    }

    console.log(`🔑 Starting NUT-13 restore on ${scanMintUrls.length} mint(s)...`);

    const seedBuffer = await bip39.mnemonicToSeed(trimmed);
    let updatedProofsState = { ...proofsByMint };
    let totalRecovered = 0;

    try {
      for (const mintUrl of scanMintUrls) {
        try {
          console.log(`Scanning ${mintUrl}...`);
          const mint = new Mint(mintUrl);

          // Pass BOTH formats to support all versions of @cashu/cashu-ts
          const tempWallet = new Wallet(mint, {
            unit: "sat",
            seed: seedBuffer,
            bip39seed: seedBuffer,
          });

          await tempWallet.loadMint();
          const restoredProofs = await tempWallet.restore();

          if (restoredProofs?.length > 0) {
            const existing = updatedProofsState[mintUrl] || [];
            const existingSecrets = new Set(existing.map(p => p.secret));

            const uniqueNew = restoredProofs
              .map(p => cleanProofLocal(p))
              .filter(Boolean)
              .filter(p => !existingSecrets.has(p.secret));

            if (uniqueNew.length > 0) {
              updatedProofsState[mintUrl] = [...existing, ...uniqueNew];
              totalRecovered += uniqueNew.length;
              console.log(`🎉 Recovered ${uniqueNew.length} proofs from ${mintUrl}`);
            }
          }
        } catch (err) {
          console.error(`Restore failed for ${mintUrl}:`, err);
        }
      }

      // Atomic commit
      if (totalRecovered > 0) {
        setProofsByMint(updatedProofsState);
      }

      // Force immediate disk write
      try {
        localStorage.setItem("proofsByMint", JSON.stringify(updatedProofsState, replacer));
        localStorage.setItem("securityLevel", "2");
        localStorage.setItem("mnemonic", trimmed);
        if (activeMint) localStorage.setItem("activeMint", activeMint);
        console.log("💾 Atomic post-restore backup completed");
      } catch (saveErr) {
        console.error("Failed atomic backup:", saveErr);
      }
    } catch (criticalErr) {
      console.error("Critical error in recovery:", criticalErr);
    } finally {
      isRestoring.current = false;
    }

    if (totalRecovered > 0) {
      alert(`✅ Successfully restored ${totalRecovered} tokens!`);
    } else {
      alert("✅ Seed restored.\n\nNo new tokens found on the scanned mints.");
    }

    return true;
  }, [activeMint, proofsByMint, cleanProofLocal]);

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
        .map(p => cleanProofLocal(p))
        .filter(Boolean)
        .filter(p => !existingSecrets.has(p.secret));

      if (uniqueNew.length === 0) return prev;

      const newList = [...existing, ...uniqueNew];
      console.log(`[HOOK ADD] Added ${uniqueNew.length} proofs to ${mintUrl} → total: ${newList.length}`);
      return { ...prev, [mintUrl]: newList };
    });
  }, [cleanProofLocal]);

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
    if (!activeMint) return;
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
}*/