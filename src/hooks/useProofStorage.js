// src/hooks/useProofStorage.js
import { useState, useEffect, useMemo, useCallback } from "react";

export default function useProofStorage() {
  const [activeMint, setActiveMint] = useState("");
  const [proofsByMint, setProofsByMint] = useState({});
  const [hydrated, setHydrated] = useState(false);
  const [updateTrigger, setUpdateTrigger] = useState(0);

  // Load from localStorage once (client only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storedActive = localStorage.getItem("activeMint") || "";
      setActiveMint(storedActive);

      const stored = localStorage.getItem("proofsByMint");
      if (stored) {
        setProofsByMint(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load storage:", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("activeMint", activeMint);
  }, [activeMint]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("proofsByMint", JSON.stringify(proofsByMint));
  }, [proofsByMint]);

  // ── Memoize everything so references are stable ──
  const currentProofs = useMemo(() => 
    proofsByMint[activeMint] || [], 
    [proofsByMint, activeMint]
  );

  const balance = useMemo(() => 
    currentProofs.reduce((sum, p) => sum + p.amount, 0), 
    [currentProofs]
  );

  const getProofsByAmount = useCallback((amount, keysetId) => {
    return currentProofs.filter(
      (p) => p.amount <= amount && (!keysetId || p.id === keysetId)
    );
  }, [currentProofs]);

  const addProofs = useCallback((newProofs) => {
    setProofsByMint((prev) => ({
      ...prev,
      [activeMint]: [...(prev[activeMint] || []), ...newProofs],
    }));
    setUpdateTrigger(t => t + 1);
  }, [activeMint]);

  const removeProofs = useCallback((proofsToRemove) => {
    setProofsByMint((prev) => ({
      ...prev,
      [activeMint]: (prev[activeMint] || []).filter(
        (p) => !proofsToRemove.some((r) => r.secret === p.secret)
      ),
    }));
    setUpdateTrigger(t => t + 1);
  }, [activeMint]);

  const switchMint = useCallback((newUrl) => {
    setActiveMint(newUrl);
  }, []);

  return {
    addProofs,
    removeProofs,
    getProofsByAmount,
    balance,
    activeMint,
    switchMint,
    currentProofs,
    hydrated,
  };
}