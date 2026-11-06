// src/pages/creator.tsx
// Creator setup + admin board for the tip embed. Everything here lives in the
// creator's browser: the receiving key (sealed with their passphrase), the
// inbox of NUT-18 payloads, and the proofs (in the full wallet's store).
// There is no account, no server ledger, and no custody by cocoa.cash.
// MIT License

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import Cosmos from "@/components/wallet/Cosmos";
import { MintWarning } from "@/components/ui/MintWarning";
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
import { readProofs, sumProofs, rememberMint, requestPersistentStorage, toStoredProof, PROOFS_EVENT } from "@/lib/cashu/storage";
import type { ProofsByMint, StoredProof } from "@/lib/cashu/storage";
import { backupTokens } from "@/lib/cashu/backup";
import type { BackupToken } from "@/lib/cashu/backup";
import { mintLabel } from "@/lib/utils/mintLabel";
import { getWallet, toHex, fromHex, errText } from "@/lib/cashu/outputs";
import { INBOX, listInbox, syncInbox, claimAll } from "@/lib/tip/flows";
import type { InboxRecord } from "@/lib/tip/flows";
import type { Sealed } from "@/lib/tip/seal";

const CONFIG_KEY = "cocoaTip.config";
type TipConfig = {
  v: 1;
  mints: string[];
  amount: number | null;
  label: string;
  relays: string[];
  pubkey: string;
  npub: string;
  sealedKey: Sealed;
  createdAt: number;
};
type SettingsValues = { mints: string[]; amount: number | null; label: string; pass: string; nsec: string };

const fmtTime = (ms?: number) => (ms ? new Date(ms).toLocaleString() : "");

// Sealed data (the admin key here, an export file anywhere) can be attacked
// offline, so passphrases must be long. Existing shorter ones still unlock.
const MIN_PASSPHRASE = 12;
const passphraseError = (a: string, b: string): string | null =>
  a.length < MIN_PASSPHRASE
    ? `Pick a passphrase of at least ${MIN_PASSPHRASE} characters`
    : a !== b
      ? "Passphrases do not match"
      : null;

type TipExport = { kind?: string; exportedAt?: string; nsec?: string; proofsByMint?: Record<string, unknown[]> };

function loadConfig(): TipConfig | null {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
  } catch {
    return null;
  }
}
const saveConfig = (c: TipConfig) => localStorage.setItem(CONFIG_KEY, JSON.stringify(c));

function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="glass rounded-[2rem] p-5 mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-xs uppercase tracking-[3px] text-[#4ff4c6]">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs opacity-70">{label}</span>
        <button
          className="text-xs text-[#4ff4c6]"
          onClick={() =>
            navigator.clipboard.writeText(value).then(() => {
              setOk(true);
              setTimeout(() => setOk(false), 1500);
            })
          }
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
  "w-full bg-[#07110d]/65 border border-[#4ff4c6]/25 rounded-2xl outline-none focus:border-[#4ff4c6]/80 px-4 py-3 text-[#e8fff7] placeholder:text-[#e8fff7]/40";
const btnCls =
  "rounded-full px-6 py-3 font-semibold text-[#06120e] bg-gradient-to-r from-[#4ff4c6] to-[#a3ffe0] shadow-[0_0_30px_-10px_#a3ffe0] disabled:opacity-50";
const ghostCls = "rounded-full px-4 py-2 text-sm border border-[#4ff4c6]/35 bg-[#07110d]/40 hover:border-[#4ff4c6]";

