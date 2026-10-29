import { AD_POLICY, isRewardedAdAllowed, type AdContext, type RewardedAdReward } from '@frontier/shared-types';
import type { AdResult, PlatformService } from './types.ts';

/** Plain web / Steam build: no ad network. Policy answers stay truthful so UI can grey out offers. */
export class WebPlatformService implements PlatformService {
  readonly id = 'web' as const;
  readonly available = false;
  #adContext: AdContext = 'menu';

  get adContext(): AdContext {
    return this.#adContext;
  }

  async init(): Promise<void> {}
  loadingStart(): void {}
  loadingStop(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  happytime(): void {}

  setAdContext(context: AdContext): void {
    this.#adContext = context;
  }

  canShowRewarded(_reward: RewardedAdReward): boolean {
    return false;
  }

  canShowMidgame(): boolean {
    return false;
  }

  async showMidgameAd(): Promise<AdResult> {
    return AD_POLICY[this.#adContext].midgame ? { ok: false, reason: 'sdk-unavailable' } : { ok: false, reason: 'policy' };
  }

  async showRewardedAd(reward: RewardedAdReward): Promise<AdResult> {
    return isRewardedAdAllowed(this.#adContext, reward)
      ? { ok: false, reason: 'sdk-unavailable' }
      : { ok: false, reason: 'policy' };
  }

  async showBanner(): Promise<AdResult> {
    return AD_POLICY[this.#adContext].banners ? { ok: false, reason: 'sdk-unavailable' } : { ok: false, reason: 'policy' };
  }

  clearBanner(): void {}
  clearAllBanners(): void {}

  async hasAdblock(): Promise<boolean> {
    return false;
  }

  onAdBreak(): () => void {
    return () => {};
  }

  onMuteChange(): () => void {
    return () => {};
  }
}
