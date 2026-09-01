# Project Context: DeFiFolio Builder

## 1. Project Overview
**DeFiFolio Builder** is a decentralized, no-code portfolio site generator for the Web3 ecosystem. It empowers users to create professional "Link-in-Bio" style portfolio pages containing their crypto identities (wallet addresses, social links, bio) — and, once signed in with a PHPCoin wallet, to publish those pages to a stable, permanent, cross-device-accessible link.

**Core Philosophy:**
1.  **Decentralized Output:** The final product is a single, self-contained `index.html` file that requires no backend database to run and can be hosted on IPFS.
2.  **State-in-File:** The configuration data (JSON) is embedded within the generated HTML, allowing the file to be re-imported into the builder later for editing.
3.  **Address-as-Storage:** A user's PHPCoin address, once they sign one on-chain transaction, becomes their portable profile identity — no separate account system, no central database of user profiles.
4.  **Privacy by Default:** Without signing in, drafts stay local to the browser (`localStorage`); nothing is tied to an identity unless the user explicitly signs a transaction.

---

## 2. Technology Stack

### Frontend (Builder)
*   **Framework:** React 18
*   **Build Tool:** Vite
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS (Configured via `tailwind.config.js` for dev, but the *Exported HTML* uses Tailwind CDN for portability).
*   **Icons:**
    *   **Builder:** `lucide-react`
    *   **Exported HTML:** Raw SVG strings (defined in `App.tsx`).
*   **State Management:** React `useState` + `localStorage` persistence.

### Backend (`server/`)
*   **Language:** PHP 8.1
*   **Location:** `server/public/` (web-exposed) + `server/lib/` (not web-accessible) → deployed to `phpcoin1` as `defifolio.dap.ad`, behind nginx + PHP-FPM.
*   **`server/public/api.php` endpoints** (`?q=<action>`):
    *   `generate_bio` / `analyze_portfolio`: proxy to Google Gemini AI.
    *   `publish_ipfs`: uploads exported HTML to the public `upload.ipfs.phpcoin.net` free-upload endpoint (unauthenticated, ≤10MB, unpinned).
    *   `fetch_profile_html`: proxies a profile HTML fetch from the IPFS gateway (needed because the gateway's CORS policy doesn't allow direct browser fetches from this origin).
    *   `authChallenge` / `walletLogin` / `authSession` / `authLogout`: PHPCoin wallet-connect login (challenge/signature auth, session-based) — see `server/lib/WalletAuth.php`.
*   **`server/public/p.php`**: the public profile router, `defifolio.dap.ad/p/<address>` — resolves the newest on-chain `defifolio` publish record for an address and proxies the profile content through.
*   **`server/lib/`**: `WalletAuth.php` (login logic), `PhpCoinAddress.php` (address checksum validation), `rate_limit.php` (shared per-IP rate limiting), `gemini_api_key.txt` (local, non-committed secret).
*   **`server/cli/pin_sync.php`**: a separate cron worker (deployed to the IPFS host, not `phpcoin1`) that pins the newest CID per address and unpins the previous one, reading the chain directly via a locally-mounted PHPCoin node.
*   **AI Engine:** Google Gemini 2.5 Flash.

---

## 3. Architecture & Workflows

### A. The Builder Workflow
1.  **Editor (Left Panel):** User inputs data (Identity, Wallets, Socials, Style).
2.  **Preview (Right Panel):** Real-time rendering of the portfolio. Supports "Desktop" and "Mobile" simulation modes.
3.  **Auto-Save:** `useEffect` hooks sync the `profile` state to `localStorage` key `defifolio_draft_v1`, and separately track whether there are unsaved edits (`hasUnsavedChanges`) since the last publish/load.

### B. The AI Integration
*   The frontend **does not** hold the API Key.
*   Requests are sent to the PHP backend.
*   **Format:** `POST` request with JSON body `{ profile: ... }` and query param `?q=action`.

### C. The Export Workflow (Self-Contained HTML)
*   **Function:** `generateHtml(UserProfile)` in `App.tsx`.
*   **Process:**
    1.  Constructs a standard HTML5 string, escaping all user-controlled fields (name, bio, urls, addresses, colors) and using `data-*` attributes instead of string-built `onclick` handlers to avoid injection.
    2.  Injects Tailwind CDN script (`<script src="https://cdn.tailwindcss.com"></script>`) — an accepted, deliberate dependency (see Known Gaps in `PROJECT_STATUS.md`).
    3.  Embeds images as **Base64 strings** (ensuring the file is single-source), capped at 2MB per image on upload.
    4.  Embeds the `UserProfile` JSON into a `<script id="defifolio-data" type="application/json">` tag, with `</script>` sequences escaped to prevent breaking out of the tag.
    5.  Injects vanilla JS for interactivity (copy to clipboard, QR code modal) into the output HTML.
    6.  Triggers a browser download of `index.html`.

### D. The Import Workflow
*   **Trigger:** "Import" button in the header.
*   **Process:**
    1.  User uploads a previously generated `index.html`.
    2.  `parseProfileFromHtml()` uses `DOMParser` to find the `<script id="defifolio-data">` tag and parses the JSON.
    3.  `validateImportedProfile()` type/size/array-length-validates the result before it's ever applied to state.
    4.  This same parser is reused by the wallet-based profile loading flow (E) — both paths start from a full exported HTML page.

