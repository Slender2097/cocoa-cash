import { useState, useEffect, useMemo, useCallback } from "react";

export default function useProofStorage() {
  const [activeMint, setActiveMint] = useState("");
  const [proofsByMint, setProofsByMint] = useState({}); // { [mintUrl: string]: Proof[] }
  const [hydrated, setHydrated] = useState(false);

  // Utility to validate & clean a proof
  const cleanProof = (p) => {
    if (!p || typeof p !== "object" || !p.secret || typeof p.secret !== "string" || p.secret.length < 64) {
      return null; // invalid
    }
    return {
      ...p,
      id: p.id || "missing-id-recovered", // fallback if missing
      amount: Number(p.amount) || 0,
    };
  };

  // Load from localStorage & clean
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedActive = localStorage.getItem("activeMint") || "";
      setActiveMint(storedActive);

      const stored = localStorage.getItem("proofsByMint");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === "object" && parsed !== null) {
          const cleaned = {};
          Object.entries(parsed).forEach(([mintUrl, proofs]) => {
            if (Array.isArray(proofs)) {
              const validProofs = proofs.map(cleanProof).filter(Boolean); // clean & remove invalid
              if (validProofs.length < proofs.length) {
                console.warn(`[HOOK LOAD] Cleaned ${proofs.length - validProofs.length} invalid proofs from ${mintUrl}`);
              }
              cleaned[mintUrl] = validProofs;
            }
          });
          setProofsByMint(cleaned);
        }
      }
    } catch (err) {
      console.error("Failed to load proof storage:", err);
      // Reset corrupted storage (optional – uncomment if needed)
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

  const addProofsToMint = useCallback((mintUrl, newProofs) => {
    if (!mintUrl || !Array.isArray(newProofs) || newProofs.length === 0) return;

    setProofsByMint(prev => {
      const existing = prev[mintUrl] || [];
      const existingSecrets = new Set(existing.map(p => p.secret));
      const uniqueNew = newProofs
        .map(cleanProof)  // clean incoming
        .filter(Boolean)  // remove invalid
        .filter(p => !existingSecrets.has(p.secret));  // unique

      if (uniqueNew.length === 0) return prev;

      const newList = [...existing, ...uniqueNew];

      console.log("[HOOK ADD] Added to", mintUrl, ":", uniqueNew.length, "new → total:", newList.length);
      console.log("[HOOK ADD] Proof IDs after add:", newList.map(p => p.id));

      return { ...prev, [mintUrl]: newList };
    });
  }, []);

  // ── Remove proofs from specific mint ───────────────────────────────
  const removeProofsFromMint = useCallback((mintUrl, proofsToRemove) => {
    if (!mintUrl || !proofsToRemove?.length) return;

    const secretsToRemove = new Set(proofsToRemove.map((p) => p.secret).filter(Boolean));

    setProofsByMint((prev) => {
      const mintProofs = (prev[mintUrl] || []).filter(p => p && typeof p === 'object' && p.secret);  // defensive clean
      const newList = mintProofs.filter((p) => !secretsToRemove.has(p.secret));

      if (newList.length === mintProofs.length) {
        console.warn("[HOOK REMOVE] No proofs matched for removal in", mintUrl);
      } else {
        console.log("[HOOK REMOVE] Removed", mintProofs.length - newList.length, "proofs from", mintUrl);
      }

      return { ...prev, [mintUrl]: newList };
    });
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

  // Optional: reset a mint's proofs if corrupted
  const resetMint = useCallback((mintUrl) => {
    setProofsByMint(prev => {
      const newState = { ...prev };
      delete newState[mintUrl];
      return newState;
    });
    console.log("[HOOK] Reset proofs for", mintUrl);
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
    resetMint,  // new: call this if crashes persist, e.g., resetMint(activeMint)
  };
}