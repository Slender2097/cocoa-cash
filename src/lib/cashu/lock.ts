// src/lib/cashu/lock.ts
// One cross-tab lock for every operation that changes proofs, the journal or
// the tip stores. localStorage is not transactional across tabs: two tabs that
// read-modify-write the same key at the same moment can each read the old
// value, and one write is lost. Running each operation under one Web Lock
// (navigator.locks, shared by all tabs of this origin) makes them take turns.
//
// The lock is not reentrant. Code that already holds it calls the unlocked
// variants (the *Unlocked functions), never a locked wrapper, which would wait
// for itself. Where Web Locks are missing or unusable (old browsers, opaque
// origins), operations run unlocked, exactly as before.
// MIT License

export const WALLET_LOCK = "cocoa-wallet";

const lockManager = (): LockManager | undefined =>
  typeof navigator !== "undefined" && navigator.locks ? navigator.locks : undefined;

/** Run `fn` while holding the wallet lock, waiting for other tabs first. */
export async function withWalletLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = lockManager();
  if (!locks) return fn();
  let ran = false;
  try {
    return await locks.request(WALLET_LOCK, () => {
      ran = true;
      return fn();
    });
  } catch (e) {
    if (ran) throw e;
    return fn(); // the lock manager refused (e.g. opaque origin): run unlocked, as before
  }
}

/**
 * Background work (the recovery ticker): run `fn` only if no tab holds the
 * wallet lock right now. Otherwise skip this round and return undefined.
 */
export async function ifWalletLockFree<T>(fn: () => Promise<T>): Promise<T | undefined> {
  const locks = lockManager();
  if (!locks) return fn();
  let ran = false;
  try {
    return await locks.request(WALLET_LOCK, { ifAvailable: true }, (lock) => {
      if (!lock) return undefined;
      ran = true;
      return fn();
    });
  } catch (e) {
    if (ran) throw e;
    return fn();
  }
}
