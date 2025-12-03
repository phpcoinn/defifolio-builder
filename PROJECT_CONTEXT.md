# Project Context: DeFiFolio Builder

## 1. Project Overview
**DeFiFolio Builder** is a decentralized, no-code static site generator designed for the Web3 ecosystem. It empowers users to create professional, aesthetically pleasing "Link-in-Bio" style portfolio pages containing their crypto identities (Wallet addresses, Social links, Bio).

**Core Philosophy:**
1.  **Decentralized Output:** The final product is a single, self-contained `index.html` file that requires no backend database to run and can be hosted on IPFS.
2.  **State-in-File:** The configuration data (JSON) is embedded within the generated HTML, allowing the file to be re-imported into the builder later for editing.
3.  **Privacy:** No user data is stored on a central database; drafts are saved in the browser's `localStorage`.

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

### Backend (Remote Services)
*   **Language:** PHP
*   **Location:** Remote Server (`https://dap.ad/ipfs.php`)
*   **Role:** Stateless Proxy / API Gateway.
*   **Endpoints:**
    *   `?q=generate_bio`: Proxies requests to Google Gemini AI for bio generation.
    *   `?q=analyze_portfolio`: Proxies requests to Google Gemini AI for portfolio analysis.
    *   `?q=publish_ipfs`: Receives HTML payload and uploads to IPFS.
*   **AI Engine:** Google Gemini 2.5 Flash.

---

## 3. Architecture & Workflows

### A. The Builder Workflow
1.  **Editor (Left Panel):** User inputs data (Identity, Wallets, Socials, Style).
2.  **Preview (Right Panel):** Real-time rendering of the portfolio. Supports "Desktop" and "Mobile" simulation modes.
3.  **Auto-Save:** `useEffect` hooks sync the `profile` state to `localStorage` key `defifolio_draft_v1`.

### B. The AI Integration
*   The frontend **does not** hold the API Key.
*   Requests are sent to the PHP backend.
*   **Format:** `POST` request with JSON body `{ profile: ... }` and query param `?q=action`.

### C. The Export Workflow (Self-Contained HTML)
*   **Function:** `generateHtml(UserProfile)` in `App.tsx`.
*   **Process:**
    1.  Constructs a standard HTML5 string.
    2.  Injects Tailwind CDN script (`<script src="https://cdn.tailwindcss.com"></script>`).
    3.  Embeds images as **Base64 strings** (ensuring the file is single-source).
    4.  Embeds the raw `UserProfile` JSON data into a `<script id="defifolio-data" type="application/json">` tag.
    5.  Injects vanilla JS for interactivity (Copy to clipboard, QR Code modal) into the output HTML.
    6.  Triggers a browser download of `index.html`.

### D. The Import Workflow
*   **Trigger:** "Import" button in Editor header.
*   **Process:**
    1.  User uploads a previously generated `index.html`.
    2.  App uses `DOMParser` to find the `<script id="defifolio-data">` tag.
    3.  Parses the JSON and restores the React state.

### E. Publishing to IPFS
1.  Frontend generates the HTML string.
2.  Sends HTML to backend (`?q=publish_ipfs`).
3.  Backend uploads to IPFS and returns `ipfsCID`.
4.  Frontend constructs Gateway URL using the `IPFS_GATEWAY_URL` constant.

---

## 4. Data Models (`types.ts`)

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

---

## 5. Key Configuration Constants (`App.tsx`)

*   `PUBLISH_API_URL`: The endpoint for the remote PHP backend.
*   `IPFS_GATEWAY_URL`: The public gateway used to view published sites (default: `https://ipfs.io/ipfs/`).
*   `SHOW_DNS_SECTION`: Boolean (`false` by default) to toggle the "PHPCoin DNS" promotion UI in the success modal.

---

## 6. Future Development Guidelines

1.  **Export Integrity:** Any new feature added to the React `PortfolioPreview` **MUST** be manually replicated in the `generateHtml` string template function in `App.tsx`. The exported file cannot depend on React logic.
2.  **Asset Handling:** Always prefer Base64 for user images to keep the export as a single file.
3.  **Responsive Design:**
    *   **Desktop:** Split-pane layout (Editor Left, Preview Right).
    *   **Mobile:** Tab-based layout (Toggle between Editor/Preview via bottom nav).
4.  **Icons:** 
    *   **Builder:** Uses `lucide-react` components.
    *   **Export:** Uses raw SVG paths defined in the `ICONS` constant in `App.tsx`. If adding a new social platform, you must add the icon to *both* places.
