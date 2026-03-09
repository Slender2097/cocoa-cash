// src/hooks/useProofStorage.js
import { useState, useEffect, useMemo, useCallback } from "react";

export default function useProofStorage() {
  const [activeMint, setActiveMint] = useState("");
  const [proofsByMint, setProofsByMint] = useState({}); // { [mintUrl: string]: Proof[] }
  const [hydrated, setHydrated] = useState(false);

  /*const [forceUpdate, setForceUpdate] = useState(0);*/

  // Load from localStorage (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedActive = localStorage.getItem("activeMint") || "";
      setActiveMint(storedActive);

      const stored = localStorage.getItem("proofsByMint");
      if (stored) {
        const parsed = JSON.parse(stored);
        // Basic validation
        if (typeof parsed === "object" && parsed !== null) {
          Object.values(parsed).forEach(proofs => {
            if (!Array.isArray(proofs)) {
              throw new Error("Invalid proofs format in storage");
            }
          });
          setProofsByMint(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load proof storage:", err);
      // Optional: reset corrupted storage
      // localStorage.removeItem("proofsByMint");
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist active mint
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("activeMint", activeMint);
  }, [activeMint]);

  // Persist all proofs
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint));
  }, [proofsByMint]);

  // Trigger when proofs change
    /*useEffect(() => {
      setForceUpdate(t => t + 1);
    }, [proofsByMint]);*/


  // ── Current mint data ──────────────────────────────────────────────
  const currentProofs = useMemo(
    () => proofsByMint[activeMint] || [],
    [proofsByMint, activeMint]
  );

  const balance = useMemo(
    () => currentProofs.reduce((sum, p) => sum + (Number(p?.amount) || 0), 0),
    [currentProofs]
  );

  const getProofsByAmount = useCallback((targetAmount) => {
  if (!targetAmount || targetAmount <= 0) return [];

  const candidates = currentProofs;

  const sorted = [...candidates].sort((a, b) => b.amount - a.amount);

  let sum = 0;
  const selected = [];

  for (const proof of sorted) {
    if (sum >= targetAmount) break;

    // Allow larger overshoot if needed — especially for single large proof
    if (sum + proof.amount <= targetAmount * 3 || selected.length === 0) {
      selected.push(proof);
      sum += proof.amount;
    }
  }

  console.log(
    "[HOOK] getProofsByAmount selected:",
    selected.length,
    "proofs for",
    targetAmount,
    "sat → amounts:",
    selected.map(p => p.amount),
    "→ total:",
    sum
  );

  return selected;
}, [currentProofs]);

  // ── Get proofs from ANY mint ───────────────────────────────────────
  const getProofsByAmountFromMint = useCallback(
    (mintUrl, targetAmount) => {
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
    },
    [proofsByMint]
  );

  // ── Add proofs to specific mint ────────────────────────────────────
const addProofsToMint = useCallback((mintUrl, newProofs) => {
  if (!mintUrl || !Array.isArray(newProofs) || newProofs.length === 0) return;

  setProofsByMint(prev => {
    const existing = prev[mintUrl] || [];
    const existingSecrets = new Set(existing.map(p => p.secret));
    const uniqueNew = newProofs.filter(p => p?.secret && !existingSecrets.has(p.secret));

    if (uniqueNew.length === 0) return prev;

    const newList = [...existing, ...uniqueNew];

    console.log("[HOOK ADD] Added to", mintUrl, ":", uniqueNew.length, "new → total:", newList.length);

    // Force completely new object reference
    return { ...prev, [mintUrl]: newList };
  });
}, []);

  // ── Remove proofs from specific mint ───────────────────────────────
  const removeProofsFromMint = useCallback((mintUrl, proofsToRemove) => {
    if (!mintUrl || !proofsToRemove?.length) return;

    const secretsToRemove = new Set(proofsToRemove.map((p) => p.secret).filter(Boolean));

    setProofsByMint((prev) => ({
      ...prev,
      [mintUrl]: (prev[mintUrl] || []).filter((p) => !secretsToRemove.has(p.secret)),
    }));
  }, []);

  // ── Add to current active mint (backward compatible) ───────────────
 const addProofs = useCallback(
  (newProofs) => {
    if (!activeMint) {
      console.warn("[HOOK] addProofs called but activeMint is empty!");
      return;
    }
    addProofsToMint(activeMint, newProofs);
  },
  [activeMint, addProofsToMint]
);

  // ── Remove from current active mint (backward compatible) ──────────
  const removeProofs = useCallback(
    (proofsToRemove) => removeProofsFromMint(activeMint, proofsToRemove),
    [activeMint, removeProofsFromMint]
  );

  // ── Switch active mint ─────────────────────────────────────────────
  const switchMint = useCallback((newUrl) => {
    if (newUrl && typeof newUrl === "string") {
      setActiveMint(newUrl.trim());
    }
  }, []);

  return {
    // Core state & utils
    activeMint,
    switchMint,
    currentProofs,
    balance,
    hydrated,

    // Current mint operations 
    getProofsByAmount,
    addProofs,
    removeProofs,

    // Multi-mint operations 
    proofsByMint,
    getProofsByAmountFromMint,
    addProofsToMint,
    removeProofsFromMint,
  };
}