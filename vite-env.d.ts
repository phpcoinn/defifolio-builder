interface ImportMetaEnv {
  readonly VITE_WALLET_CONNECT_URL?: string;
  readonly VITE_DEFIFOLIO_SERVICE_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