### E. Publishing, Wallet Login, and Permanent Links
1.  **Publish** uploads the generated HTML to IPFS (`publish_ipfs`) and gets back a CID — this alone is anonymous and temporary (unpinned).
2.  **Login** (header button) opens the PHPCoin wallet-connect popup, completes challenge/signature auth, and establishes a session.
3.  On login, the app checks on-chain (`findLatestPublish` in `services/txData.ts`) whether this address already has a `defifolio` publish record, and — after explicit user confirmation — loads that saved profile via `fetch_profile_html` + `parseProfileFromHtml()`.
4.  **Get Permanent Link / Update to This Publish / Save Changes**: builds an unsigned `tx_data` transaction and its canonical signature base entirely client-side (`services/txData.ts`, verified byte-for-byte against the node's own `Transaction::getSignatureBase()`), sends it to the wallet popup for signing, then submits the signed transaction directly to the PHPCoin node's public API (`sendTransactionJson`) — no backend involvement in this step.
5.  `defifolio.dap.ad/p/<address>` always resolves to the latest signed CID for that address (see `server/public/p.php`), and `server/cli/pin_sync.php` keeps that content actually pinned/durable, not just pointed-to.

Full protocol details, the exact `tx_data` payload shape, and chain/network specifics live in `PROJECT_STATUS.md` — this file covers architecture and code organization, that one covers current live status.

---

## 4. Data Models (`types.ts`, `services/*.ts`)

### UserProfile
The master state object.
```typescript
interface UserProfile {
  name: string;
  title: string;
  bio: string;
  avatarUrl: string; // Base64 string or HTTPS URL
  coverImageUrl?: string; // Base64 string or HTTPS URL
  themeColor: string; // Hex code (e.g. #818cf8)
  backgroundColor: string; // Hex code (e.g. #0b1120)
  socials: SocialLink[];
  addresses: CryptoAddress[];
}
```

### SocialLink
```typescript
interface SocialLink {
  id: string;
  platform: 'x' | 'github' | 'telegram' | 'discord' | 'website';
  url: string;
}
```

### CryptoAddress
```typescript
interface CryptoAddress {
  id: string;
  network: string; // e.g., Ethereum
  address: string;
  label: string; // e.g., Main Vault
  color: string;
}
```

### WalletAccount (`services/walletApi.ts`)
```typescript
interface WalletAccount {
  address: string;
  public_key: string;
  login_at: string;
  auth_domain: string;
}
```

### PublishRecord (`services/txData.ts`)
```typescript
interface PublishRecord {
  txId: string;
  cid: string;
}
```

---

## 5. Key Configuration Constants

### `App.tsx`
*   `BACKEND_URL`: this app's own PHP backend base URL — `VITE_BACKEND_URL` env var, defaulting to `http://localhost:8034` for local dev.
*   `PUBLISH_API_URL`: `${BACKEND_URL}/api.php?q=publish_ipfs`.
*   `IPFS_GATEWAY_URL`: `https://ipfs.phpcoin.net/ipfs/` — our own node's gateway.
*   `permanentLinkUrl(address)`: `https://defifolio.dap.ad/p/${address}`.
*   `SHOW_DNS_SECTION`: `true` — shows the dap.ad custom-domain promotion (paid tier, external product) after publishing.
*   `SHOW_STABLE_LINK_SECTION`: `true` — shows the "login for a permanent link" promotion after publishing.

### `services/txData.ts`
*   `CHAIN_ID`: `'00'` (mainnet).
*   `NODE_API_URL`: `https://main1.phpcoin.net/api.php`.
*   `DEFIFOLIO_SERVICE_ADDRESS`: `VITE_DEFIFOLIO_SERVICE_ADDRESS` env var — the nominal `dst` address required by `TX_TYPE_DATA` validation (no value is actually transferred).

### `services/walletConnect.ts`
*   `WALLET_CONNECT_URL`: `VITE_WALLET_CONNECT_URL` env var, defaulting to `https://wallet.phpcoin.net/#/connect`.

### Env vars (`.env.local`, not committed)
*   `VITE_BACKEND_URL`
*   `VITE_WALLET_CONNECT_URL`
*   `VITE_DEFIFOLIO_SERVICE_ADDRESS`

---

## 6. Future Development Guidelines

1.  **Export Integrity:** Any new feature added to the React `PortfolioPreview` **MUST** be manually replicated in the `generateHtml` string template function in `App.tsx`. The exported file cannot depend on React logic.
2.  **Asset Handling:** Always prefer Base64 for user images to keep the export as a single file; keep the 2MB per-image cap.
3.  **Responsive Design:**
    *   **Desktop:** Split-pane layout (Editor Left, Preview Right); Import/Login/logout live in the right (preview) panel's toolbar, Preview Mode toggle lives in the left (editor) panel's header.
    *   **Mobile:** Tab-based layout (toggle between Editor/Preview via bottom nav); Import/Login/logout are duplicated as icon-only buttons in the left panel's header since the desktop toolbar copy is hidden below the `md` breakpoint.
4.  **Icons:**
    *   **Builder:** Uses `lucide-react` components.
    *   **Export:** Uses raw SVG paths defined in the `ICONS` constant in `App.tsx`. If adding a new social platform, you must add the icon to *both* places.
5.  **Security:** All user-controlled values interpolated into `generateHtml()`'s raw HTML string must be escaped/validated (text via `escapeHtml`, colors via `sanitizeColor`, URLs via `sanitizeUrl`) — this is a real injection surface, already fixed once this session, don't reintroduce it.
6.  **Backend structure:** new PHP entry points that need direct web access go in `server/public/`; shared logic that shouldn't be directly requestable goes in `server/lib/`. Never put secrets in git-tracked files — use a local, gitignored key file (see `server/lib/gemini_api_key.txt`) rather than the shared PHP-FPM pool config, which is shared by every vhost on the host.
7.  **Deployment:** the routine frontend build + deploy to `defifolio.dap.ad` happens automatically after each relevant change (user tests on live, not locally) — see `PROJECT_STATUS.md`'s "Development Model" for the full deploy commands and the boundary of what still needs explicit approval.