// ----------------------------------------------------------------------------
// Settings form (used for first setup and for edits)
// ----------------------------------------------------------------------------
function SettingsForm({
  initial,
  isNew = false,
  onSave,
}: {
  initial?: TipConfig;
  isNew?: boolean;
  onSave: (v: SettingsValues) => Promise<void>;
}) {
  const [mints, setMints] = useState(initial?.mints?.join(", ") || "");
  const [amount, setAmount] = useState(initial?.amount ? String(initial.amount) : "");
  const [label, setLabel] = useState(initial?.label || "Tip");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [nsec, setNsec] = useState("");
  const [trust, setTrust] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mintList = mints.split(",").map(normalizeMint).filter(Boolean);
  const unknown = mintList.filter((m) => !isKnownMint(m));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!mintList.length) return setError("Add at least one mint");
    if (amount && !(parseInt(amount, 10) > 0)) return setError("Amount must be a positive number, or empty for any amount");
    if (unknown.length && !trust) return setError("Confirm that you trust the mint(s) not in the known list");
    if (isNew) {
      const passError = passphraseError(pass, pass2);
      if (passError) return setError(passError);
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
      {unknown.length > 0 && <MintWarning mints={unknown} context="tip" trusted={trust} onTrust={setTrust} />}
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
              Admin passphrase ({MIN_PASSPHRASE}+ characters)
              <input type="password" autoComplete="new-password" className={inputCls + " mt-2"} value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
            <label className="text-sm">
              Repeat passphrase
              <input type="password" autoComplete="new-password" className={inputCls + " mt-2"} value={pass2} onChange={(e) => setPass2(e.target.value)} />
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
  const [config, setConfig] = useState<TipConfig | null | undefined>(undefined); // undefined = loading
  const [skHex, setSkHex] = useState<string | null>(null);
  const [pass, setPass] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [showNsec, setShowNsec] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exPass, setExPass] = useState("");
  const [exPass2, setExPass2] = useState("");
  const [exError, setExError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://cocoa.cash");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from localStorage */
    setConfig(loadConfig());
    setOrigin(window.location.origin);
    /* eslint-enable react-hooks/set-state-in-effect */
    requestPersistentStorage(); // claimed tips land in this browser's proof store
    const bump = () => setTick((t) => t + 1);
    const onStorage = (e: StorageEvent) => {
      if (e.key === "proofsByMint" || e.key === INBOX) bump();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(PROOFS_EVENT, bump);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(PROOFS_EVENT, bump);
    };
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
    sync(); // eslint-disable-line react-hooks/set-state-in-effect -- first check right after unlock
    const id = setInterval(sync, 60000);
    return () => clearInterval(id);
  }, [skHex]); // eslint-disable-line react-hooks/exhaustive-deps

  const inbox: InboxRecord[] = useMemo(() => (typeof window === "undefined" ? [] : listInbox()), [tick, skHex]); // eslint-disable-line
  const balances = useMemo(() => {
    if (typeof window === "undefined") return [];
    const all = readProofs();
    const keys = new Set([...Object.keys(all), ...(config?.mints || []).map(walletMintKey)]);
    return [...keys]
      .map((k) => ({ mint: normalizeMint(k), sats: sumProofs(all[k]), configured: (config?.mints || []).some((m) => walletMintKey(m) === k) }))
      .filter((b) => b.sats > 0 || b.configured);
  }, [tick, config]); // eslint-disable-line

  const createConfig = async ({ mints, amount, label, pass: pp, nsec }: SettingsValues) => {
    const sk = nsec ? nsecDecode(nsec) : generateSecretKey();
    const pubkey = getPublicKey(sk);
    const next: TipConfig = {
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

  const updateConfig = async ({ mints, amount, label }: SettingsValues) => {
    if (!config) return;
    const next: TipConfig = { ...config, mints, amount, label };
    saveConfig(next);
    mints.forEach(rememberMint);
    setConfig(next);
    setEditing(false);
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    if (!config) return;
    try {
      const { sk } = await unseal<{ sk: string }>(config.sealedKey, pass);
      setSkHex(sk);
      setPass("");
    } catch {
      setUnlockError("Wrong passphrase");
    }
  };

  // Read-only sealed export: a copy of the proofs and the receiving key,
  // encrypted with a passphrase typed twice. Nothing is removed from the wallet.
  // "Open a sealed export" below turns it back into tokens to Claim.
  const exportSealed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skHex) return;
    const passError = passphraseError(exPass, exPass2);
    if (passError) return setExError(passError);
    setExError(null);
    const pp = exPass;
    const box = await seal(
      {
        kind: "cocoa-tip-export",
        exportedAt: new Date().toISOString(),
        nsec: nsecEncode(fromHex(skHex)),
        proofsByMint: readProofs(),
      },
      pp
    );
    const blob = new Blob([JSON.stringify(box, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cocoa-tips-sealed-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    setExPass("");
    setExPass2("");
    setExportOpen(false);
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
      <Cosmos />
      <div className="max-w-2xl mx-auto px-4 py-8 text-[#e8fff7]">
        <div className="flex items-center justify-between mb-6">
          <h1 className="flex items-center gap-3 text-2xl font-light tracking-wide">
            <Image src="/jaguar-logo.png" alt="" width={48} height={36} className="drop-shadow-[0_0_12px_rgba(79,244,198,0.7)]" />
            Tip board
          </h1>
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
                <button className={ghostCls} onClick={() => setExportOpen((o) => !o)}>
                  Download sealed export
                </button>
              </div>
              {showNsec && <CopyRow label="nsec (secret, do not share)" value={nsecEncode(fromHex(skHex))} />}
              {exportOpen && (
                <form onSubmit={exportSealed} className="mt-3 flex flex-col gap-3" data-testid="export-form">
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputCls}
                    value={exPass}
                    onChange={(e) => setExPass(e.target.value)}
                    placeholder={`Export passphrase (${MIN_PASSPHRASE}+ characters)`}
                    aria-label="Export passphrase"
                  />
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={inputCls}
                    value={exPass2}
                    onChange={(e) => setExPass2(e.target.value)}
                    placeholder="Repeat passphrase"
                    aria-label="Repeat export passphrase"
                  />
                  {exError && <p className="text-sm text-red-300">{exError}</p>}
                  <button className={btnCls}>Seal and download</button>
                </form>
              )}
              <p className="text-xs opacity-60 mt-3">
                The export is an encrypted, read-only copy of your proofs and key. It does not move or remove anything. Anyone
                with the file and its passphrase can spend those sats.
              </p>
            </Panel>
          </>
        )}
        {config !== undefined && <OpenExport />}
      </div>
    </>
  );
}

