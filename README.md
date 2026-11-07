# cocoa.cash

A non-custodial Cashu wallet that runs in your browser. Your proofs are kept in this browser's `localStorage`, and the server never holds your balance. The full wallet at `/` does Mint, Melt, Create Token (Send) and Claim Token.

## Tip button (embed)

You can add a Cashu tip or donate button to any web page. Visitors pay with Lightning or a Cashu token, and the sats land in **your** browser wallet.

### 1. Create your button (one minute, no account)

Open **https://cocoa.cash/creator** and set:

- **Mint:** one mint URL, or a short list separated by commas. Any Cashu mint works; cocoa.cash doesn't suggest one. You'll be asked to confirm you trust any mint that isn't already in your mints list.
- **Amount:** a fixed number of sats, or leave it empty so visitors choose.
- **Passphrase:** locks the board in this browser. cocoa.cash never sees it.

The page creates a receiving key in your browser and gives you the snippet.

### 2. Paste one of these on your site

```html
<script src="https://cocoa.cash/tip.js"
        data-mint="https://mint.example.com"
        data-amount="21"
        data-npub="npub1..."></script>
```

You can also use a plain link or iframe:

```html
<iframe src="https://cocoa.cash/tip?mint=https://mint.example.com&amount=21&npub=npub1..."
        width="360" height="560" style="border:0" allow="clipboard-write; camera"></iframe>
```

| Param | Required | Meaning |
|---|---|---|
| `mint` | yes | Mint URL, or several separated by commas (allowlist). The first one is used for Lightning. |
| `amount` | yes | Sats, or `any` |
| `npub` | yes | Your receiving key from `/creator` |
| `label` | no | Button text: `Tip` (default) or `Donate` |
| `relays` | no | Comma-separated `wss://` relays (defaults: damus, nos.lol, primal) |

### 3. Collect tips

Open `/creator` in the **same browser** and unlock it. The board checks for new tips every minute while it's open. It shows your balance per mint, received tips (amount, time, note), anything pending or failed, and your mint settings. The sats are ordinary proofs in the full wallet, so you can melt or send them from `/`.

**Back up your receiving key.** Use "Show receiving key" on the board. You don't need a backup to start receiving, but without one, tips that are still in flight can't be claimed if this browser's data is lost. You can restore the key on a new browser during setup.

**Sealed export.** "Download sealed export" saves an encrypted copy of your proofs and receiving key (PBKDF2-SHA256 + AES-GCM, passphrase of 12+ characters, typed twice). To use it, open `/creator` in any browser and use **Open a sealed export**: it unseals the file in the page and shows one Cashu token per mint to paste into Claim in the full wallet, plus the receiving key. Anyone with the file and its passphrase can spend those sats.

### How it works (protocol)

Nothing here is custom. Everything is defined by a Cashu NUT or a Nostr NIP:

- **Delivery: NUT-18 payment requests over the Nostr transport.** The visitor's browser sends a NUT-18 payload `{mint, unit, proofs, memo}` as a NIP-17 private DM (NIP-59 gift wrap, NIP-44 encryption) to your `npub`, using a throwaway sender key. The widget also shows a `creqA` NUT-18 request, so any Cashu wallet that supports NUT-18 can pay directly.
- **Lightning:** a NUT-04 bolt11 mint quote at your mint. The new outputs are locked to your key with NUT-11 P2PK, so not even the visitor can spend them on the way to you. The blinding data is saved before the mint call. If the reply is lost, the same outputs are recovered with NUT-09 restore.
- **Pasted or scanned token:** forwarded unchanged as a NUT-18 payload. NUT-07 is used only to reject a token that is already spent.
- **Finality:** a tip counts as received **only** when your browser completes a NUT-03 swap of the delivered proofs and unblinds the new outputs. The outputs are saved before the swap request. If the reply is lost, NUT-07 shows the inputs are spent and NUT-09 restore recovers the outputs. If NUT-09 returns nothing, someone else spent the token first, and it's marked failed. A NUT-07 state is never treated as a payment.
- **Custody:** cocoa.cash has no server component for tips. The relays only see encrypted gift wraps. The mint is the only custodian, as with any Cashu mint.

The tip code is in `src/lib/tip/`, `src/pages/tip.tsx`, `src/pages/creator.tsx` and `public/tip.js`.

## Wallet safety (all operations)

The full wallet and the tip board share the same write-ahead journal in `src/lib/cashu/journal.ts`:

| Operation | NUTs | Written before the mint call | Recovery after a lost reply |
|---|---|---|---|
| Mint | NUT-04 | quote, then blinded outputs | NUT-09 restore of those outputs |
| Melt | NUT-05, NUT-08 | inputs (reserved, not spendable) + change outputs | NUT-05 quote state: PAID → NUT-09 change, UNPAID → inputs back after NUT-07 shows them UNSPENT, PENDING → wait |
| Send (create token) | NUT-03 | inputs + keep/send outputs | NUT-09 restore. The token is saved in History, so closing the tab can't lose it |
| Claim token / tip | NUT-03 (+ NUT-11) | token inputs + outputs | NUT-07 SPENT → NUT-09 restore. If NUT-09 returns nothing, the token was spent by someone else and is marked failed |

Open operations resume automatically when the wallet connects. Proofs are stored in `localStorage` and amounts are plain numbers. cashu-ts v4 `Amount` objects are converted in one place: `src/lib/cashu/storage.ts`.

Every operation that changes proofs or the journal runs under one cross-tab Web Lock (`src/lib/cashu/lock.ts`), so two open tabs take turns instead of overwriting each other's writes.

### Backups

Your sats are the proofs in this browser. The 12-word phrase in the Seed vault does **not** restore them yet (NUT-13 deterministic secrets are not implemented). To keep a copy:

- **Seed vault → Back up balance** shows each mint's proofs as one standard Cashu token (NUT-00) to copy or download. To restore, paste a token into Claim here or in any Cashu wallet. A backup is a snapshot: Claim skips proofs the mint reports as already spent (NUT-07) and keeps the rest.
- The wallet asks the browser for persistent storage (`navigator.storage.persist()`), so it is less likely to be cleared under storage pressure. Clearing site data still deletes everything.

## Development

TypeScript (strict), Next.js, Tailwind, `@cashu/cashu-ts` v4.

```bash
npm install
npm run dev
npm run typecheck && npm run lint && npm run build
```

Open http://localhost:3000. The tip widget is at `/tip` and the creator board is at `/creator`.

### Project structure

```
src/
  pages/              Routes (pages router): / wallet, /creator, /tip, /privacy, /terms
  components/
    wallet/           Wallet screens and sheets (BalanceCore, Orbs, FlowSheet, SeedVault, panels, glyphs)
    ui/               Small reusable primitives (CopyButton, QrPlate, Check)
  hooks/              useCashu, useProofStorage
  lib/
    cashu/            Proof storage, write-ahead journal, blinded output helpers
    tip/              Tip embed: config, NUT-18 transport, flows, passphrase seal
    utils/            Pure helpers (mintLabel)
  styles/             Global CSS (component CSS modules sit next to their component)
public/               Static assets and the tip.js embed
```

Shared types live next to the module that owns them (for example `ProofsByMint` in `lib/cashu/storage.ts`).
