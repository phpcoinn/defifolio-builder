# DeFiFolio Builder

DeFiFolio is a no-code crypto portfolio builder with PHPCoin wallet identity, IPFS publishing, and permanent on-chain profile pointers.

- Live application: https://defifolio.dap.ad
- Current status: [PROJECT_STATUS.md](PROJECT_STATUS.md)
- Architecture and development context: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)
- Community beta guide: [../_master-docs/DAPAD-DEFIFOLIO-COMMUNITY-BETA.md](../_master-docs/DAPAD-DEFIFOLIO-COMMUNITY-BETA.md)

## What it does

- Builds and previews responsive portfolio pages.
- Saves drafts locally and imports/exports generated HTML.
- Publishes generated pages to IPFS.
- Authenticates through the PHPCoin web-wallet popup.
- Publishes client-signed `tx_data` pointers on PHPCoin mainnet.
- Resolves the latest profile at `https://defifolio.dap.ad/p/<PHPCOIN_ADDRESS>`.
- Keeps the latest signed profile pinned through a server-side sync worker.
- Supports routing through a registered dap.ad custom domain.

## Local frontend development

Prerequisite: a current Node.js/npm installation.

```bash
npm install
npm run dev
```

Runtime frontend configuration belongs in `.env.local`; use `.env.example` as the source if present. Never put Gemini keys, wallet private keys, or server credentials in frontend environment variables or committed files.

The trusted PHP backend lives under `server/`:

- `server/public/` contains web entry points.
- `server/lib/` contains shared non-public server logic.
- `server/cli/pin_sync.php` maintains the latest signed IPFS profile per address.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for deployed topology, verification status, known gaps, and future work.

## Checks

```bash
npm run build
npm run lint
```

The production status currently records a passing build and a missing ESLint configuration. Treat lint as an acknowledged beta gap until that configuration is added.
