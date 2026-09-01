# DeFiFolio Builder Project Status

**Reviewed:** 2026-08-17
**Status:** Working proof of concept with a live, wallet-authenticated permanent-link system on PHPCoin mainnet
**Repository:** `https://github.com/phpcoinn/defifolio-builder`
**Live app:** `https://defifolio.dap.ad` (backend deployed; frontend build not deployed yet)

## Purpose

DeFiFolio Builder is a React-based no-code portfolio builder. Users can create a crypto identity page, preview it, save drafts locally, export a self-contained HTML file, and publish the generated page to IPFS.

Frontend and backend development now happen directly in this repository (not Google AI Studio — see "Development Model" below). GitHub is the canonical history, and all trusted backend logic is built, reviewed, and deployed on PHPCoin-controlled infrastructure.

## Blockchain Profiles (Implemented)

After publishing a portfolio to IPFS, a signed-in user can point a stable, permanent link at it by signing one PHPCoin `tx_data` transaction. Every future republish just requires signing a new transaction — the link itself never changes.

Live flow:

1. User builds a profile in DeFiFolio and clicks Publish — the HTML is uploaded to IPFS via the public `upload.ipfs.phpcoin.net` free-upload endpoint (unauthenticated, ≤10MB, not pinned).
2. User optionally signs in with PHPCoin (wallet-connect popup, challenge/signature auth — see `server/lib/WalletAuth.php`).
3. Once signed in, the app checks on-chain whether this address already has a `defifolio` publish record (`findTxData`) and shows its status (up to date / stale / none yet).
4. Clicking "Get Permanent Link" (or "Update to This Publish") builds an unsigned `tx_data` transaction and its canonical signature base **entirely client-side** (`services/txData.ts`, byte-verified against the real node's `Transaction::getSignatureBase()`), sends it to the wallet popup for signing, then submits the signed transaction directly to the PHPCoin node's public API (`sendTransactionJson`) — no backend involved in this step at all.
5. `defifolio.dap.ad/p/<address>` (`server/public/p.php`) resolves the newest `defifolio` publish event for that address via `findTxData` and proxies the profile content through, so the URL stays constant across every future republish.
6. A cron worker (`server/cli/pin_sync.php`, running every minute on the IPFS host) reads the chain directly via a locally-mounted PHPCoin node (no HTTP API), pins the newest CID per address, and unpins the previous one — keeping the linked content actually durable, not just the pointer.

### Actual `tx_data` Payload

Simpler than originally proposed — deliberately minimal:

```json
{
  "app": "defifolio",
  "action": "publish",
  "string1": "<ipfs-cid>",
  "int1": 1
}
```

- `app`/`action`: fixed, used for `findTxData` filtering.
- `string1`: the IPFS CID of the published profile.
- `int1`: profile schema version (currently `1`).
- No `address1` — the transaction's own `src` (the signer's address) is what `/p/<address>` filters on; adding it would have been redundant.
- No `json_data` profile snapshot — the CID is already the canonical source of the profile content, so duplicating it on-chain wasn't worth the extra size/complexity.

### Resolution Rules (as implemented)

- `findTxData?app=defifolio&action=publish&src=<address>&limit=1`, ordered by block height descending, defines "the current profile" for that address.
- The router (`p.php`) validates the address checksum before querying anything, and 404s cleanly for invalid or never-published addresses.
- No caching yet (noted as a future improvement — see below).
- Free/anonymous publishes are unpinned and may eventually be garbage-collected; only addresses with a signed `tx_data` record get their content kept pinned by the sync worker.

### Chain/Network

- Mainnet (`CHAIN_ID "00"`), node `https://main1.phpcoin.net`.
- Transaction fee: `1 PHP` (`TX_DATA_FEE`), paid by the signing user via the wallet.
- `dst` must be a valid address different from the signer (`TX_TYPE_DATA` validation requires this even though `val=0`) — points at a dedicated DeFiFolio service address, configured via `VITE_DEFIFOLIO_SERVICE_ADDRESS`.

## Development Model

- Active development happens in this local repository, not Google AI Studio (security gaps in that workflow — see memory `project_dev_location`).
- GitHub remains the canonical backup/review history.
- Backend PHP is deployed directly to PHPCoin-controlled infrastructure by the developer (no CI/CD pipeline yet):
  - `server/public/` + `server/lib/` → `phpcoin1` (`defifolio.dap.ad`), behind nginx + PHP-FPM.
  - `server/cli/pin_sync.php` → the IPFS host (`ipfs.phpcoin.net`), run via cron every minute.
- Secrets, private keys, and trusted validation stay out of frontend code; wallet signing happens entirely client-side via the wallet's own popup — the private key never reaches any DeFiFolio-controlled server.
- No deployment happens without explicit approval in-session (standing rule for this project).

## Current Functionality

