import type { AdContext, BannerSize, RewardedAdReward } from '@frontier/shared-types';

export type PlatformId = 'crazygames' | 'web';

export type AdFailureReason =
  /** Blocked by AD_POLICY for the current AdContext (e.g. any ad during a Colossus raid). */
  | 'policy'
  | 'cooldown'
  | 'busy'
  | 'unfilled'
  | 'adblock'
  | 'sdk-unavailable'
  | 'error';

export type AdResult = { ok: true } | { ok: false; reason: AdFailureReason; detail?: string };

/**
 * Platform integration surface the game talks to. Implementations never throw into game
 * code: every failure resolves to an AdResult or is a silent no-op.
 */
export interface PlatformService {
  readonly id: PlatformId;
  /** True once the platform SDK initialised successfully and is usable. */
  readonly available: boolean;
  readonly adContext: AdContext;

  init(): Promise<void>;

  loadingStart(): void;
  loadingStop(): void;
  /** Idempotent. Call when the player gains control; the service handles ad interruptions. */
  gameplayStart(): void;
  /** Idempotent. Call on pause menus, death screens, tab-out. */
  gameplayStop(): void;
  /** Celebration moment (e.g. first Colossus kill). */
  happytime(): void;

  /** Switch the policy context; leaving a banner-allowed context clears banners. */
  setAdContext(context: AdContext): void;
  canShowRewarded(reward: RewardedAdReward): boolean;
  canShowMidgame(): boolean;

  showMidgameAd(): Promise<AdResult>;
  /**
   * `{ ok: true }` means the player watched to completion. Ask the server to grant the
   * reward — it re-checks AD_POLICY; never grant client-side.
   */
  showRewardedAd(reward: RewardedAdReward): Promise<AdResult>;
  showBanner(containerId: string, size: BannerSize | 'responsive'): Promise<AdResult>;
  clearBanner(containerId: string): void;
  clearAllBanners(): void;
  hasAdblock(): Promise<boolean>;

  /** `true` when an ad takes over the screen: pause simulation and mute audio until `false`. */
  onAdBreak(listener: (active: boolean) => void): () => void;
  /** Platform-level mute preference (e.g. CrazyGames settings). */
  onMuteChange(listener: (muted: boolean) => void): () => void;
}
