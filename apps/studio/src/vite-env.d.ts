/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AEFI_API_URL: string;
  readonly VITE_AEFI_API_KEY: string;
  readonly VITE_ARC_CHAIN_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
