# cocoa.cash

A simple Cashu wallet that runs in the browser. The main screen is Cashu only.

## The main screen

- **Send** (Ecash out) creates a Cashu token from your balance.
- **Receive** (Ecash in) claims a Cashu token into your balance.

Lightning is one tap away: the Lightning glyph in the header opens **Lightning in / out**, with Mint (pay an invoice to get ecash) and Melt (pay an invoice with ecash).

The other header glyphs open Mints, History and the Seed vault. The Mints screen has a **?** that opens a short prompt about choosing mints, ready to copy into an AI.

## Non-custodial

- Proofs stay in the browser, in `localStorage` for this origin. The server never sees them and never holds a balance.
- Every operation that changes proofs is written to a write-ahead journal first (`src/lib/cashu/journal.ts`) and recovered if a mint reply is lost.
- No backend: the app is a static Next.js site with no database or environment variables. Mints are called directly from the browser.

## Backup

- The 12 words in the Seed vault restore sats received after the NUT-13 change. After the first receive, a one-time card shows the 12 words.
- **Back up balance** in the Seed vault exports Cashu tokens for older sats, which the 12 words cannot restore.
- Clearing site data deletes the wallet.

## NUTs used

NUT-03 swap, NUT-04 mint, NUT-05 melt, NUT-07 check, NUT-08 melt change, NUT-09 restore, NUT-13 deterministic secrets, NUT-16 animated QR.

## Deploy

```bash
npm install
npm run build
npm start          # serves on port 3000
```

Or import the repository into Vercel (or any Next.js host) with the default settings. Security headers, including the CSP that keeps the wallet pages from being framed, are set in `next.config.ts`. Serve it over HTTPS: the browser needs a secure context for the camera (QR scanning) and the Web Locks used between tabs.

## Run locally

Requires Node.js 20 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck && npm run lint && npm run build
```

Routes: `/` wallet, `/privacy`, `/terms`.

## Project layout

```
src/pages/              Routes
src/components/wallet/  Main screen, sheets, panels, glyphs, seed and mint cards
src/components/ui/      QR plate, copy button, small primitives
src/hooks/              useCashu, useProofStorage, UI hooks
src/lib/cashu/          Proof storage, journal, cross-tab lock, seed, restore
```

TypeScript, Next.js (pages router), Tailwind, `@cashu/cashu-ts` v4. MIT licensed.
