// src/components/wallet/HistoryPanel.tsx
// Local activity list plus every token this wallet created (from the journal),
// and sends the mint never confirmed, with a Cancel that only returns the sats
// when the mint says they are unspent (journal cancelSend, NUT-07). On open,
// sent tokens the mint reports fully spent (claimed) are hidden; a mint that
// does not answer leaves its tokens listed.
// MIT License

import { useEffect, useState } from "react";
import Sheet from "./Sheet";
import { CopyButton } from "@/components/ui/CopyButton";
import { mintLabel } from "@/lib/utils/mintLabel";
import { listOps, cancelSend, markSentTokenIfClaimed, JOURNAL_EVENT } from "@/lib/cashu/journal";
import type { SendOp } from "@/lib/cashu/journal";
import { sumProofs } from "@/lib/cashu/storage";
import { errText } from "@/lib/cashu/outputs";

export type Tx = { id: number; type: string; amount: number; mint: string; timestamp: string };

const LABEL: Record<string, string> = { mint: "Mint", melt: "Melt", "swap-send": "Send", "swap-claim": "Claim" };

export default function HistoryPanel({ transactions, onClose }: { transactions: Tx[]; onClose: () => void }) {
  const [sent, setSent] = useState<SendOp[]>([]);
  const [stuck, setStuck] = useState<SendOp[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [checking, setChecking] = useState(false);
  const load = () => {
    const sends = listOps().filter((o): o is SendOp => o.kind === "send");
    setSent(sends.filter((o) => !!o.token && !o.claimed));
    setStuck(sends.filter((o) => o.state === "PREPARED"));
  };
  useEffect(() => {
    load(); // eslint-disable-line react-hooks/set-state-in-effect -- read the journal once on open
    window.addEventListener(JOURNAL_EVENT, load);
    // NUT-07: hide sent tokens whose proofs are all spent. Errors keep the token.
    const toCheck = listOps().filter((o): o is SendOp => o.kind === "send" && !!o.token && !o.claimed);
    if (toCheck.length) {
      setChecking(true);
      Promise.allSettled(toCheck.map((o) => markSentTokenIfClaimed(o.id))).finally(() => setChecking(false));
    }
    return () => window.removeEventListener(JOURNAL_EVENT, load);
  }, []);

  const cancel = async (id: string) => {
    setBusy(id);
    setNote("");
    try {
      const op = await cancelSend(id); // returns the sats only if NUT-07 says the inputs are UNSPENT
      if (op.state === "FAILED" && op.error === "Cancelled") {
        setNote(`Cancelled. ${sumProofs(op.inputs).toLocaleString("en-US")} sat are back in your balance.`);
      } else if (op.state === "FAILED") {
        setNote("The mint says these sats were already spent elsewhere, so there is nothing to return.");
      } else if (op.state === "DONE") {
        setNote("The mint finished this send after all. Its token is under Sent tokens.");
      } else {
        setNote("The mint has not settled these sats yet, so they stay held. Try again later.");
      }
    } catch (e) {
      setNote(`Could not reach the mint: ${errText(e)}`);
    } finally {
      setBusy(null);
      load();
    }
  };

  return (
    <Sheet title="History" onClose={onClose}>
      {note && (
        <p className="mb-4 rounded-2xl border border-[#4ff4c6]/30 bg-[#4ff4c6]/5 px-4 py-3 text-sm text-[#a3ffe0]" role="status">
          {note}
        </p>
      )}
      {stuck.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-4" data-testid="stuck-sends">
          <p className="text-[#e8fff7]">Unfinished sends ({stuck.length})</p>
          <p className="mt-1 text-xs text-[#e8fff7]/50">
            The mint has not confirmed these, so their sats are held back. Cancel asks the mint first and returns the sats only if
            they were never spent.
          </p>
          <div className="mt-3 space-y-3">
            {stuck.map((op) => (
              <div key={op.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-[#e8fff7]">
                    {op.amount} sat · {mintLabel(op.mint)}
                  </p>
                  <p className="truncate text-xs text-[#e8fff7]/50">
                    {new Date(op.createdAt).toLocaleString()}
                    {op.error ? ` · ${op.error}` : ""}
                  </p>
                </div>
                <div className="w-28 shrink-0">
                  <button className="btn-ghost w-full !py-2 !text-sm" disabled={!!busy} onClick={() => cancel(op.id)}>
                    {busy === op.id ? "Checking…" : "Cancel"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {sent.length > 0 && (
        <details className="mb-4 rounded-2xl border border-[#4ff4c6]/15 bg-[#07110d]/50 p-4">
          <summary className="cursor-pointer text-[#a3ffe0]">Sent tokens ({sent.length})</summary>
          <p className="mt-2 text-xs text-[#e8fff7]/50">
            {checking ? "Checking which tokens were claimed…" : "If a receiver never claimed one, claim it back yourself."}
          </p>
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
