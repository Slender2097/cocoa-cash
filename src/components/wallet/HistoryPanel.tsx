// src/components/wallet/HistoryPanel.tsx
// Local activity list plus every token this wallet created (from the journal).
// MIT License

import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { CopyButton } from "@/components/ui/CopyButton";
import { mintLabel } from "@/lib/utils/mintLabel";
import { listOps, JOURNAL_EVENT } from "@/lib/cashu/journal";
import type { SendOp } from "@/lib/cashu/journal";

export type Tx = { id: number; type: string; amount: number; mint: string; timestamp: string };

const LABEL: Record<string, string> = { mint: "Mint", melt: "Melt", "swap-send": "Send", "swap-claim": "Claim" };

export default function HistoryPanel({ transactions, onClose }: { transactions: Tx[]; onClose: () => void }) {
  const [sent, setSent] = useState<SendOp[]>([]);
  useEffect(() => {
    const load = () => setSent(listOps().filter((o): o is SendOp => o.kind === "send" && !!o.token));
    load();
    window.addEventListener(JOURNAL_EVENT, load);
    return () => window.removeEventListener(JOURNAL_EVENT, load);
  }, []);

  return (
    <Sheet title="History" onClose={onClose}>
      {sent.length > 0 && (
        <details className="mb-4 rounded-2xl border border-[#4ff4c6]/15 bg-[#07110d]/50 p-4">
          <summary className="cursor-pointer text-[#a3ffe0]">Sent tokens ({sent.length})</summary>
          <p className="mt-2 text-xs text-[#e8fff7]/50">If a receiver never claimed one, claim it back yourself.</p>
          <div className="mt-3 space-y-3">
            {sent.map((op) => (
              <div key={op.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[#e8fff7]">{op.amount} sat</p>
                  <p className="text-xs text-[#e8fff7]/50">{new Date(op.createdAt).toLocaleString()}</p>
                </div>
                <div className="w-32 shrink-0">
                  <CopyButton text={op.token || ""} label="Copy" />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {transactions.length === 0 ? (
        <p className="py-12 text-center text-[#e8fff7]/40">Nothing here yet</p>
      ) : (
        <ul className="space-y-2">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-[#07110d]/40 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[#e8fff7]">{LABEL[tx.type] || tx.type}</p>
                <p className="truncate text-xs text-[#e8fff7]/45">
                  {tx.timestamp} · {tx.mint ? mintLabel(tx.mint) : ""}
                </p>
              </div>
              <p className={`shrink-0 tabular-nums ${tx.amount > 0 ? "text-[#4ff4c6]" : "text-[#e8fff7]/70"}`}>
                {tx.amount > 0 ? "+" : ""}
                {tx.amount} sat
              </p>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
