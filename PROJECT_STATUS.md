# DeFiFolio Builder Project Status

**Reviewed:** 2026-08-17
**Status:** Live, ready for community testing — full wallet-authenticated permanent-link system on PHPCoin mainnet
**Repository:** `https://github.com/phpcoinn/defifolio-builder`
**Live app:** `https://defifolio.dap.ad` (frontend and backend both deployed and verified)

## Purpose

DeFiFolio Builder is a React-based no-code portfolio builder. Users can create a crypto identity page, preview it, save drafts locally, export a self-contained HTML file, and publish the generated page to IPFS — with PHPCoin wallet login turning their address into portable, permanent, cross-device profile storage.

Frontend and backend development happen directly in this repository (not Google AI Studio — see "Development Model" below). GitHub is the canonical history, and all trusted backend logic is built, reviewed, and deployed on PHPCoin-controlled infrastructure.

## Blockchain Profiles (Implemented, Live)

After publishing a portfolio to IPFS, a signed-in user can point a stable, permanent link at it by signing one PHPCoin `tx_data` transaction. Every future republish just requires signing a new transaction — the link itself never changes. Logging in on any device automatically offers to load the user's existing profile back into the editor — the PHPCoin address doubles as portable profile storage.

Live flow:

1. User builds a profile in DeFiFolio and clicks **Publish** — the HTML is uploaded to IPFS via the public `upload.ipfs.phpcoin.net` free-upload endpoint (unauthenticated, ≤10MB, not pinned).
2. User signs in with PHPCoin from the header **Login** button (wallet-connect popup, challenge/signature auth — see `server/lib/WalletAuth.php`).
3. On login, the app checks on-chain for an existing `defifolio` publish record for that address (`findTxData`) and, if found, fetches the profile HTML (proxied through `api.php?q=fetch_profile_html` — the IPFS gateway's CORS policy doesn't allow direct browser fetches from this origin) and offers to load it, with explicit confirmation before ever overwriting local edits.
4. The header shows the connected address (with a separate logout button) and, once signed in, a status of the on-chain link (up to date / stale / none yet).
5. **Save Changes** (shown whenever there are unsaved edits while signed in) does the whole flow in one click: publish to IPFS → sign a `tx_data` transaction with the new CID → submit — entirely client-side (`services/txData.ts`, byte-verified against the real node's `Transaction::getSignatureBase()`), no backend involved in the signing/submission step.
6. `defifolio.dap.ad/p/<address>` (`server/public/p.php`) resolves the newest `defifolio` publish event for that address via `findTxData` and proxies the profile content through, so the URL stays constant across every future republish.
7. A cron worker (`server/cli/pin_sync.php`, running every minute on the IPFS host) reads the chain directly via a locally-mounted PHPCoin node (no HTTP API), pins the newest CID per address, and unpins the previous one — keeping the linked content actually durable, not just the pointer.

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
  - Frontend build (`npm run build` with `VITE_BACKEND_URL=https://defifolio.dap.ad`) → `server/public/` alongside the backend.
- Secrets, private keys, and trusted validation stay out of frontend code; wallet signing happens entirely client-side via the wallet's own popup — the private key never reaches any DeFiFolio-controlled server.
- The Gemini API key lives in a local, non-committed key file on the server (`server/lib/gemini_api_key.txt`), not the shared PHP-FPM pool config that every vhost on the host uses.
- Deployment rule: the routine build-and-deploy-to-`defifolio.dap.ad` cycle happens automatically after each relevant change (the user tests against the live site, not locally). Anything new/higher-risk — new servers, new infrastructure, destructive operations, shared config affecting other vhosts — still requires explicit approval first.

## Current Functionality

- React/TypeScript portfolio editor and responsive preview, with light/dark theme support.
- Identity, wallet-address, social-link, image, and theme customization.
- Default profile now includes a PHPCoin wallet entry.
- Browser `localStorage` draft persistence, with unsaved-changes tracking.
- Import (hardened validation) and export of generated portfolio HTML.
- Generated pages embed profile data for later re-import.
- AI-generated biography and portfolio analysis (manual trigger, no longer automatic) via a locally-run PHP backend that proxies to Gemini.
- IPFS publishing through the live public `upload.ipfs.phpcoin.net` free-upload endpoint.
- **PHPCoin wallet login** (challenge/signature auth, session-based), header Login/logout, address shown as a badge with a separate logout button.
- **Cross-device profile loading**: logging in checks the chain for an existing profile and offers to load it (with confirmation).
- **Permanent link publishing**: client-side `tx_data` transaction build/sign/submit, no backend involvement in signing.
- **Save Changes**: one button that publishes and re-signs the permanent link together, shown only when there are unsaved edits.
- **Public profile router** live at `defifolio.dap.ad/p/<address>`.
- **IPFS pin/unpin sync worker**, live, cron'd every minute.
- dap.ad custom-domain promotion (paid tier, external product) shown after publish, pointing at `https://dap.ad`.

## Repository State

- `server/` is organized as `public/` (web-exposed: `api.php`, `p.php`) and `lib/` (not web-accessible: `WalletAuth.php`, `PhpCoinAddress.php`, `rate_limit.php`, `gemini_api_key.txt`), plus `cli/` (`pin_sync.php`, deployed separately to the IPFS host).
- `backend/api.php` (old, empty, pre-existing) is now superseded by `server/` and can likely be removed in a future cleanup pass.
- `PROJECT_CONTEXT.md` has been reconciled with this file as part of this update.

## Verification

- `npm run build`: passes.
- `npm run lint`: still fails — no ESLint configuration (unchanged from before this session).
- No automated tests exist.
- Wallet login, cross-device profile loading, tx_data signing/submission, `/p/<address>` resolution, and IPFS pin/unpin have all been verified against live mainnet infrastructure with real transactions (not just locally).
- `services/txData.ts`'s canonical signature-base construction was verified byte-for-byte identical to the real node's `Transaction::getSignatureBase()` via side-by-side PHP/JS comparison.
- Full live health check (homepage, wallet session/challenge, IPFS publish, `/p/<address>` hit and miss, AI bio generation, `lib/` inaccessibility) passed immediately before opening this up for community testing.

## Main Risks — Resolved This Session

1. ~~Generated HTML directly interpolates user-controlled values without escaping.~~ Fixed: `generateHtml()` now escapes all user text, validates colors/URLs, and uses `data-*` attributes instead of string-built `onclick` handlers.
2. ~~Embedded profile JSON can be broken out of its script tag.~~ Fixed: `</script>` sequences are escaped before embedding.
3. ~~Public backend allows cross-origin access from any origin, no auth.~~ Improved: CORS restricted to an explicit origin allowlist; per-IP rate limiting added to all costly actions. (Wallet actions now have real signature-based auth; AI/publish actions are still unauthenticated by design — matches the "free tier" product intent.)
4. ~~AI portfolio analysis runs automatically.~~ Fixed: now a manual "Run AI Vibe Check" button.
5. ~~Live backend source is missing locally.~~ Fixed: full backend now lives in this repo (`server/`) and is the deployed source of truth.
6. ~~No client-side image size limits.~~ Fixed: avatar/cover uploads capped at 2MB.
7. ~~Imported profile files receive only minimal validation.~~ Fixed: full type/size/array-length validation in `validateImportedProfile()`.
8. Exported pages still depend on the third-party Tailwind CDN and a third-party QR-code service — **intentionally left as-is** (explicit product decision, not an oversight).
9. A hardcoded Gemini API key was found in the original `ipfs-uploader` source this project's backend was ported from; removed from this repo's copy (local key file, not shared pool config), but the original key at the source should be rotated if it hasn't been already.

## Known Gaps / Future Improvements

- `p.php` has no caching (documented in-code as a TODO: Redis or APCu, short TTL, if this route gets busy).
- `p.php` only supports exact address matches; partial/prefix address support (e.g. `/p/Pbv3LdEUr55QfA`) is noted as a future improvement, contingent on unambiguous prefix matching.
- `npm run lint` has no ESLint config.
- `@google/genai` and `recharts` are installed but unused by frontend source.
- No automated tests.
- dap.ad's paid-name tier doesn't yet auto-follow the latest publish for a given address — that needs a "follow mode" on `dapad-v2`'s own side, a separate project not addressed here.

## Recommendation

This is no longer just a vibe-coded proof of concept — the full wallet-auth, cross-device profile storage, and blockchain-permanent-link system is live on mainnet with real, verified transactions, and the app is ready for community testing.

## Future Tasks

1. Gather community testing feedback and iterate.
2. Set up ESLint and resolve the dependency audit backlog.
3. Decide whether to build the exported-page self-containment work (dropping the Tailwind CDN / QR-service dependencies) or continue deferring it.
4. Consider `p.php` caching and partial-address support once/if traffic warrants it.
5. Clean up the now-superseded empty `backend/api.php`.
6. Write promotional/announcement content once the developer is ready.
7. Consider the dap.ad "follow mode" integration as a separate project.
