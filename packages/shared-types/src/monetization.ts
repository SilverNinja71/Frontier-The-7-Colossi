/**
 * Ethical monetization policy. The client uses it to decide what to offer; the server must
 * re-check it before granting any reward, because client checks can be bypassed.
 */

export type AdContext = 'menu' | 'overworld' | 'casual-dungeon' | 'colossus-raid';

export type RewardedAdReward = 'cosmetic-doubloons' | 'casual-revive-token';

export type BannerSize = '728x90' | '300x250' | '320x50' | '468x60' | '320x100';

interface AdContextPolicy {
  rewarded: readonly RewardedAdReward[];
  /** Interstitials only at natural breaks. */
  midgame: boolean;
  banners: boolean;
}

export const AD_POLICY: Readonly<Record<AdContext, AdContextPolicy>> = {
  menu: { rewarded: ['cosmetic-doubloons'], midgame: true, banners: true },
  overworld: { rewarded: ['cosmetic-doubloons'], midgame: false, banners: false },
  // Revives exist only here — never in open-world PvE and never during a Colossus raid.
  'casual-dungeon': { rewarded: ['cosmetic-doubloons', 'casual-revive-token'], midgame: false, banners: false },
  'colossus-raid': { rewarded: [], midgame: false, banners: false },
};

export function isRewardedAdAllowed(context: AdContext, reward: RewardedAdReward): boolean {
  return AD_POLICY[context].rewarded.includes(reward);
}
