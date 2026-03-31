/*import { useState, useEffect, useMemo, useCallback } from "react";

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
}*/

// src/hooks/useProofStorage.js
import { useState, useEffect, useMemo, useCallback } from "react";
import { replacer, reviver, cleanProof } from "@/lib/cashu";

export default function useProofStorage() {
  const [activeMint, setActiveMint] = useState("");
  const [proofsByMint, setProofsByMint] = useState({});
  const [hydrated, setHydrated] = useState(false);

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

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("activeMint", activeMint);
  }, [activeMint]);

  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint, replacer));
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

  const addProofsToMint = useCallback((mintUrl, newProofs, keysetId = null) => {
    if (!mintUrl || !Array.isArray(newProofs) || newProofs.length === 0) return;
    setProofsByMint((prev) => {
      const existing = prev[mintUrl] || [];
      const existingSecrets = new Set(existing.map((p) => p.secret));
      const uniqueNew = newProofs
        .map((p) => {
          const cleaned = cleanProof(p);
          if (!cleaned) return null;
          if (!cleaned.id && keysetId) cleaned.id = keysetId;
          return cleaned;
        })
        .filter(Boolean)
        .filter((p) => !existingSecrets.has(p.secret));

      if (uniqueNew.length === 0) return prev;
      return { ...prev, [mintUrl]: [...existing, ...uniqueNew] };
    });
  }, []);

  const removeProofsFromMint = useCallback((mintUrl, proofsToRemove) => {
    if (!mintUrl || !proofsToRemove?.length) return;
    const secretsToRemove = new Set(proofsToRemove.map((p) => p.secret).filter(Boolean));
    setProofsByMint((prev) => {
      const mintProofs = prev[mintUrl] || [];
      const newList = mintProofs.filter((p) => !secretsToRemove.has(p.secret));
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

  return {
    activeMint,
    switchMint,
    currentProofs,
    balance,
    hydrated,
    getProofsByAmount,
    addProofs,
    removeProofs,
    proofsByMint,
    addProofsToMint,
    removeProofsFromMint,
  };
}