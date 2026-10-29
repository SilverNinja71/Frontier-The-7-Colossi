import { describe, expect, it, vi } from 'vitest';
import { CrazyGamesService, type CrazyGamesServiceOptions } from './CrazyGamesService.ts';
import type { CrazyGamesAdCallbacks, CrazyGamesSdk } from './sdk-types.ts';

const silent = { info: () => {}, warn: () => {} };

function fakeSdk(overrides: Partial<CrazyGamesSdk> = {}) {
  let pendingAd: CrazyGamesAdCallbacks | null = null;
  const sdk = {
    environment: 'local',
    init: vi.fn(async () => {}),
    game: {
      gameplayStart: vi.fn(),
      gameplayStop: vi.fn(),
      loadingStart: vi.fn(),
      loadingStop: vi.fn(),
      happytime: vi.fn(),
      settings: { muteAudio: false, disableChat: false },
      addSettingsChangeListener: vi.fn(),
    },
    ad: {
      requestAd: vi.fn((_type: string, callbacks: CrazyGamesAdCallbacks) => {
        pendingAd = callbacks;
      }),
      hasAdblock: vi.fn(async () => false),
    },
    banner: {
      requestBanner: vi.fn(async () => {}),
      requestResponsiveBanner: vi.fn(async () => {}),
      clearBanner: vi.fn(),
      clearAllBanners: vi.fn(),
    },
    ...overrides,
  } satisfies CrazyGamesSdk;
  return { sdk, ad: () => pendingAd! };
}

function service(sdk: CrazyGamesSdk | undefined, options: CrazyGamesServiceOptions = {}) {
  return new CrazyGamesService({ resolveSdk: () => sdk, loadScript: async () => {}, logger: silent, ...options });
}

describe('CrazyGamesService', () => {
  it('degrades to a no-op when the SDK cannot load', async () => {
    const cg = new CrazyGamesService({
      resolveSdk: () => undefined,
      loadScript: () => Promise.reject(new Error('blocked')),
      logger: silent,
    });
    await cg.init();
    expect(cg.available).toBe(false);
    cg.gameplayStart();
    expect(await cg.showMidgameAd()).toEqual({ ok: false, reason: 'sdk-unavailable' });
  });

  it('treats the "disabled" environment as unavailable', async () => {
    const { sdk } = fakeSdk({ environment: 'disabled' });
    const cg = service(sdk);
    await cg.init();
    expect(cg.available).toBe(false);
  });

  it('reports gameplay transitions once and replays intent made before init', async () => {
    const { sdk } = fakeSdk();
    const cg = service(sdk);
    cg.loadingStart();
    await cg.init();
    expect(sdk.game.loadingStart).toHaveBeenCalledTimes(1);
    cg.loadingStop();
    cg.gameplayStart();
    cg.gameplayStart();
    cg.gameplayStop();
    cg.gameplayStop();
    expect(sdk.game.gameplayStart).toHaveBeenCalledTimes(1);
    expect(sdk.game.gameplayStop).toHaveBeenCalledTimes(1);
  });

  it('suspends gameplay and emits ad breaks around a rewarded ad', async () => {
    const { sdk, ad } = fakeSdk();
    const cg = service(sdk);
    await cg.init();
    cg.gameplayStart();
    const breaks: boolean[] = [];
    cg.onAdBreak((active) => breaks.push(active));

    const pending = cg.showRewardedAd('cosmetic-doubloons');
    expect(await cg.showRewardedAd('cosmetic-doubloons')).toEqual({ ok: false, reason: 'busy' });
    ad().adStarted?.();
    expect(sdk.game.gameplayStop).toHaveBeenCalledTimes(1);
    ad().adFinished?.();

    expect(await pending).toEqual({ ok: true });
    expect(breaks).toEqual([true, false]);
    expect(sdk.game.gameplayStart).toHaveBeenCalledTimes(2);
  });

  it('never offers revives outside casual dungeons, nor any ad during a Colossus raid', async () => {
    const { sdk } = fakeSdk();
    const cg = service(sdk);
    await cg.init();

    cg.setAdContext('overworld');
    expect((await cg.showRewardedAd('casual-revive-token')).ok).toBe(false);
    cg.setAdContext('colossus-raid');
    expect(await cg.showRewardedAd('cosmetic-doubloons')).toMatchObject({ reason: 'policy' });
    expect(await cg.showMidgameAd()).toMatchObject({ reason: 'policy' });
    expect(await cg.showBanner('slot', '300x250')).toMatchObject({ reason: 'policy' });
    expect(sdk.ad.requestAd).not.toHaveBeenCalled();

    cg.setAdContext('casual-dungeon');
    expect(cg.canShowRewarded('casual-revive-token')).toBe(true);
  });

  it('maps SDK error shapes to stable reasons', async () => {
    const { sdk, ad } = fakeSdk();
    const cg = service(sdk);
    await cg.init();
    const unfilled = cg.showRewardedAd('cosmetic-doubloons');
    ad().adError?.({ code: 'unfilled', message: 'No ad available' });
    expect(await unfilled).toMatchObject({ ok: false, reason: 'unfilled' });
    const tooSoon = cg.showRewardedAd('cosmetic-doubloons');
    ad().adError?.('Ad requested too soon');
    expect(await tooSoon).toMatchObject({ ok: false, reason: 'cooldown' });
  });

  it('throttles midgame ads and banner refreshes locally', async () => {
    let now = 0;
    const { sdk, ad } = fakeSdk();
    const cg = service(sdk, { now: () => now, midgameCooldownMs: 1000, bannerRefreshMs: 500 });
    await cg.init();
    cg.setAdContext('menu');

    const first = cg.showMidgameAd();
    ad().adFinished?.();
    expect(await first).toEqual({ ok: true });
    expect(await cg.showMidgameAd()).toMatchObject({ reason: 'cooldown' });

    expect(await cg.showBanner('pause-banner', '300x250')).toEqual({ ok: true });
    expect(sdk.banner.requestBanner).toHaveBeenCalledWith({ id: 'pause-banner', width: 300, height: 250 });
    expect(await cg.showBanner('pause-banner', '300x250')).toMatchObject({ reason: 'cooldown' });
    now = 600;
    expect(await cg.showBanner('pause-banner', 'responsive')).toEqual({ ok: true });

    cg.setAdContext('overworld');
    expect(sdk.banner.clearAllBanners).toHaveBeenCalled();
  });

  it('times out an ad the SDK never resolves', async () => {
    vi.useFakeTimers();
    try {
      const { sdk } = fakeSdk();
      const cg = service(sdk, { adTimeoutMs: 50 });
      await cg.init();
      const pending = cg.showRewardedAd('cosmetic-doubloons');
      await vi.advanceTimersByTimeAsync(60);
      expect(await pending).toMatchObject({ ok: false, reason: 'error' });
    } finally {
      vi.useRealTimers();
    }
  });
});
