/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WALLET_CONNECT_PROJECT_ID: string
  readonly VITE_APP_NAME: string
  readonly VITE_APP_DESCRIPTION: string
  readonly VITE_ENABLE_TESTNETS?: string
  readonly VITE_DEFAULT_CHAIN_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}