// src/pages/tip.tsx
// The embeddable tip widget. Runs in the VISITOR's browser (usually inside an
// iframe on the creator's site). It never holds the creator's balance:
//   - Lightning: NUT-04 mint at the creator's mint, outputs P2PK-locked to the
//     creator (NUT-11), delivered as a NUT-18 payload over NIP-17.
//   - Cashu token: forwarded as a NUT-18 payload over NIP-17.
//   - Any Cashu wallet: scan the NUT-18 payment request (creqA).
// The tip becomes final only when the creator's browser swaps it (NUT-03).
// MIT License

import React, { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { QRCodeSVG } from "qrcode.react";
import { parseTipParams } from "@/lib/tip/config";
import { buildPaymentRequest } from "@/lib/tip/nut18";
import { createLightningTip, createTokenTip, advanceTip, openOutbox } from "@/lib/tip/flows";
import type { OutboxRecord } from "@/lib/tip/flows";

const PRESETS = [21, 100, 1000];
const errText = (e: unknown) => (e instanceof Error ? e.message : e ? String(e) : "") || "Something went wrong";

function useAutoHeight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || typeof window === "undefined" || window.parent === window) return;
    const el = ref.current;
    const post = () => window.parent.postMessage({ type: "cocoa-tip:height", height: el.scrollHeight + 2 }, "*");
    const ro = new ResizeObserver(post);
    ro.observe(el);
    post();
    return () => ro.disconnect();
  }, []);
  return ref;
}

function Copy({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="tip-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {}
      }}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}

function Scanner({ onResult, onClose }: { onResult: (text: string) => void; onClose: (msg?: string) => void }) {
  const cb = useRef({ onResult, onClose });
  cb.current = { onResult, onClose };
  useEffect(() => {
    let scanner: import("html5-qrcode").Html5Qrcode | undefined;
    let stopped = false;
    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (stopped) return;
      scanner = new Html5Qrcode("tip-qr-reader");
      scanner
        .start({ facingMode: "environment" }, { fps: 15, qrbox: 220 }, (text) => {
          scanner?.stop().catch(() => {});
          cb.current.onResult(text.trim());
        }, () => {})
        .catch(() => cb.current.onClose("Camera not available"));
    });
    return () => {
      stopped = true;
      scanner?.stop?.().catch(() => {});
    };
  }, []);
  return <div id="tip-qr-reader" className="w-full rounded-2xl overflow-hidden" />;
}

