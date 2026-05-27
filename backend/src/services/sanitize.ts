import type { GamePhase } from "../types/domain.js";
import { UNRATED } from "../types/domain.js";
import type {
  ParticipantSnapshot,
  PartyStateSnapshot,
  QueueItemSnapshot,
  RoundActivityEntry,
  SubmissionProgress,
  ViewerVoteSnapshot,
} from "../types/events.js";
import type { RawPartyState } from "./partyService.js";

/**
 * Turns the raw party aggregate into a per-viewer wire snapshot.
 *
 * This is the security boundary described in Phase B: protected values are
 * physically removed here, before the payload is ever emitted, so a normal
 * participant can never scrape hidden data from the WebSocket stream. The host
 * receives no special treatment — fairness applies to everyone.
 *
 * Rules (applied per QueueItem):
 *  - A revealed track is fully visible to everyone.
 *  - The viewer always sees the tracks they submitted ("isOwn").
 *  - Otherwise: `hideSong` strips title/artist/artwork; `hideSubmitterIdentities`
 *    strips `addedByUserId`. `spotifyTrackId` is never stripped — playback in
 *    blind-listening mode still needs it.
 */
export function sanitizePartyState(
  raw: RawPartyState,
  viewerUserId: string,
  onlineUserIds: Set<string>,
  isPlaying: boolean,
): PartyStateSnapshot {
  const phase = raw.gamePhase as GamePhase;
  const leaderboardHidden = raw.hideLeaderboardUntilEnd && phase !== "REVEAL";

  const participants: ParticipantSnapshot[] = raw.users.map((user) => ({
    id: user.id,
    name: user.name,
    avatarSeed: user.avatarSeed,
    isHost: user.isHost,
    online: onlineUserIds.has(user.id),
    score: leaderboardHidden ? null : user.score,
  }));

  const queue: QueueItemSnapshot[] = raw.queue.map((item) => {
    const isOwn = item.addedByUserId === viewerUserId;
    const openMetadata = item.revealed || isOwn;
    const openIdentity = item.revealed || isOwn;

    const hideMetadata = raw.hideSong && !openMetadata;
    const hideIdentity = raw.hideSubmitterIdentities && !openIdentity;

    return {
      id: item.id,
      spotifyTrackId: item.spotifyTrackId,
      previewUrl: item.previewUrl,
      title: hideMetadata ? null : item.title,
      artist: hideMetadata ? null : item.artist,
      albumArtUrl: hideMetadata ? null : item.albumArtUrl,
      addedByUserId: hideIdentity ? null : item.addedByUserId,
      totalRatingScore: item.totalRatingScore,
      revealed: item.revealed,
      isOwn,
      bpm: item.bpm ?? null,
    };
  });

  const myVotes: ViewerVoteSnapshot[] = raw.submissions
    .filter((s) => s.userId === viewerUserId)
    .map((s) => ({
      queueItemId: s.queueItemId,
      rating: s.rating,
    }));

  return {
    viewerUserId,
    party: {
      id: raw.id,
      code: raw.code,
      gamePhase: phase,
      currentTrackId: raw.currentTrackId,
      config: {
        maxSongs: raw.maxSongs,
        hideSong: raw.hideSong,
        hideSubmitterIdentities: raw.hideSubmitterIdentities,
        hideLeaderboardUntilEnd: raw.hideLeaderboardUntilEnd,
      },
    },
    participants,
    queue,
    submissionProgress: computeSubmissionProgress(raw),
    playback: { isPlaying },
    roundActivity: computeRoundActivity(raw),
    myVotes,
  };
}

/**
 * Per-participant interaction status for the active round. Carries only
 * "has rated" boolean — so it is identical for every viewer and safe to
 * broadcast. This is what lets a submitter ghost-vote and appear just as
 * active as everyone else.
 */
export function computeRoundActivity(raw: RawPartyState): RoundActivityEntry[] {
  const currentTrackId = raw.currentTrackId;
  if ((raw.gamePhase as GamePhase) !== "RANKING" || !currentTrackId) return [];

  return raw.users.map((user) => {
    const submission = raw.submissions.find(
      (s) => s.queueItemId === currentTrackId && s.userId === user.id,
    );
    return {
      userId: user.id,
      hasRated: !!submission && submission.rating > UNRATED,
    };
  });
}

/** Room-wide and per-user submission counts for the "2/4 songs" indicator. */
export function computeSubmissionProgress(raw: RawPartyState): SubmissionProgress {
  const countByUser = new Map<string, number>();
  for (const user of raw.users) countByUser.set(user.id, 0);
  for (const item of raw.queue) {
    countByUser.set(item.addedByUserId, (countByUser.get(item.addedByUserId) ?? 0) + 1);
  }

  return {
    submitted: raw.queue.length,
    total: raw.users.length * raw.maxSongs,
    perUser: [...countByUser.entries()].map(([userId, count]) => ({ userId, count })),
  };
}

/** Single-participant projection, reused by create/join/register acks. */
export function toParticipantSnapshot(
  snapshot: PartyStateSnapshot,
  userId: string,
): ParticipantSnapshot {
  const participant = snapshot.participants.find((p) => p.id === userId);
  if (participant) return participant;
  // Defensive: should never happen, the user was just created/looked up.
  return {
    id: userId,
    name: "",
    avatarSeed: "",
    isHost: false,
    online: true,
    score: 0,
  };
}
