// src/components/wallet/FlowSheet.tsx
// One panel for the four wallet actions. It only collects input, calls the
// matching useCashu handler, and renders the handler's result (dataOutput).
// All Cashu logic stays in useCashu / the journal.
// MIT License

import { useEffect, useRef, useState } from "react";
import Sheet from "./Sheet";
import { QrPlate } from "@/components/ui/QrPlate";
import { CopyButton } from "@/components/ui/CopyButton";
import { Check } from "@/components/ui/Check";
import type { FlowType } from "./Orbs";
import type { DataOutput } from "@/hooks/useCashu";

type Stage =
  | { k: "input" }
  | { k: "working"; label: string }
  | { k: "invoice"; invoice: string }
  | { k: "confirm-melt"; quoteId: string; amount: number; feeReserve: number }
  | { k: "token"; token: string; amount: number }
  | { k: "done"; title: string; lines: string[] }
  | { k: "error"; title: string; detail: string };

const TITLES: Record<FlowType, string> = {
  mint: "Mint · Lightning in",
  melt: "Melt · Pay Lightning",
  send: "Send ecash",
  claim: "Claim ecash",
};

export default function FlowSheet({
  type,
  balance,
  dataOutput,
  isProcessing,
  run,
  confirm,
  onScan,
  onClose,
}: {
  type: FlowType;
  balance: number;
  dataOutput: DataOutput;
  isProcessing: boolean;
  run: (type: FlowType, input: string) => Promise<void>;
  /** Second step of a two-step action (pay a confirmed melt quote). */
  confirm: (type: FlowType, ref: string) => Promise<void>;
  onScan: (apply: (text: string) => void) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const [hint, setHint] = useState("");
  const [stage, setStage] = useState<Stage>({ k: "input" });
  const baseline = useRef<DataOutput>(dataOutput);

  const isAmount = type === "mint" || type === "send";

  // Map the hook's result onto this panel. Only results produced after submit count.
  useEffect(() => {
    const d = dataOutput;
    if (!d || d === baseline.current || stage.k === "input") return;
    /* eslint-disable react-hooks/set-state-in-effect -- mirrors the hook's latest result */
    if (d.error) {
      setStage({ k: "error", title: d.error, detail: d.details || d.message || "" });
    } else if (type === "mint" && d.invoice) {
      setStage({ k: "invoice", invoice: d.invoice });
    } else if (type === "melt" && d.type === "melt-quote" && d.quoteId) {
      setStage({ k: "confirm-melt", quoteId: d.quoteId, amount: d.amount ?? 0, feeReserve: d.feeReserve ?? 0 });
    } else if (type === "mint" && d.type === "mint") {
      setStage({ k: "done", title: "Sats received", lines: [`+${d.amount ?? ""} sat`] });
    } else if (type === "melt" && d.type === "melt") {
      const lines = [`Paid ${d.amount} sat`, `Fee reserve ${d.feeReserve ?? 0} sat`];
      if (d.changeReceived) lines.push(`Change returned ${d.changeReceived} sat`);
      setStage({ k: "done", title: "Invoice paid", lines });
    } else if (type === "send" && d.token) {
      setStage({ k: "token", token: d.token, amount: d.amount || 0 });
    } else if (type === "claim" && d.type === "swap-claim") {
      const lines = [`+${d.amount} sat`];
      if (d.spent) lines.push(`${d.spent} sat in this token were already spent`);
      setStage({ k: "done", title: "Ecash claimed", lines });
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [dataOutput, type, stage.k]);

  const submit = async () => {
    const v = value.trim();
    if (isAmount && !(parseInt(v, 10) > 0)) return setHint("Enter an amount in sat");
    if (!isAmount && !v) return setHint(type === "melt" ? "Paste or scan a Lightning invoice" : "Paste or scan a Cashu token");
    setHint("");
    baseline.current = dataOutput;
    setStage({ k: "working", label: type === "melt" ? "Getting a quote…" : "Talking to the mint…" });
    await run(type, v);
  };

  const confirmStep = async (ref: string, label: string) => {
    baseline.current = dataOutput;
    setStage({ k: "working", label });
    await confirm(type, ref);
  };

  const paste = async () => {
    try {
      const t = (await navigator.clipboard.readText()).trim();
      if (t) setValue(t.replace(/^lightning:/i, ""));
    } catch {
      setHint("Clipboard blocked: long-press the field to paste");
    }
  };

  const reset = () => {
    setValue("");
    setStage({ k: "input" });
  };

  return (
    <Sheet title={TITLES[type]} onClose={onClose}>
      {stage.k === "input" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-5"
        >
          {isAmount ? (
            <div className="text-center">
              <div className="rounded-3xl border border-[#4ff4c6]/20 bg-[#07110d]/60 px-4 py-6 focus-within:border-[#4ff4c6]/70">
                <input
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  aria-label="Amount in sat"
                  className="block w-full min-w-0 bg-transparent text-center text-6xl font-extralight tabular-nums text-[#e8fff7] outline-none placeholder:text-[#e8fff7]/20"
                />
                <span className="mt-1 block text-sm uppercase tracking-[0.4em] text-[#a3ffe0]/70">sat</span>
              </div>
              {type === "send" && <p className="mt-3 text-sm text-[#e8fff7]/50">Available {balance.toLocaleString("en-US")} sat</p>}
            </div>
          ) : (
            <div>
              <textarea
                autoFocus
                rows={4}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === "melt" ? "lnbc1…" : "cashuB…"}
                aria-label={type === "melt" ? "Lightning invoice" : "Cashu token"}
                className="field resize-none font-mono text-sm"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button type="button" className="btn-ghost" onClick={paste}>
                  Paste
                </button>
                <button type="button" className="btn-ghost" onClick={() => onScan((t) => setValue(t))}>
                  Scan QR
                </button>
              </div>
            </div>
          )}
          {hint && <p className="text-center text-sm text-amber-200">{hint}</p>}
          <button className="btn-neon" disabled={isProcessing}>
            {type === "mint" ? "Create invoice" : type === "melt" ? "Review payment" : type === "send" ? "Create token" : "Claim"}
          </button>
        </form>
      )}

      {stage.k === "working" && (
        <div className="py-10 text-center">
          <Check tone="wait" />
          <p className="mt-5 text-[#e8fff7]/70">{stage.label}</p>
        </div>
      )}

      {stage.k === "confirm-melt" && (
        <div className="space-y-5 text-center" data-testid="melt-confirm">
          <p className="text-sm uppercase tracking-[0.3em] text-[#a3ffe0]/80">Confirm payment</p>
          <p className="text-5xl font-extralight tabular-nums text-[#e8fff7]">
            {stage.amount.toLocaleString("en-US")} <span className="text-base uppercase tracking-[0.3em] text-[#a3ffe0]/70">sat</span>
          </p>
          <div className="space-y-1 text-sm text-[#e8fff7]/70">
            <p>Lightning fee reserve: up to {stage.feeReserve.toLocaleString("en-US")} sat</p>
            <p>Held for this payment: {(stage.amount + stage.feeReserve).toLocaleString("en-US")} sat</p>
            <p className="text-xs text-[#e8fff7]/45">Any fee reserve the mint does not use comes back as change.</p>
          </div>
          {stage.amount + stage.feeReserve > balance && (
            <p className="text-sm text-amber-200">Not enough balance: you have {balance.toLocaleString("en-US")} sat.</p>
          )}
          <button
            className="btn-neon"
            disabled={isProcessing || stage.amount + stage.feeReserve > balance}
            onClick={() => confirmStep(stage.quoteId, "Paying…")}
          >
            Pay {stage.amount.toLocaleString("en-US")} sat
          </button>
          <button className="btn-ghost w-full" onClick={reset}>
            Cancel
          </button>
        </div>
      )}

      {stage.k === "invoice" && (
        <div className="space-y-5 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-[#a3ffe0]/80">Waiting for payment</p>
          <QrPlate value={`lightning:${stage.invoice}`} />
          <p className="readout max-h-20 overflow-y-auto text-left">{stage.invoice}</p>
          <CopyButton text={stage.invoice} label="Copy invoice" primary />
          <p className="text-xs text-[#e8fff7]/45">You can close this. The sats arrive as soon as it is paid.</p>
        </div>
      )}

      {stage.k === "token" && (
        <div className="space-y-5 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-[#a3ffe0]/80">{stage.amount.toLocaleString("en-US")} sat token</p>
          <QrPlate value={stage.token} />
          <p className="readout max-h-24 overflow-y-auto text-left">{stage.token}</p>
          <CopyButton text={stage.token} label="Copy token" primary />
          <p className="text-xs text-[#e8fff7]/45">A copy is kept in History until you no longer need it.</p>
        </div>
      )}

      {stage.k === "done" && (
        <div className="space-y-5 py-4 text-center" data-testid="flow-done">
          <Check />
          <p className="text-2xl font-light text-[#e8fff7] glow-text">{stage.title}</p>
          <div className="space-y-1 text-[#e8fff7]/70">
            {stage.lines.map((l) => (
              <p key={l}>{l}</p>
            ))}
          </div>
          <button className="btn-neon" onClick={onClose}>
            Done
          </button>
        </div>
      )}

      {stage.k === "error" && (
        <div className="space-y-5 py-4 text-center" data-testid="flow-error">
          <Check tone="error" />
          <p className="text-xl text-[#e8fff7]">{stage.title}</p>
          {stage.detail && <p className="text-sm text-[#e8fff7]/60">{stage.detail}</p>}
          <button className="btn-ghost w-full" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    </Sheet>
  );
}
