/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL de base de l'API si elle est hébergée sur un autre domaine. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
