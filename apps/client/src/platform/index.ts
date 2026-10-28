import { CrazyGamesService } from './crazygames/CrazyGamesService.ts';
import type { PlatformId, PlatformService } from './types.ts';
import { WebPlatformService } from './WebPlatformService.ts';

export type { AdFailureReason, AdResult, PlatformId, PlatformService } from './types.ts';
export { CrazyGamesService } from './crazygames/CrazyGamesService.ts';
export { WebPlatformService } from './WebPlatformService.ts';

/**
 * `?platform=crazygames` (or VITE_PLATFORM) forces the integration — useful locally, where
 * the CrazyGames SDK serves demo ads. Otherwise detect CrazyGames hosting/embedding.
 */
export function detectPlatform(location: Pick<Location, 'search' | 'hostname'>, referrer: string): PlatformId {
  const forced = new URLSearchParams(location.search).get('platform') ?? import.meta.env.VITE_PLATFORM;
  if (forced) return forced === 'crazygames' ? 'crazygames' : 'web';
  const onCrazyGames = /(^|\.)crazygames\.[a-z.]+$/i.test(location.hostname) || /\/\/([^/]+\.)?crazygames\./i.test(referrer);
  return onCrazyGames ? 'crazygames' : 'web';
}

export function createPlatformService(): PlatformService {
  return detectPlatform(window.location, document.referrer) === 'crazygames'
    ? new CrazyGamesService()
    : new WebPlatformService();
}
