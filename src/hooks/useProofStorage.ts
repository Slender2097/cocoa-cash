// src/hooks/useProofStorage.ts
// MIT License
// Copyright (c) 2026 Jose2097
//
// React view of the browser proof store (src/lib/cashu/storage.ts).
// This hook never writes its in-memory copy back to disk: every change goes
// through read-modify-write helpers, and the state re-reads storage on every
// change (this tab or another). That removes the old "stale instance
// overwrites newer proofs" failure mode by construction.

import { useCallback, useEffect, useMemo, useState } from "react";
import * as bip39 from "bip39";
import { readProofs, onProofsChange, walletMintKey, sumProofs, requestPersistentStorage } from "@/lib/cashu/storage";
import type { ProofsByMint, StoredProof } from "@/lib/cashu/storage";

const ls = {
  get: (k: string) => (typeof window === "undefined" ? null : localStorage.getItem(k)),
  set: (k: string, v: string) => localStorage.setItem(k, v),
};

export type ProofStorage = ReturnType<typeof useProofStorage>;

export default function useProofStorage() {
  const [hydrated, setHydrated] = useState(false);
  const [proofsByMint, setProofsByMint] = useState<ProofsByMint>({});
  const [mnemonic, setMnemonic] = useState("");
  const [securityLevel, setSecurityLevelState] = useState(1);
  const [activeMint, setActiveMint] = useState("");

  // Load from disk once on the client, then follow every change.
  useEffect(() => {
    let seed = ls.get("mnemonic");
    if (!seed) {
      // Local phrase (kept for the existing Security panel). It does not
      // restore proofs; see the note in that panel.
      seed = bip39.generateMnemonic(128);
      ls.set("mnemonic", seed);
    }
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    setMnemonic(seed);
    setSecurityLevelState(parseInt(ls.get("securityLevel") || "1", 10));
    setActiveMint(ls.get("activeMint") || "");
    setProofsByMint(readProofs());
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    requestPersistentStorage();
    return onProofsChange(() => setProofsByMint(readProofs()));
  }, []);

  const setSecurityLevel = useCallback((level: number) => {
    setSecurityLevelState(level);
    ls.set("securityLevel", String(level));
  }, []);

  const restoreFromSeed = useCallback(async (words: string) => {
    const trimmed = words.trim().toLowerCase();
    if (!bip39.validateMnemonic(trimmed)) {
      alert("❌ Invalid seed phrase. Please check the 12 words.");
      return false;
    }
    setMnemonic(trimmed);
    ls.set("mnemonic", trimmed);
    setSecurityLevel(2);
    return true;
  }, [setSecurityLevel]);

  const switchMint = useCallback((newUrl: string) => {
    if (!newUrl || typeof newUrl !== "string") return;
    const key = walletMintKey(newUrl);
    setActiveMint(key);
    ls.set("activeMint", key);
  }, []);

  const currentProofs: StoredProof[] = useMemo(
    () => (activeMint ? proofsByMint[walletMintKey(activeMint)] || [] : []),
    [proofsByMint, activeMint]
  );
  const balance = useMemo(() => sumProofs(currentProofs), [currentProofs]);

  return {
    hydrated,
    activeMint,
    switchMint,
    currentProofs,
    balance,
    proofsByMint,
    securityLevel,
    setSecurityLevel,
    mnemonic,
    restoreFromSeed,
  };
}
