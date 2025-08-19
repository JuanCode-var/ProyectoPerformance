/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // agrega aquí otras VITE_*
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
