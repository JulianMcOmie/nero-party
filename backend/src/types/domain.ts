/**
 * Core domain constants shared across the server.
 *
 * `GamePhase` replaces a Prisma enum (unsupported by the SQLite connector).
 * It is the single source of truth for the party state machine.
 */

export const GAME_PHASES = ["HOSTING", "SUBMITTING", "RANKING", "REVEAL"] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

export function isGamePhase(value: string): value is GamePhase {
  return (GAME_PHASES as readonly string[]).includes(value);
}

/** Star-rating bounds for a single vote. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;

/** Sentinel rating meaning "row exists, but no star rating cast yet". */
export const UNRATED = 0;

/**
 * Fraction of eligible guessers who must correctly identify the submitter
 * for the "Sonic Signature" bonus point to be awarded.
 */
export const SONIC_SIGNATURE_THRESHOLD = 0.5;
