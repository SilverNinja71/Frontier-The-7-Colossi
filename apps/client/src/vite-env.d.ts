/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Force a platform integration at build time: "crazygames" | "web". */
  readonly VITE_PLATFORM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