// ----------------------------------------------------------------------------
// Open a sealed export: unseal it here, then Claim each mint's token in the
// full wallet (NUT-03 swap). Proofs spent since the export are skipped there
// (NUT-07). Nothing is claimed or stored by this panel itself.
// ----------------------------------------------------------------------------
function OpenExport() {
  const [file, setFile] = useState<File | null>(null);
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<{ exportedAt?: string; nsec: string; tokens: BackupToken[] } | null>(null);
  const [showKey, setShowKey] = useState(false);

  const open = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Choose the .json file from Download sealed export");
    let box: Sealed;
    try {
      box = JSON.parse(await file.text());
      if (!box || box.v !== 1 || !box.salt || !box.iv || !box.data) throw new Error("not a sealed file");
    } catch {
      return setError("This is not a sealed export file");
    }
    let data: TipExport;
    try {
      data = await unseal<TipExport>(box, pass);
    } catch {
      return setError("Wrong passphrase");
    }
    if (data?.kind !== "cocoa-tip-export") return setError("This file is not a cocoa.cash tip export");
    const proofsByMint: ProofsByMint = {};
    for (const [mint, list] of Object.entries(data.proofsByMint || {})) {
      proofsByMint[mint] = (Array.isArray(list) ? list : [])
        .map((p) => toStoredProof(p as StoredProof))
        .filter((p): p is StoredProof => !!p);
    }
    setOpened({ exportedAt: data.exportedAt, nsec: data.nsec || "", tokens: backupTokens(proofsByMint) });
    setPass("");
    setShowKey(false);
  };

  return (
    <Panel title="Open a sealed export">
      {!opened ? (
        <form onSubmit={open} className="flex flex-col gap-3" data-testid="open-export">
          <p className="text-sm opacity-80">
            Read a file from Download sealed export, for example on a new browser. You get its sats as tokens to Claim and its
            receiving key.
          </p>
          <input
            type="file"
            accept="application/json,.json"
            className="text-sm"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            aria-label="Sealed export file"
          />
          <input
            type="password"
            autoComplete="off"
            className={inputCls}
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Export passphrase"
            aria-label="Export passphrase to open the file"
          />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button className={btnCls}>Open export</button>
        </form>
      ) : (
        <div data-testid="opened-export">
          <p className="text-sm opacity-80 mb-3">
            {opened.exportedAt ? `Exported ${fmtTime(Date.parse(opened.exportedAt))}. ` : ""}Paste each token into Claim in the{" "}
            <Link href="/" className="text-[#4ff4c6] underline">
              full wallet
            </Link>
            . Sats spent since the export are skipped there.
          </p>
          {opened.tokens.length === 0 && <p className="text-sm opacity-70 mb-3">No sats in this export.</p>}
          {opened.tokens.map((t) =>
            t.token ? (
              <CopyRow key={t.mint} label={`${mintLabel(t.mint)} · ${t.amount} sat`} value={t.token} />
            ) : (
              <p key={t.mint} className="text-sm text-yellow-200 mb-3">
                {mintLabel(t.mint)} · {t.amount} sat: could not make a token ({t.error}).
              </p>
            )
          )}
          <div className="flex flex-wrap gap-2">
            {opened.nsec && (
              <button className={ghostCls} onClick={() => setShowKey((s) => !s)}>
                {showKey ? "Hide receiving key" : "Show receiving key"}
              </button>
            )}
            <button className={ghostCls} onClick={() => setOpened(null)}>
              Close
            </button>
          </div>
          {showKey && opened.nsec && (
            <div className="mt-3">
              <CopyRow label="nsec (secret, do not share)" value={opened.nsec} />
              <p className="text-xs opacity-70">
                To keep receiving tips with this key here, paste it under &quot;I already have a receiving key&quot; when you
                create the tip button.
              </p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function Row({ r, amount, note }: { r: InboxRecord; amount?: number; note?: string | null }) {
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