- React/TypeScript portfolio editor and responsive preview, with light/dark theme support.
- Identity, wallet-address, social-link, image, and theme customization.
- Default profile now includes a PHPCoin wallet entry.
- Browser `localStorage` draft persistence.
- Import (hardened validation) and export of generated portfolio HTML.
- Generated pages embed profile data for later re-import.
- AI-generated biography and portfolio analysis (manual trigger, no longer automatic) via a locally-run PHP backend that proxies to Gemini.
- IPFS publishing through the live public `upload.ipfs.phpcoin.net` free-upload endpoint.
- **PHPCoin wallet login** (challenge/signature auth, session-based).
- **Permanent link publishing**: client-side `tx_data` transaction build/sign/submit, no backend involvement.
- **Public profile router** live at `defifolio.dap.ad/p/<address>`.
- **IPFS pin/unpin sync worker**, live, cron'd every minute.
- dap.ad custom-domain promotion (paid tier, external product) shown after publish, pointing at `https://dap.ad`.

## Repository State

- `server/` is organized as `public/` (web-exposed: `api.php`, `p.php`) and `lib/` (not web-accessible: `WalletAuth.php`, `PhpCoinAddress.php`, `rate_limit.php`), plus `cli/` (`pin_sync.php`, deployed separately to the IPFS host).
- `backend/api.php` (old, empty, pre-existing) is now superseded by `server/` and can likely be removed in a future cleanup pass.
- `PROJECT_CONTEXT.md` (architecture notes) predates this session's work and should be treated as partially stale until reconciled with this file.

## Verification

- `npm run build`: passes.
- `npm run lint`: still fails — no ESLint configuration (unchanged from before this session).
- No automated tests exist.
- Wallet login, tx_data signing/submission, `/p/<address>` resolution, and IPFS pin/unpin have all been verified against live mainnet infrastructure with real transactions (not just locally).
- `services/txData.ts`'s canonical signature-base construction was verified byte-for-byte identical to the real node's `Transaction::getSignatureBase()` via side-by-side PHP/JS comparison.

## Main Risks — Resolved This Session

1. ~~Generated HTML directly interpolates user-controlled values without escaping.~~ Fixed: `generateHtml()` now escapes all user text, validates colors/URLs, and uses `data-*` attributes instead of string-built `onclick` handlers.
2. ~~Embedded profile JSON can be broken out of its script tag.~~ Fixed: `</script>` sequences are escaped before embedding.
3. ~~Public backend allows cross-origin access from any origin, no auth.~~ Improved: CORS restricted to an explicit origin allowlist; per-IP rate limiting added to all costly actions. (Wallet actions now have real signature-based auth; AI/publish actions are still unauthenticated by design — matches the "free tier" product intent.)
4. ~~AI portfolio analysis runs automatically.~~ Fixed: now a manual "Run AI Vibe Check" button.
5. ~~Live backend source is missing locally.~~ Fixed: full backend now lives in this repo (`server/`) and is the deployed source of truth.
6. ~~No client-side image size limits.~~ Fixed: avatar/cover uploads capped at 2MB.
7. ~~Imported profile files receive only minimal validation.~~ Fixed: full type/size/array-length validation in `validateImportedProfile()`.
8. Exported pages still depend on the third-party Tailwind CDN and a third-party QR-code service — **intentionally left as-is** (explicit product decision, not an oversight).
9. **New, not yet fixed**: a hardcoded Gemini API key was found in the original `ipfs-uploader` source this project's backend was ported from; removed from this repo's copy (env-only now), but the original key should be rotated at the source if it hasn't been already.

## Known Gaps / Future Improvements

- Frontend build is not deployed to `defifolio.dap.ad` yet — only the backend (`api.php`, `p.php`) is live there.
- `p.php` has no caching (documented in-code as a TODO: Redis or APCu, short TTL, if this route gets busy).
- `p.php` only supports exact address matches; partial/prefix address support (e.g. `/p/Pbv3LdEUr55QfA`) is noted as a future improvement, contingent on unambiguous prefix matching.
- `npm run lint` has no ESLint config.
- `@google/genai` and `recharts` are installed but unused by frontend source.
- No automated tests.

## Recommendation

This is no longer just a vibe-coded proof of concept — the wallet-auth and blockchain-permanent-link system is live on mainnet with real, verified transactions. The remaining major step is deploying the actual frontend build to `defifolio.dap.ad` (currently only a placeholder page); the backend, routing, and pinning infrastructure are already production-ready and tested end to end.

## Future Tasks

1. Deploy the frontend build to `defifolio.dap.ad` (with explicit approval per this project's deployment rule).
2. Set up ESLint and resolve the dependency audit backlog.
3. Decide whether to build the exported-page self-containment work (dropping the Tailwind CDN / QR-service dependencies) or continue deferring it.
4. Consider `p.php` caching and partial-address support once/if traffic warrants it.
5. Clean up the now-superseded empty `backend/api.php`.
