import { SONIC_SIGNATURE_THRESHOLD, UNRATED } from "../types/domain.js";
import type { PointAward } from "../types/events.js";

/**
 * Pure round-scoring logic. Kept side-effect free so it is trivially testable;
 * `partyService.revealRound` is responsible for persisting the result with
 * atomic increments.
 */

export interface RoundSubmissionInput {
  userId: string;
  rating: number;
  guessedUserId: string | null;
}

export interface RoundScoreInput {
  /** The user who submitted the track being revealed. */
  submitterId: string;
  /** Whether the guessing game is enabled for this party. */
  guessingEnabled: boolean;
  submissions: RoundSubmissionInput[];
  /** User ids currently connected to the party (the "active room"). */
  connectedUserIds: string[];
}

export interface RoundScoreResult {
  correctGuesserIds: string[];
  /** Connected users who could plausibly have guessed (everyone but the submitter). */
  eligibleGuesserCount: number;
  correctRatio: number;
  sonicSignatureAwarded: boolean;
  pointAwards: PointAward[];
  ratingsCount: number;
  totalRating: number;
  averageRating: number;
  /**
   * Points to add to the track's own `QueueItem.totalRatingScore` — i.e. the
   * Song Rankings axis. +1 when the Sonic Signature fires, 0 otherwise.
   */
  songRankingBonus: number;
}

/**
 * Scoring rules — every award here lands on the unified `User.score`:
 *  - Song rating: the submitter earns the full sum of the ratings their track
 *    received this round. This is what makes `User.score` the definitive
 *    overall leaderboard rather than just a guessing-game tally.
 *  - Correct guess: each voter who identified the submitter earns +1.
 *  - "Sonic Signature": if >= 50% of the active room (excluding the submitter)
 *    identified them, the submitter earns a +1 bonus on `User.score` — AND the
 *    track itself gains +1 on the Song Rankings axis (`songRankingBonus`), so a
 *    culturally iconic, highly personal track climbs the final standings.
 *
 * Ghost interactions: a submitter may rate/guess their OWN track to avoid
 * looking idle, but those rows are discarded here so they carry zero weight in
 * every calculation (ratings total, guess accuracy, and the room denominator).
 */
export function calculateRoundScore(input: RoundScoreInput): RoundScoreResult {
  const { submitterId, guessingEnabled, submissions, connectedUserIds } = input;

  // Drop the submitter's own ghost rating/guess before anything is counted.
  const scoredSubmissions = submissions.filter((s) => s.userId !== submitterId);

  const ratings = scoredSubmissions
    .map((s) => s.rating)
    .filter((r) => r > UNRATED);
  const ratingsCount = ratings.length;
  const totalRating = ratings.reduce((sum, r) => sum + r, 0);
  const averageRating =
    ratingsCount > 0 ? Number((totalRating / ratingsCount).toFixed(2)) : 0;

  const pointAwards: PointAward[] = [];

  // The submitter banks the full weight of their track's ratings this round.
  if (totalRating > 0) {
    pointAwards.push({
      userId: submitterId,
      points: totalRating,
      reason: "song_rating",
    });
  }

  let correctGuesserIds: string[] = [];
  let sonicSignatureAwarded = false;
  let correctRatio = 0;

  // The submitter can never be an eligible guesser of their own track.
  const eligibleGuesserCount = connectedUserIds.filter(
    (id) => id !== submitterId,
  ).length;

  if (guessingEnabled) {
    correctGuesserIds = scoredSubmissions
      .filter((s) => s.guessedUserId === submitterId)
      .map((s) => s.userId);

    for (const userId of correctGuesserIds) {
      pointAwards.push({ userId, points: 1, reason: "correct_guess" });
    }

    correctRatio =
      eligibleGuesserCount > 0
        ? correctGuesserIds.length / eligibleGuesserCount
        : 0;

    sonicSignatureAwarded =
      correctGuesserIds.length > 0 &&
      correctRatio >= SONIC_SIGNATURE_THRESHOLD;

    if (sonicSignatureAwarded) {
      pointAwards.push({
        userId: submitterId,
        points: 1,
        reason: "sonic_signature",
      });
    }
  }

  return {
    correctGuesserIds,
    eligibleGuesserCount,
    correctRatio,
    sonicSignatureAwarded,
    pointAwards,
    ratingsCount,
    totalRating,
    averageRating,
    songRankingBonus: sonicSignatureAwarded ? 1 : 0,
  };
}
