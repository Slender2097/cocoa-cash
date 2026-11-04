// src/pages/creator.jsx
// Creator setup + admin board for the tip embed. Everything here lives in the
// creator's browser: the receiving key (sealed with their passphrase), the
// inbox of NUT-18 payloads, and the proofs (in the full wallet's store).
// There is no account, no server ledger, and no custody by cocoa.cash.
// MIT License

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import {
  KNOWN_MINTS,
  DEFAULT_RELAYS,
  normalizeMint,
  isKnownMint,
  buildEmbed,
  walletMintKey,
} from "@/lib/tip/config";
import { generateSecretKey, getPublicKey, npubEncode, nsecEncode, nsecDecode } from "@/lib/tip/nut18";
import { seal, unseal } from "@/lib/tip/seal";
import { listRecords, readWalletProofs, sumProofs, rememberMint } from "@/lib/tip/records";
import { INBOX, getWallet, syncInbox, claimAll } from "@/lib/tip/flows";

const CONFIG_KEY = "cocoaTip.config";
const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const fromHex = (h) => new Uint8Array(h.match(/.{2}/g).map((x) => parseInt(x, 16)));
const errText = (e) => (e && (e.message || String(e))) || "Something went wrong";
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleString() : "");

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
  } catch {
    return null;
  }
}
const saveConfig = (c) => localStorage.setItem(CONFIG_KEY, JSON.stringify(c));

function Panel({ title, children, right }) {
  return (
    <section className="glass rounded-3xl p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-xs uppercase tracking-[3px] text-[#4ff4c6]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function CopyRow({ label, value }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs opacity-70">{label}</span>
        <button
          className="text-xs text-[#4ff4c6]"
          onClick={() => navigator.clipboard.writeText(value).then(() => (setOk(true), setTimeout(() => setOk(false), 1500)))}
        >
          {ok ? "Copied ✓" : "Copy"}
        </button>
      </div>
      <pre className="font-mono text-xs bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl p-3 whitespace-pre-wrap break-all">
        {value}
      </pre>
    </div>
  );
}

const inputCls =
  "w-full bg-[#0a1a14] border border-[#4ff4c6]/30 rounded-2xl px-4 py-3 text-[#e8fff7] placeholder:text-[#e8fff7]/40";
const btnCls =
  "rounded-3xl px-6 py-3 font-semibold text-[#0f1c18] bg-gradient-to-r from-[#4ff4c6] to-[#a3ffe0] disabled:opacity-50";
const ghostCls = "rounded-3xl px-4 py-2 text-sm border border-[#4ff4c6]/40 hover:border-[#4ff4c6]";