export default function TipPage() {
  const router = useRouter();
  const cfg = useMemo(() => (router.isReady ? parseTipParams(router.query) : null), [router.isReady, router.query]);
  // Only used after the config was validated (pubkey + mints present).
  const ok = cfg && !cfg.error ? (cfg as Required<typeof cfg> & { pubkey: string }) : null;
  const boxRef = useAutoHeight();

  const [view, setView] = useState<"start" | "invoice" | "cashu" | "done">("start");
  const [amountInput, setAmountInput] = useState("");
  const [memo, setMemo] = useState("");
  const [record, setRecord] = useState<OutboxRecord | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const amount = cfg?.amount ?? (parseInt(amountInput, 10) || 0);

  const creq = useMemo(() => {
    if (!cfg || cfg.error) return "";
    try {
      return buildPaymentRequest({
        pubkey: cfg.pubkey!,
        relays: cfg.relays,
        mints: cfg.mints,
        amount: cfg.amount || undefined,
        description: cfg.label,
      });
    } catch {
      return "";
    }
  }, [cfg]);

  // Resume anything this visitor left unfinished (closed tab mid-payment).
  useEffect(() => {
    if (!cfg || cfg.error) return;
    const open = openOutbox(cfg.pubkey!);
    const unpaid = open.find((r) => r.kind === "lightning" && r.state === "UNPAID");
    if (unpaid) {
      setRecord(unpaid);
      setView("invoice");
    }
    // Finish paid-but-undelivered tips quietly in the background.
    open
      .filter((r) => r.state !== "UNPAID")
      .forEach((r) => advanceTip(r.id).catch(() => {}));
  }, [cfg]);

  // Poll the open Lightning tip until it is delivered.
  useEffect(() => {
    if (!record || view !== "invoice") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await advanceTip(record.id);
        if (cancelled) return;
        setRecord(next);
        setError(null);
        if (next.state === "DELIVERED") return setView("done");
        if (next.state === "EXPIRED") return setError("This invoice expired. Start a new tip.");
      } catch (e) {
        if (!cancelled) setError(errText(e));
      }
      if (!cancelled) timer = setTimeout(tick, 3000);
    };
    timer = setTimeout(tick, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [record?.id, view]); // eslint-disable-line react-hooks/exhaustive-deps

  const startLightning = async () => {
    if (!amount || amount <= 0) return setError("Enter an amount");
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const rec = await createLightningTip({
        mint: ok.mints[0],
        amount,
        pubkey: ok.pubkey,
        relays: ok.relays,
        memo: memo.trim().slice(0, 140),
      });
      setRecord(rec);
      setView("invoice");
    } catch (e) {
      setError(`Could not reach the mint. ${errText(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const sendToken = async (value?: string) => {
    const t = (value ?? token).trim().replace(/^cashu:/i, "");
    if (!t) return setError("Paste a Cashu token");
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const rec = await createTokenTip({
        token: t,
        mints: ok.mints,
        pubkey: ok.pubkey,
        relays: ok.relays,
        memo: memo.trim().slice(0, 140),
      });
      setRecord(rec);
      setView("done");
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setView("start");
    setRecord(null);
    setToken("");
    setError(null);
  };

  return (
    <>
      <Head>
        <title>Cashu tip</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <style jsx global>{`
        html,
        body {
          background: transparent !important;
        }
        .tip-primary {
          width: 100%;
          border-radius: 9999px;
          padding: 14px 20px;
          font-weight: 700;
          font-size: 17px;
          color: #0f1c18;
          background: linear-gradient(90deg, #4ff4c6, #a3ffe0);
          box-shadow: 0 0 30px -8px rgb(163 255 224);
        }
        .tip-primary:disabled {
          opacity: 0.5;
        }
        .tip-ghost {
          border: 1px solid rgba(79, 244, 198, 0.4);
          border-radius: 9999px;
          padding: 6px 14px;
          font-size: 13px;
          color: #e8fff7;
        }
        .tip-input {
          width: 100%;
          background: #0a1a14;
          border: 1px solid rgba(79, 244, 198, 0.3);
          border-radius: 14px;
          padding: 10px 12px;
          color: #e8fff7;
          font-size: 15px;
        }
        .tip-link {
          color: #4ff4c6;
          font-size: 13px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
      `}</style>

      <div ref={boxRef} className="w-full max-w-sm mx-auto p-2">
        <div className="glass rounded-3xl p-5 text-[#e8fff7]">
          {!cfg ? null : cfg.error ? (
            <p className="text-sm text-red-300">Tip button not configured: {cfg.error}.</p>
          ) : view === "done" ? (
            <div className="text-center py-6">
              <div className="text-5xl mb-3">⚡</div>
              <p className="text-xl font-semibold">Thank you!</p>
              <p className="text-sm opacity-80 mt-2">
                {record?.amount ? `${record.amount} sats` : "Your tip"} delivered to the creator.
              </p>
              <button className="tip-link mt-5" onClick={reset}>
                Send another
              </button>
            </div>
          ) : view === "invoice" && record ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm opacity-80">Pay {record.amount} sats with any Lightning wallet</p>
              <a href={`lightning:${record.invoice}`} className="bg-white p-3 rounded-2xl">
                <QRCodeSVG value={`lightning:${record.invoice}`.toUpperCase()} size={208} />
              </a>
              <div className="flex gap-2">
                <Copy text={record.invoice || ""} label="Copy invoice" />
                <a className="tip-ghost" href={`lightning:${record.invoice}`}>
                  Open wallet
                </a>
              </div>
              <p className="text-xs opacity-70">
                {record.state === "UNPAID" ? "Waiting for payment…" : "Paid. Delivering to the creator…"}
              </p>
              {record.state === "UNPAID" && (
                <button className="tip-link" onClick={reset}>
                  Cancel
                </button>
              )}
            </div>
          ) : view === "cashu" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold">Pay with Cashu</p>
              {scanning ? (
                <Scanner
                  onResult={(t: string) => {
                    setScanning(false);
                    setToken(t);
                    sendToken(t);
                  }}
                  onClose={(msg?: string) => {
                    setScanning(false);
                    if (msg) setError(msg);
                  }}
                />
              ) : (
                <textarea
                  className="tip-input font-mono text-xs"
                  rows={3}
                  placeholder="cashuB…"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
              )}
              <div className="flex gap-2">
                <button className="tip-primary" disabled={busy} onClick={() => sendToken()}>
                  {busy ? "Sending…" : `${cfg.label} with token`}
                </button>
                <button className="tip-ghost shrink-0" onClick={() => setScanning((s) => !s)}>
                  {scanning ? "Stop" : "Scan"}
                </button>
              </div>
              {creq && (
                <details className="text-xs opacity-90">
                  <summary className="cursor-pointer tip-link">Or scan with your Cashu wallet</summary>
                  <div className="flex flex-col items-center gap-2 mt-3">
                    <div className="bg-white p-3 rounded-2xl">
                      <QRCodeSVG value={creq} size={192} />
                    </div>
                    <Copy text={creq} label="Copy payment request" />
                  </div>
                </details>
              )}
              <button className="tip-link self-start" onClick={reset}>
                ← Back
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cfg.amount ? (
                <p className="text-center text-3xl font-bold">
                  {cfg.amount} <span className="text-base font-normal opacity-70">sats</span>
                </p>
              ) : (
                <>
                  <div className="flex gap-2 justify-center">
                    {PRESETS.map((p) => (
                      <button
                        key={p}
                        className="tip-ghost"
                        style={String(p) === amountInput ? { background: "#4ff4c6", color: "#0f1c18" } : undefined}
                        onClick={() => setAmountInput(String(p))}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <input
                    className="tip-input text-center"
                    inputMode="numeric"
                    placeholder="Amount in sats"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value.replace(/\D/g, ""))}
                  />
                </>
              )}
              <input
                className="tip-input"
                placeholder="Note (optional)"
                maxLength={140}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
              <button className="tip-primary" disabled={busy || !amount} onClick={startLightning}>
                {busy ? "…" : `⚡ ${cfg.label}${amount ? ` ${amount} sats` : ""}`}
              </button>
              <button className="tip-link" onClick={() => setView("cashu")}>
                Pay with a Cashu token instead
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-300 mt-3 break-words">{error}</p>}
          <p className="text-[10px] opacity-40 text-center mt-4">
            <a href="https://cocoa.cash" target="_blank" rel="noreferrer">
              cocoa.cash · Cashu
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
