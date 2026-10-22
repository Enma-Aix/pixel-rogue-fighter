/// <reference types="vite/client" />

interface Window {
  __jintu?: {
    get: () => { scene: string; data: Record<string, unknown> };
    game?: object;
  };
}
