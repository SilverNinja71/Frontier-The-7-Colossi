import {
  AD_POLICY,
  isRewardedAdAllowed,
  type AdContext,
  type BannerSize,
  type RewardedAdReward,
} from '@frontier/shared-types';
import type { AdFailureReason, AdResult, PlatformService } from '../types.ts';
import type { CrazyGamesAdError, CrazyGamesAdType, CrazyGamesSdk } from './sdk-types.ts';

export const CRAZYGAMES_SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

export interface CrazyGamesServiceOptions {
  scriptUrl?: string;
  /** Injected for tests; defaults to a <script> tag loader. */
  loadScript?: (url: string) => Promise<void>;
  /** Injected for tests; defaults to window.CrazyGames.SDK. */
  resolveSdk?: () => CrazyGamesSdk | undefined;
  initTimeoutMs?: number;
  /** Safety net if the SDK never calls back. */
  adTimeoutMs?: number;
  /** Local throttle on top of the SDK's own frequency capping. */
  midgameCooldownMs?: number;
  /** Minimum time between banner requests for the same container. */
  bannerRefreshMs?: number;
  now?: () => number;
  logger?: Pick<Console, 'info' | 'warn'>;
}

const fail = (reason: AdFailureReason, detail?: string): AdResult =>
  detail === undefined ? { ok: false, reason } : { ok: false, reason, detail };

/**
 * Drop-in CrazyGames SDK v3 integration.
 *
 * - Loads the SDK lazily and degrades to a silent no-op if it is blocked, times out, or
 *   reports the `disabled` environment. Game code never needs try/catch.
 * - gameplayStart/Stop are idempotent and automatically suspended while an ad plays.
 * - Every ad request is gated by AD_POLICY: no ads of any kind during Colossus raids,
 *   revive rewards only in casual dungeons, interstitials and banners only in menus.
 */
export class CrazyGamesService implements PlatformService {
  readonly id = 'crazygames' as const;

  readonly #options: Required<Omit<CrazyGamesServiceOptions, 'scriptUrl'>> & { scriptUrl: string };
  #sdk: CrazyGamesSdk | null = null;
  #initPromise: Promise<void> | null = null;

  #wantGameplay = false;
  #reportedGameplay = false;
  #wantLoading = false;
  #reportedLoading = false;

  #adInFlight = false;
  #adPlaying = false;
  #lastMidgameAt = Number.NEGATIVE_INFINITY;
  readonly #bannerRequestedAt = new Map<string, number>();
  #adContext: AdContext = 'menu';

  readonly #adBreakListeners = new Set<(active: boolean) => void>();
  readonly #muteListeners = new Set<(muted: boolean) => void>();

