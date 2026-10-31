import type { MoonPhase, TimeOfDay } from '@frontier/shared-types';

/**
 * World time in days: 0 is midnight of day 0, 0.5 is noon. Advanced by the simulation
 * (never wall-clock), so server and client agree on when night falls and which moon rises.
 */

/** Real seconds per in-game day for the sandbox. Live shards will run a longer cycle. */
export const SANDBOX_DAY_SECONDS = 240;

/** Fractions of the day where each period begins. Night wraps through midnight. */
export const DAY_PERIODS = { dawn: 0.22, day: 0.3, dusk: 0.72, night: 0.8 } as const;

/** One lunar cycle spans four nights. */
export const MOON_CYCLE: readonly MoonPhase[] = ['full', 'waning', 'new', 'waxing'];

export function dayFraction(t: number): number {
  return t - Math.floor(t);
}

export function timeOfDayAt(t: number): TimeOfDay {
  const f = dayFraction(t);
  if (f >= DAY_PERIODS.night || f < DAY_PERIODS.dawn) return 'night';
  if (f < DAY_PERIODS.day) return 'dawn';
  if (f < DAY_PERIODS.dusk) return 'day';
  return 'dusk';
}

/**
 * Which night `t` belongs to. A night that starts in the evening of day d and ends at
 * dawn of day d+1 has a single index, so its moon phase never changes at midnight.
 */
export function nightIndexAt(t: number): number {
  return Math.floor(t + (1 - DAY_PERIODS.night));
}

export function moonPhaseForNight(nightIndex: number): MoonPhase {
  const n = MOON_CYCLE.length;
  return MOON_CYCLE[((nightIndex % n) + n) % n]!;
}

export function moonPhaseAt(t: number): MoonPhase {
  return moonPhaseForNight(nightIndexAt(t));
}

/** Earliest time ≥ t that falls inside a new-moon night (t itself if already in one). */
export function nextNewMoonNight(t: number): number {
  for (let night = nightIndexAt(t); ; night++) {
    if (moonPhaseForNight(night) !== 'new') continue;
    const start = night - (1 - DAY_PERIODS.night);
    const end = night + DAY_PERIODS.dawn;
    if (end > t) return Math.max(t, start);
  }
}
