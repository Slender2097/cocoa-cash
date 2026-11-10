# cocoa.cash

A Cashu wallet that runs in the browser. Most Cashu wallets put Lightning next to Cashu on the home screen, which makes them feel complicated. This one does not: the main screen is Cashu only.

## The main screen

- **Send** creates a Cashu token from your balance.
- **Claim** receives a Cashu token into your balance.

Lightning is one tap away: the doorway glyph at the top right opens **Lightning in / out**, which holds Mint (pay an invoice to get ecash) and Melt (pay an invoice with ecash).

The other header glyphs open Mints, History, and the Seed vault.

## Non-custodial

- Proofs stay in the user's browser, in `localStorage` for this origin. The server never sees them and never holds a balance.
- Every operation that changes proofs is written to a write-ahead journal first (`src/lib/cashu/journal.ts`) and recovered with NUT-07 and NUT-09 if a mint reply is lost.
- The app is a static Next.js site. There is no backend, database or environment variable to set. Mints are called directly from the browser.

Clearing site data deletes the wallet. Users back up their balance from the Seed vault as Cashu tokens.

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
src/pages/            Routes
src/components/       Wallet screen, sheets and glyphs; ui primitives
src/hooks/            useCashu, useProofStorage
src/lib/cashu/        Proof storage, journal, cross-tab lock
```

TypeScript, Next.js (pages router), Tailwind, `@cashu/cashu-ts` v4. MIT licensed.