  constructor(options: CrazyGamesServiceOptions = {}) {
    this.#options = {
      scriptUrl: options.scriptUrl ?? CRAZYGAMES_SDK_URL,
      loadScript: options.loadScript ?? loadScriptTag,
      resolveSdk: options.resolveSdk ?? (() => globalThis.window?.CrazyGames?.SDK),
      initTimeoutMs: options.initTimeoutMs ?? 8000,
      adTimeoutMs: options.adTimeoutMs ?? 180_000,
      midgameCooldownMs: options.midgameCooldownMs ?? 180_000,
      bannerRefreshMs: options.bannerRefreshMs ?? 60_000,
      now: options.now ?? (() => performance.now()),
      logger: options.logger ?? console,
    };
  }

  get available(): boolean {
    return this.#sdk !== null;
  }

  get adContext(): AdContext {
    return this.#adContext;
  }

  init(): Promise<void> {
    this.#initPromise ??= this.#init();
    return this.#initPromise;
  }

  async #init(): Promise<void> {
    const { logger } = this.#options;
    try {
      let sdk = this.#options.resolveSdk();
      if (!sdk) {
        await withTimeout(this.#options.loadScript(this.#options.scriptUrl), this.#options.initTimeoutMs, 'SDK load');
        sdk = this.#options.resolveSdk();
      }
      if (!sdk) throw new Error('window.CrazyGames.SDK missing after load');
      await withTimeout(sdk.init(), this.#options.initTimeoutMs, 'SDK init');
      if (sdk.environment === 'disabled') {
        logger.info('[CrazyGames] SDK environment is "disabled"; running without platform features.');
        return;
      }
      this.#sdk = sdk;
      sdk.game.addSettingsChangeListener?.((settings) => this.#emitMute(settings.muteAudio));
      if (sdk.game.settings) this.#emitMute(sdk.game.settings.muteAudio);
      logger.info(`[CrazyGames] SDK ready (environment: ${sdk.environment ?? 'unknown'}).`);
      this.#sync();
    } catch (error) {
      logger.warn('[CrazyGames] SDK unavailable; continuing without it.', error);
    }
  }

  // --- Game lifecycle -------------------------------------------------------

  loadingStart(): void {
    this.#wantLoading = true;
    this.#sync();
  }

  loadingStop(): void {
    this.#wantLoading = false;
    this.#sync();
  }

  gameplayStart(): void {
    this.#wantGameplay = true;
    this.#sync();
  }

  gameplayStop(): void {
    this.#wantGameplay = false;
    this.#sync();
  }

  happytime(): void {
    if (this.#sdk) this.#safeCall(() => this.#sdk?.game.happytime());
  }

  /** Reconcile what the game wants with what the SDK was last told. */
  #sync(): void {
    const sdk = this.#sdk;
    if (!sdk) return;
    if (this.#wantLoading !== this.#reportedLoading) {
      this.#reportedLoading = this.#wantLoading;
      this.#safeCall(() => (this.#wantLoading ? sdk.game.loadingStart() : sdk.game.loadingStop()));
    }
    const gameplay = this.#wantGameplay && !this.#adPlaying;
    if (gameplay !== this.#reportedGameplay) {
      this.#reportedGameplay = gameplay;
      this.#safeCall(() => (gameplay ? sdk.game.gameplayStart() : sdk.game.gameplayStop()));
    }
  }

  // --- Ads ------------------------------------------------------------------

  setAdContext(context: AdContext): void {
    this.#adContext = context;
    if (!AD_POLICY[context].banners) this.clearAllBanners();
  }

  canShowRewarded(reward: RewardedAdReward): boolean {
    return this.available && isRewardedAdAllowed(this.#adContext, reward);
  }

  canShowMidgame(): boolean {
    return (
      this.available &&
      AD_POLICY[this.#adContext].midgame &&
      this.#options.now() - this.#lastMidgameAt >= this.#options.midgameCooldownMs
    );
  }

  async showMidgameAd(): Promise<AdResult> {
    if (!AD_POLICY[this.#adContext].midgame) return fail('policy', `no interstitials in ${this.#adContext}`);
    if (this.#options.now() - this.#lastMidgameAt < this.#options.midgameCooldownMs) return fail('cooldown');
    const result = await this.#requestAd('midgame');
    if (result.ok) this.#lastMidgameAt = this.#options.now();
    return result;
  }

  async showRewardedAd(reward: RewardedAdReward): Promise<AdResult> {
    if (!isRewardedAdAllowed(this.#adContext, reward)) {
      return fail('policy', `${reward} is not offered in ${this.#adContext}`);
    }
    return this.#requestAd('rewarded');
  }

  #requestAd(type: CrazyGamesAdType): Promise<AdResult> {
    const sdk = this.#sdk;
    if (!sdk) return Promise.resolve(fail('sdk-unavailable'));
    if (this.#adInFlight) return Promise.resolve(fail('busy'));
    this.#adInFlight = true;

    return new Promise<AdResult>((resolve) => {
      let settled = false;
      const timeout = setTimeout(() => finish(fail('error', 'ad timed out')), this.#options.adTimeoutMs);

      const finish = (result: AdResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.#adInFlight = false;
        if (this.#adPlaying) {
          this.#adPlaying = false;
          this.#emitAdBreak(false);
        }
        this.#sync();
        resolve(result);
      };

      try {
        const maybePromise = sdk.ad.requestAd(type, {
          adStarted: () => {
            if (settled || this.#adPlaying) return;
            this.#adPlaying = true;
            this.#sync();
            this.#emitAdBreak(true);
          },
          adFinished: () => finish({ ok: true }),
          adError: (error) => finish(mapAdError(error)),
        });
        if (isPromiseLike(maybePromise)) {
          maybePromise.then(undefined, (error: unknown) => finish(fail('error', String(error))));
        }
      } catch (error) {
        finish(fail('error', String(error)));
      }
    });
  }

  // --- Banners --------------------------------------------------------------

  async showBanner(containerId: string, size: BannerSize | 'responsive'): Promise<AdResult> {
    if (!AD_POLICY[this.#adContext].banners) return fail('policy', `no banners in ${this.#adContext}`);
    const banner = this.#sdk?.banner;
    if (!banner) return fail('sdk-unavailable');
    const now = this.#options.now();
    const last = this.#bannerRequestedAt.get(containerId);
    if (last !== undefined && now - last < this.#options.bannerRefreshMs) return fail('cooldown');
    this.#bannerRequestedAt.set(containerId, now);
    try {
      if (size === 'responsive') {
        await banner.requestResponsiveBanner(containerId);
      } else {
        const [width, height] = size.split('x').map(Number) as [number, number];
        await banner.requestBanner({ id: containerId, width, height });
      }
      return { ok: true };
    } catch (error) {
      return mapAdError(error as CrazyGamesAdError);
    }
  }

  clearBanner(containerId: string): void {
    const banner = this.#sdk?.banner;
    if (banner) this.#safeCall(() => banner.clearBanner(containerId));
  }

  clearAllBanners(): void {
    const banner = this.#sdk?.banner;
    if (banner) this.#safeCall(() => banner.clearAllBanners());
  }

  async hasAdblock(): Promise<boolean> {
    if (!this.#sdk) return false;
    try {
      return await this.#sdk.ad.hasAdblock();
    } catch {
      return false;
    }
  }

  // --- Events ---------------------------------------------------------------

  onAdBreak(listener: (active: boolean) => void): () => void {
    this.#adBreakListeners.add(listener);
    return () => this.#adBreakListeners.delete(listener);
  }

  onMuteChange(listener: (muted: boolean) => void): () => void {
    this.#muteListeners.add(listener);
    return () => this.#muteListeners.delete(listener);
  }

  #emitAdBreak(active: boolean): void {
    for (const listener of this.#adBreakListeners) listener(active);
  }

  #emitMute(muted: boolean): void {
    for (const listener of this.#muteListeners) listener(muted);
  }

  #safeCall(fn: () => unknown): void {
    try {
      const result = fn();
      if (isPromiseLike(result)) {
        result.then(undefined, (error: unknown) => this.#options.logger.warn('[CrazyGames] SDK call failed', error));
      }
    } catch (error) {
      this.#options.logger.warn('[CrazyGames] SDK call failed', error);
    }
  }
}

function mapAdError(error: CrazyGamesAdError): AdResult {
  const code = typeof error === 'string' ? '' : (error.code ?? '');
  const message = typeof error === 'string' ? error : (error.message ?? '');
  const text = `${code} ${message}`.toLowerCase();
  const detail = message || code || 'unknown';
  if (code === 'unfilled' || text.includes('no ad available')) return fail('unfilled', detail);
  if (text.includes('adblock')) return fail('adblock', detail);
  if (text.includes('too soon')) return fail('cooldown', detail);
  if (text.includes('in progress')) return fail('busy', detail);
  return fail('error', detail);
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof (value as PromiseLike<unknown> | undefined)?.then === 'function';
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function loadScriptTag(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    document.head.appendChild(script);
  });
}
