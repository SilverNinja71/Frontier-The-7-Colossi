/**
 * Structural types for the subset of the CrazyGames HTML5 SDK v3 this game uses.
 * Script: https://sdk.crazygames.com/crazygames-sdk-v3.js → window.CrazyGames.SDK
 */

export type CrazyGamesEnvironment = 'local' | 'crazygames' | 'disabled';
export type CrazyGamesAdType = 'midgame' | 'rewarded';

/** Older SDK builds report a bare string; v3 reports `{ code, message }`. */
export type CrazyGamesAdError = string | { code?: string; message?: string };

export interface CrazyGamesAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: CrazyGamesAdError) => void;
}

export interface CrazyGamesSettings {
  muteAudio: boolean;
  disableChat: boolean;
}

export interface CrazyGamesSdk {
  init(): Promise<void>;
  /** `disabled` means the game runs outside an allowed domain: treat the SDK as absent. */
  readonly environment?: CrazyGamesEnvironment;
  game: {
    gameplayStart(): unknown;
    gameplayStop(): unknown;
    loadingStart(): unknown;
    loadingStop(): unknown;
    happytime(): unknown;
    readonly settings?: CrazyGamesSettings;
    addSettingsChangeListener?(listener: (settings: CrazyGamesSettings) => void): void;
  };
  ad: {
    requestAd(type: CrazyGamesAdType, callbacks: CrazyGamesAdCallbacks): unknown;
    hasAdblock(): Promise<boolean>;
  };
  banner?: {
    requestBanner(request: { id: string; width: number; height: number }): Promise<unknown>;
    requestResponsiveBanner(id: string): Promise<unknown>;
    clearBanner(id: string): void;
    clearAllBanners(): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK?: CrazyGamesSdk };
  }
}
