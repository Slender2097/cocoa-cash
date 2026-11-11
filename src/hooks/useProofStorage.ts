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
import { readProofs, onProofsChange, walletMintKey, sumProofs, requestPersistentStorage } from "@/lib/cashu/storage";
import type { ProofsByMint, StoredProof } from "@/lib/cashu/storage";
import { getMnemonic } from "@/lib/cashu/seed";
import { restoreFromPhrase } from "@/lib/cashu/restore";

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
    // The NUT-13 phrase (src/lib/cashu/seed.ts): created on first use, and
    // every Wallet derives its new secrets from it.
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    setMnemonic(getMnemonic());
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

  const switchMint = useCallback((newUrl: string) => {
    if (!newUrl || typeof newUrl !== "string") return;
    const key = walletMintKey(newUrl);
    setActiveMint(key);
    ls.set("activeMint", key);
  }, []);

  /**
   * Restore from phrase (NUT-13 + NUT-09 + NUT-07): adds the phrase's unspent
   * proofs from `mints` to storage, and makes it the wallet's phrase. The
   * caller confirms first when that would replace a phrase that holds sats
   * (phraseChangeAtRisk in src/lib/cashu/restore.ts).
   */
  const restoreFromSeed = useCallback(
    async (words: string, mints: string[], progress: (text: string) => void) => {
      const results = await restoreFromPhrase(words, mints, progress);
      setMnemonic(getMnemonic());
      setSecurityLevel(2); // the user just typed the phrase from their copy
      // On a fresh browser no mint is active yet: open the one that got sats back.
      const first = results.find((r) => r.amount > 0);
      if (!activeMint && first) switchMint(first.mint);
      return results;
    },
    [setSecurityLevel, activeMint, switchMint]
  );

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
