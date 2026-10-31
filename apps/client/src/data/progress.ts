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
