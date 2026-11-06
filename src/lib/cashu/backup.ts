// src/lib/cashu/backup.ts
// "Back up balance": each mint's spendable proofs as one standard Cashu token
// (NUT-00, cashuB). Restoring is just Claim, in this wallet or any other.
//
// A backup is a snapshot. Proofs spent after it was made are worthless; Claim
// skips them (NUT-07) and keeps the rest. Proofs reserved by an unfinished
// operation live in the journal, not in the balance, so they are not included.
// MIT License

import { Amount, getEncodedToken } from "@cashu/cashu-ts";
import type { Proof } from "@cashu/cashu-ts";
import { normalizeMint, sumProofs } from "./storage";
import type { ProofsByMint } from "./storage";
import { errText } from "./outputs";

export type BackupToken = { mint: string; amount: number; token: string; error?: string };

/** One token per mint with a positive balance. */
export function backupTokens(proofsByMint: ProofsByMint): BackupToken[] {
  return Object.entries(proofsByMint)
    .filter(([, proofs]) => sumProofs(proofs) > 0)
    .map(([key, proofs]) => {
      const mint = normalizeMint(key);
      const amount = sumProofs(proofs);
      try {
        const asProofs = proofs.map((p) => ({ ...p, amount: Amount.from(p.amount) })) as Proof[];
        return { mint, amount, token: getEncodedToken({ mint, unit: "sat", proofs: asProofs }) };
      } catch (e) {
        // e.g. proofs from a legacy keyset, which a v4 token cannot carry
        return { mint, amount, token: "", error: errText(e) };
      }
    });
}

/** Plain-text file content for "Download backup". */
export function backupText(tokens: BackupToken[], when = new Date()): string {
  const lines = [
    `# cocoa.cash balance backup, ${when.toISOString()}`,
    "# Anyone with these tokens can spend the sats. Keep this file like cash.",
    "# To restore: paste each token into Claim (cocoa.cash or any Cashu wallet).",
    "",
  ];
  for (const t of tokens) {
    if (!t.token) continue;
    lines.push(`# ${t.mint} · ${t.amount} sat`, t.token, "");
  }
  return lines.join("\n");
}
