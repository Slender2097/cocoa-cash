# cocoa.cash

A non-custodial Cashu wallet that runs in your browser. Your proofs are kept in this browser's `localStorage`, and the server never holds your balance. The full wallet at `/` does Mint, Melt, Create Token (Send) and Claim Token.

## Tip button (embed)

You can add a Cashu tip or donate button to any web page. Visitors pay with Lightning or a Cashu token, and the sats land in **your** browser wallet.

### 1. Create your button (one minute, no account)

Open **https://cocoa.cash/creator** and set:

- **Mint:** one mint URL, or a short list separated by commas. You'll see a warning if a mint isn't in the built-in list.
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

### How it works (protocol)

Nothing here is custom. Everything is defined by a Cashu NUT or a Nostr NIP:

- **Delivery: NUT-18 payment requests over the Nostr transport.** The visitor's browser sends a NUT-18 payload `{mint, unit, proofs, memo}` as a NIP-17 private DM (NIP-59 gift wrap, NIP-44 encryption) to your `npub`, using a throwaway sender key. The widget also shows a `creqA` NUT-18 request, so any Cashu wallet that supports NUT-18 can pay directly.
- **Lightning:** a NUT-04 bolt11 mint quote at your mint. The new outputs are locked to your key with NUT-11 P2PK, so not even the visitor can spend them on the way to you. The blinding data is saved before the mint call. If the reply is lost, the same outputs are recovered with NUT-09 restore.
- **Pasted or scanned token:** forwarded unchanged as a NUT-18 payload. NUT-07 is used only to reject a token that is already spent.
- **Finality:** a tip counts as received **only** when your browser completes a NUT-03 swap of the delivered proofs and unblinds the new outputs. The outputs are saved before the swap request. If the reply is lost, NUT-07 shows the inputs are spent and NUT-09 restore recovers the outputs. If NUT-09 returns nothing, someone else spent the token first, and it's marked failed. A NUT-07 state is never treated as a payment.
- **Custody:** cocoa.cash has no server component for tips. The relays only see encrypted gift wraps. The mint is the only custodian, as with any Cashu mint.

The code is in `src/lib/tip/`, `src/pages/tip.jsx`, `src/pages/creator.jsx` and `public/tip.js`.

## Development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The tip widget is at `/tip` and the creator board is at `/creator`.
