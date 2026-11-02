import type { WorldMarkId } from '@frontier/shared-types';

/**
 * Sandbox-only persistence for earned world marks, kept in this browser. Phase 2 moves
 * marks to the server-side PlayerProfile, where they are truly permanent.
 */
const KEY = 'frontier.sandbox.marks';

export function loadMarks(): WorldMarkId[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveMarks(marks: readonly WorldMarkId[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(marks));
  } catch {
    // Storage blocked (private mode, embedded iframe policy): the mark lasts this session.
  }
}

export interface HuntRecords {
  hunts: number;
  subdued: number;
  survived: number;
  /** Best share of its Resolve broken in a single hunt, 0..1. */
  bestResolveBroken: number;
  bestChain: number;
  fastestSubdueSeconds: number | null;
}

const RECORDS_KEY = 'frontier.sandbox.huntRecords';

export const EMPTY_RECORDS: HuntRecords = {
  hunts: 0,
  subdued: 0,
  survived: 0,
  bestResolveBroken: 0,
  bestChain: 0,
  fastestSubdueSeconds: null,
};

export function loadRecords(): HuntRecords {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECORDS_KEY) ?? 'null') as Partial<HuntRecords> | null;
    return { ...EMPTY_RECORDS, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch {
    return { ...EMPTY_RECORDS };
  }
}

export function saveRecords(records: HuntRecords): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch {
    // Storage blocked: records last this session.
  }
}
