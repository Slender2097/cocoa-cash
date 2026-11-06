// src/pages/index.tsx
// MIT License
// Copyright (c) 2026 Jose2097
//
// The wallet screen. Presentation only: every action goes through useCashu
// (and from there the write-ahead journal); nothing here touches proofs.

import { useCallback, useEffect, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import useCashu from "@/hooks/useCashu";
import Cosmos from "@/components/wallet/Cosmos";
import BalanceCore from "@/components/wallet/BalanceCore";
import Orbs from "@/components/wallet/Orbs";
import type { FlowType } from "@/components/wallet/Orbs";
import { Glyph, TipsGlyph } from "@/components/wallet/HeaderGlyphs";
import FlowSheet from "@/components/wallet/FlowSheet";
import MintsPanel from "@/components/wallet/MintsPanel";
import SeedVault from "@/components/wallet/SeedVault";
import HistoryPanel from "@/components/wallet/HistoryPanel";
import type { Tx } from "@/components/wallet/HistoryPanel";
import MenuPanel from "@/components/wallet/MenuPanel";
import Scanner from "@/components/wallet/Scanner";
import WelcomeModal from "@/components/wallet/WelcomeModal";
import { mintLabel } from "@/lib/utils/mintLabel";

type Panel = { k: "flow"; type: FlowType } | { k: "mints"; note?: string } | { k: "vault" } | { k: "history" } | { k: "menu" } | null;

const SIGN: Record<string, number> = { mint: 1, "swap-claim": 1, melt: -1, "swap-send": -1 };

export default function Home() {
  const {
    walletReady,
    isProcessing,
    dataOutput,
    balance,
    handleSetMint,
    handleMint,
    handleMelt,
    handleSwapSend,
    handleSwapClaim,
    setDataOutput,
    storage,
  } = useCashu();
  // Same storage instance as useCashu (see the note there).
  const { activeMint, securityLevel, setSecurityLevel, mnemonic, restoreFromSeed, proofsByMint } = storage;

  const [panel, setPanel] = useState<Panel>(null);
  const [scanApply, setScanApply] = useState<((t: string) => void) | null>(null);
  const [welcome, setWelcome] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [transactions, setTransactions] = useState<Tx[]>([]);

  const close = useCallback(() => setPanel(null), []);
  const closeScanner = useCallback(() => setScanApply(null), []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    if (localStorage.getItem("cocoa-welcome-accepted") !== "true") setWelcome(true);
    try {
      setTransactions(JSON.parse(localStorage.getItem("transaction_history") || "[]"));
    } catch {
      // keep empty
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Results that arrive while no action panel is open (mint connect, a paid
  // invoice finishing in the background) become a short toast.
  const flowOpen = panel?.k === "flow";
  useEffect(() => {
    if (!dataOutput || flowOpen) return;
    let next: { text: string; tone: "ok" | "error" } | null = null;
    if (dataOutput.error) next = { text: `${dataOutput.error}${dataOutput.details ? `: ${dataOutput.details}` : ""}`, tone: "error" };
    else if (dataOutput.status?.includes("Mint connected")) next = { text: `Connected to ${mintLabel(activeMint)}`, tone: "ok" };
    else if (dataOutput.type === "mint") next = { text: `+${dataOutput.amount} sat received`, tone: "ok" };
    if (!next) return;
    setToast(next); // eslint-disable-line react-hooks/set-state-in-effect -- mirrors the hook's latest result
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataOutput]);

  // Clear one-shot status results after a while (errors stay until replaced).
  useEffect(() => {
    if (!dataOutput?.status) return;
    const t = setTimeout(() => setDataOutput(null), 5000);
    return () => clearTimeout(t);
  }, [dataOutput, setDataOutput]);

  // Local activity list: one entry per successful result object.
  const recorded = useRef<object | null>(null);
  useEffect(() => {
    const d = dataOutput;
    if (!d || !d.type || !d.amount || recorded.current === d || !activeMint) return;
    if (d.type !== "swap-send" && !d.status?.toLowerCase().includes("success")) return;
    recorded.current = d;
    const tx: Tx = { id: Date.now(), type: d.type, amount: d.amount * (SIGN[d.type] || 1), mint: activeMint, timestamp: new Date().toLocaleString() };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- records the hook's latest result
    setTransactions((prev) => {
      const next = [tx, ...prev];
      localStorage.setItem("transaction_history", JSON.stringify(next));
      return next;
    });
  }, [dataOutput, activeMint]);

  const run = async (type: FlowType, input: string) => {
    if (type === "mint") return handleMint(input);
    if (type === "melt") return handleMelt(input);
    if (type === "send") return handleSwapSend(input);
    return handleSwapClaim(input);
  };

  const openFlow = (type: FlowType) => {
    if (!walletReady || !activeMint) return setPanel({ k: "mints", note: "Connect a mint first." });
    setPanel({ k: "flow", type });
  };

  const connect = (url: string) => {
    setPanel(null);
    handleSetMint(url);
  };

  return (
    <>
      <Head>
        <title>cocoa.cash · Cashu wallet</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#07110d" />
      </Head>
      <Cosmos />

      <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button onClick={() => setPanel({ k: "menu" })} aria-label="Menu" className="flex items-center gap-2 rounded-2xl p-1 transition active:scale-95">
            <Image src="/jaguar-logo.png" alt="cocoa.cash" width={80} height={60} className="h-14 w-auto drop-shadow-[0_0_14px_rgba(79,244,198,0.7)]" priority />
            <span className="hidden text-lg font-light tracking-[0.2em] text-[#e8fff7]/80 sm:inline">cocoa</span>
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Glyph name="mints" label="Mints" onClick={() => setPanel({ k: "mints" })} />
            <Glyph name="history" label="History" onClick={() => setPanel({ k: "history" })} />
            <span className="relative">
              <Glyph name="vault" label="Seed vault" onClick={() => setPanel({ k: "vault" })} />
              {securityLevel < 2 && <span className="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_8px_#fcd34d]" />}
            </span>
            <TipsGlyph />
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center gap-10 py-8">
          <BalanceCore
            balance={balance || 0}
            mint={activeMint}
            connected={walletReady && !!activeMint}
            covered={!!panel || !!scanApply || welcome}
            onMints={() => setPanel({ k: "mints" })}
          />
          <Orbs disabled={false} onPick={openFlow} />
        </main>
      </div>

      {toast && (
        <div className="anim-rise pointer-events-none fixed inset-x-0 top-[calc(max(1rem,env(safe-area-inset-top))+4.5rem)] z-[80] flex justify-center px-4">
          <p
            className={`glass max-w-md rounded-full px-5 py-3 text-sm ${toast.tone === "error" ? "text-red-200" : "text-[#a3ffe0]"}`}
            role="status"
          >
            {toast.text}
          </p>
        </div>
      )}

      {panel?.k === "flow" && (
        <FlowSheet
          type={panel.type}
          balance={balance || 0}
          dataOutput={dataOutput}
          isProcessing={isProcessing}
          run={run}
          onScan={(apply) => setScanApply(() => apply)}
          onClose={close}
        />
      )}
      {panel?.k === "mints" && (
        <MintsPanel
          activeMint={activeMint}
          connected={walletReady}
          proofsByMint={proofsByMint}
          note={panel.note}
          onConnect={connect}
          onClose={close}
        />
      )}
      {panel?.k === "vault" && (
        <SeedVault
          mnemonic={mnemonic}
          backedUp={securityLevel >= 2}
          onBackedUp={() => setSecurityLevel(2)}
          onRestore={restoreFromSeed}
          onClose={close}
        />
      )}
      {panel?.k === "history" && <HistoryPanel transactions={transactions} onClose={close} />}
      {panel?.k === "menu" && <MenuPanel onClose={close} />}
      {scanApply && <Scanner onResult={scanApply} onClose={closeScanner} />}
      {welcome && <WelcomeModal onAccept={() => setWelcome(false)} />}
    </>
  );
}