// ----------------------------------------------------------------------------
// Settings form (used for first setup and for edits)
// ----------------------------------------------------------------------------
function SettingsForm({ initial, isNew, onSave }) {
  const [mints, setMints] = useState(initial?.mints?.join(", ") || "");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [label, setLabel] = useState(initial?.label || "Tip");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [nsec, setNsec] = useState("");
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const mintList = mints.split(",").map(normalizeMint).filter(Boolean);
  const unknown = mintList.filter((m) => !isKnownMint(m));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!mintList.length) return setError("Add at least one mint");
    if (amount && !(parseInt(amount, 10) > 0)) return setError("Amount must be a positive number, or empty for any amount");
    if (unknown.length && !trust) return setError("Confirm that you trust the mint(s) not in the known list");
    if (isNew) {
      if (pass.length < 4) return setError("Pick a passphrase of at least 4 characters");
      if (pass !== pass2) return setError("Passphrases do not match");
    }
    setBusy(true);
    try {
      for (const m of mintList) {
        try {
          await getWallet(m);
        } catch (err) {
          throw new Error(`Cannot reach ${m}: ${errText(err)}`);
        }
      }
      await onSave({
        mints: mintList,
        amount: amount ? parseInt(amount, 10) : null,
        label: label.trim() || "Tip",
        pass,
        nsec: nsec.trim(),
      });
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="text-sm">
        Mint (one, or a short list separated by commas). The first one is used for Lightning.
        <input className={inputCls + " mt-2"} value={mints} onChange={(e) => setMints(e.target.value)} placeholder="https://mint.example.com" />
      </label>
      <div className="flex flex-wrap gap-2 -mt-2">
        {KNOWN_MINTS.map((m) => (
          <button
            type="button"
            key={m}
            className="text-xs px-3 py-1 rounded-2xl bg-white/5 hover:bg-white/10"
            onClick={() => setMints((prev) => (prev.trim() ? `${prev.trim()}, ${m}` : m))}
          >
            + {m.replace("https://", "")}
          </button>
        ))}
      </div>
      {unknown.length > 0 && (
        <div className="text-sm text-yellow-200 bg-yellow-500/10 border border-yellow-400/30 rounded-2xl p-3">
          ⚠️ {unknown.join(", ")} {unknown.length > 1 ? "are" : "is"} not in cocoa.cash&apos;s short list of known mints. The
          mint holds the sats behind every tip, so only use a mint you trust.
          <label className="flex items-center gap-2 mt-2">
            <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} /> I trust this mint
          </label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          Amount in sats (empty = any)
          <input className={inputCls + " mt-2"} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="any" />
        </label>
        <label className="text-sm">
          Button text
          <select className={inputCls + " mt-2"} value={label} onChange={(e) => setLabel(e.target.value)}>
            <option>Tip</option>
            <option>Donate</option>
          </select>
        </label>
      </div>
      {isNew && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Admin passphrase
              <input type="password" className={inputCls + " mt-2"} value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
            <label className="text-sm">
              Repeat passphrase
              <input type="password" className={inputCls + " mt-2"} value={pass2} onChange={(e) => setPass2(e.target.value)} />
            </label>
          </div>
          <p className="text-xs opacity-70 -mt-2">
            It locks this board and your receiving key in this browser. cocoa.cash never sees it and cannot reset it.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer text-[#4ff4c6]">I already have a receiving key (restore)</summary>
            <input className={inputCls + " mt-2 font-mono text-xs"} value={nsec} onChange={(e) => setNsec(e.target.value)} placeholder="nsec1…" />
            <p className="text-xs opacity-70 mt-1">Tips sent to this key that are still unclaimed will show up after you unlock.</p>
          </details>
        </>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
      <button className={btnCls} disabled={busy}>
        {busy ? "Checking mint…" : isNew ? "Create my tip button" : "Save settings"}
      </button>
    </form>
  );
}

// ----------------------------------------------------------------------------
export default function CreatorPage() {
  const [config, setConfig] = useState(undefined); // undefined = loading
  const [skHex, setSkHex] = useState(null);
  const [pass, setPass] = useState("");
  const [unlockError, setUnlockError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [showNsec, setShowNsec] = useState(false);
  const [origin, setOrigin] = useState("https://cocoa.cash");

  useEffect(() => {
    setConfig(loadConfig());
    setOrigin(window.location.origin);
    const onStorage = (e) => {
      if (e.key === "proofsByMint" || e.key === INBOX) setTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const relays = config?.relays?.length ? config.relays : DEFAULT_RELAYS;

  const sync = useCallback(async () => {
    if (!skHex || !config) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await syncInbox(fromHex(skHex), relays, config.mints);
      await claimAll(skHex);
      setLastSync(Date.now());
    } catch (e) {
      setSyncError(errText(e));
    } finally {
      setSyncing(false);
      setTick((t) => t + 1);
    }
  }, [skHex, config, relays]);

  // Check on unlock, then every 60 s while the board is open.
  useEffect(() => {
    if (!skHex) return;
    sync();
    const id = setInterval(sync, 60000);
    return () => clearInterval(id);
  }, [skHex]); // eslint-disable-line react-hooks/exhaustive-deps

  const inbox = useMemo(() => (typeof window === "undefined" ? [] : listRecords(INBOX)), [tick, skHex]); // eslint-disable-line
  const balances = useMemo(() => {
    if (typeof window === "undefined") return [];
    const all = readWalletProofs();
    const keys = new Set([...Object.keys(all), ...(config?.mints || []).map(walletMintKey)]);
    return [...keys]
      .map((k) => ({ mint: normalizeMint(k), sats: sumProofs(all[k]), configured: (config?.mints || []).some((m) => walletMintKey(m) === k) }))
      .filter((b) => b.sats > 0 || b.configured);
  }, [tick, config]); // eslint-disable-line

  const createConfig = async ({ mints, amount, label, pass: pp, nsec }) => {
    const sk = nsec ? nsecDecode(nsec) : generateSecretKey();
    const pubkey = getPublicKey(sk);
    const next = {
      v: 1,
      mints,
      amount,
      label,
      relays: [],
      pubkey,
      npub: npubEncode(pubkey),
      sealedKey: await seal({ sk: toHex(sk) }, pp),
      createdAt: Date.now(),
    };
    saveConfig(next);
    mints.forEach(rememberMint);
    setConfig(next);
    setSkHex(toHex(sk));
  };

  const updateConfig = async ({ mints, amount, label }) => {
    const next = { ...config, mints, amount, label };
    saveConfig(next);
    mints.forEach(rememberMint);
    setConfig(next);
    setEditing(false);
  };

  const unlock = async (e) => {
    e.preventDefault();
    setUnlockError(null);
    try {
      const { sk } = await unseal(config.sealedKey, pass);
      setSkHex(sk);
      setPass("");
    } catch {
      setUnlockError("Wrong passphrase");
    }
  };

  // Read-only sealed export: a copy of the proofs and the receiving key,
  // encrypted with the admin passphrase. Nothing is removed from the wallet.
  const exportSealed = async () => {
    const pp = window.prompt("Passphrase to seal the export with:");
    if (!pp) return;
    const box = await seal(
      {
        kind: "cocoa-tip-export",
        exportedAt: new Date().toISOString(),
        nsec: nsecEncode(fromHex(skHex)),
        proofsByMint: readWalletProofs(),
      },
      pp
    );
    const blob = new Blob([JSON.stringify(box, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cocoa-tips-sealed-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const embed = config?.npub
    ? buildEmbed({ origin, mints: config.mints, amount: config.amount, npub: config.npub, relays: config.relays, label: config.label })
    : null;

  const received = inbox.filter((r) => r.state === "RECEIVED");
  const pending = inbox.filter((r) => r.state === "NEW" || r.state === "SWAPPING");
  const failed = inbox.filter((r) => r.state === "FAILED");

  return (
    <>
      <Head>
        <title>Tip board · cocoa.cash</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="max-w-2xl mx-auto px-4 py-8 text-[#e8fff7]">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Tip board</h1>
          <div className="flex gap-2">
            <Link href="/" className={ghostCls}>
              Full wallet →
            </Link>
            {skHex && (
              <button className={ghostCls} onClick={() => setSkHex(null)}>
                Lock
              </button>
            )}
          </div>
        </div>

        {config === undefined ? null : !config ? (
          <Panel title="Create your tip button">
            <p className="text-sm opacity-80 mb-4">
              Choose a mint and an amount. You get one link or one script tag to paste on your site. Tips arrive in this
              browser&apos;s wallet. No account, no email.
            </p>
            <SettingsForm isNew onSave={createConfig} />
          </Panel>
        ) : !skHex ? (
          <Panel title="Unlock">
            <form onSubmit={unlock} className="flex gap-3">
              <input type="password" autoFocus className={inputCls} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Admin passphrase" />
              <button className={btnCls}>Unlock</button>
            </form>
            {unlockError && <p className="text-sm text-red-300 mt-2">{unlockError}</p>}
          </Panel>
        ) : (
          <>
            <Panel title="Balance">
              {balances.length === 0 && <p className="text-sm opacity-70">No sats yet.</p>}
              {balances.map((b) => (
                <div key={b.mint} className="flex items-center justify-between py-1">
                  <span className="text-sm break-all opacity-90">{b.mint.replace(/^https?:\/\//, "")}</span>
                  <span className="font-mono text-lg">{b.sats} sat</span>
                </div>
              ))}
              <p className="text-xs opacity-60 mt-3">
                These proofs live only in this browser. Use the full wallet to melt (pay out) or send them.
              </p>
            </Panel>

            <Panel
              title="Tips"
              right={
                <button className={ghostCls} onClick={sync} disabled={syncing}>
                  {syncing ? "Checking…" : "Check now"}
                </button>
              }
            >
              {syncError && <p className="text-sm text-red-300 mb-2">{syncError}</p>}
              {received.length === 0 && pending.length === 0 && failed.length === 0 && (
                <p className="text-sm opacity-70">No tips yet. {lastSync ? `Last checked ${fmtTime(lastSync)}.` : ""}</p>
              )}
              {pending.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-yellow-200 mb-1">Pending</p>
                  {pending.map((r) => (
                    <Row key={r.id} r={r} amount={r.offered} note={r.error ? `retrying: ${r.error}` : "claiming…"} />
                  ))}
                </div>
              )}
              {received.slice(0, 50).map((r) => (
                <Row key={r.id} r={r} amount={r.amount} note={r.fees ? `${r.fees} sat mint fee` : ""} />
              ))}
              {failed.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-widest text-red-300 mb-1">Failed (not received)</p>
                  {failed.map((r) => (
                    <Row key={r.id} r={r} amount={r.offered} note={r.error} />
                  ))}
                </div>
              )}
              <p className="text-xs opacity-60 mt-3">
                A tip counts only after this browser swaps it at the mint (NUT-03). Checked every minute while this page is open.
              </p>
            </Panel>

            {embed && (
              <Panel title="Your tip button">
                <CopyRow label="Script tag (paste in your site's HTML)" value={embed.script} />
                <CopyRow label="Or a link / iframe URL" value={embed.url} />
                <a href={embed.url} target="_blank" rel="noreferrer" className="text-sm text-[#4ff4c6] underline">
                  Preview →
                </a>
              </Panel>
            )}

            <Panel title="Mint settings" right={!editing && <button className={ghostCls} onClick={() => setEditing(true)}>Edit</button>}>
              {editing ? (
                <SettingsForm initial={config} onSave={updateConfig} />
              ) : (
                <div className="text-sm space-y-1">
                  {config.mints.map((m) => (
                    <p key={m} className="break-all">
                      {m} {!isKnownMint(m) && <span className="text-yellow-200">⚠️ not in the known list</span>}
                    </p>
                  ))}
                  <p className="opacity-80">Amount: {config.amount ? `${config.amount} sats` : "any"}</p>
                  <p className="opacity-80 break-all">Receiving key: {config.npub}</p>
                </div>
              )}
            </Panel>

            <Panel title="Backup & export">
              <p className="text-sm opacity-80 mb-3">
                Your receiving key is the only way to claim tips that are still in flight. Not needed to start, but keep a copy
                somewhere safe.
              </p>
              <div className="flex flex-wrap gap-2">
                <button className={ghostCls} onClick={() => setShowNsec((s) => !s)}>
                  {showNsec ? "Hide key" : "Show receiving key"}
                </button>
                <button className={ghostCls} onClick={exportSealed}>
                  Download sealed export
                </button>
              </div>
              {showNsec && <CopyRow label="nsec (secret, do not share)" value={nsecEncode(fromHex(skHex))} />}
              <p className="text-xs opacity-60 mt-3">
                The export is an encrypted, read-only copy of your proofs and key. It does not move or remove anything.
              </p>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}

function Row({ r, amount, note }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm">{r.memo ? `“${r.memo}”` : <span className="opacity-60">No note</span>}</p>
        <p className="text-xs opacity-60">
          {fmtTime(r.receivedAt || r.createdAt)} · {r.mint.replace(/^https?:\/\//, "")}
          {note ? ` · ${note}` : ""}
        </p>
      </div>
      <span className="font-mono shrink-0">{amount ?? "?"} sat</span>
    </div>
  );
}
