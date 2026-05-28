import type { Party, Prisma, User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { GameError } from "../lib/errors.js";
import { MAX_RATING, MIN_RATING, UNRATED } from "../types/domain.js";
import type { GamePhase } from "../types/domain.js";
import type {
  ActorPayload,
  AddSongPayload,
  CastVotePayload,
  ConfigUpdatePayload,
  CreatePartyPayload,
  FinalResults,
  JoinPartyPayload,
  LeaderboardEntry,
  RemoveSongPayload,
  RoundResult,
  SongRankingEntry,
} from "../types/events.js";
import { calculateRoundScore } from "./scoring.js";
import { getTrackBpm } from "./deezerService.js";

/**
 * The Prisma-shaped raw party aggregate. `sanitize.ts` turns this into the
 * per-viewer wire snapshot; nothing else should reach into Prisma directly.
 */
export type RawPartyState = Prisma.PartyGetPayload<{
  include: { users: true; queue: true; submissions: true };
}>;

/* -------------------------------------------------------------------------- */
/* Validation helpers                                                         */
/* -------------------------------------------------------------------------- */

function validateName(name: string): string {
  const trimmed = (name ?? "").trim();
  if (trimmed.length < 1 || trimmed.length > 32) {
    throw new GameError("Name must be between 1 and 32 characters.");
  }
  return trimmed;
}

function clampMaxSongs(value: number): number {
  if (!Number.isFinite(value)) return 3;
  return Math.min(20, Math.max(1, Math.floor(value)));
}

function validateTrack(track: AddSongPayload["track"]): void {
  if (!track || !track.spotifyTrackId || !track.title || !track.artist) {
    throw new GameError("This track is missing required information.");
  }
}

/* -------------------------------------------------------------------------- */
/* Lookups + guards                                                           */
/* -------------------------------------------------------------------------- */

async function requireParty(partyId: string): Promise<Party> {
  const party = await prisma.party.findUnique({ where: { id: partyId } });
  if (!party) throw new GameError("Party not found.");
  return party;
}

async function requireUserInParty(partyId: string, userId: string): Promise<User> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.partyId !== partyId) {
    throw new GameError("You are not a member of this party.");
  }
  return user;
}

async function requireHost(partyId: string, userId: string): Promise<User> {
  const user = await requireUserInParty(partyId, userId);
  if (!user.isHost) throw new GameError("Only the host can do that.");
  return user;
}

function requirePhase(party: Party, ...allowed: GamePhase[]): void {
  if (!allowed.includes(party.gamePhase as GamePhase)) {
    throw new GameError("That action isn't available in the current game phase.");
  }
}

/** Generate a unique 3-digit numeric PIN, retrying on the rare collision. */
async function generateUniquePin(): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const code = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const existing = await prisma.party.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new GameError("Unable to allocate a party code. Please try again.");
}

/* -------------------------------------------------------------------------- */
/* Phase A — Hosting                                                          */
/* -------------------------------------------------------------------------- */

async function createParty(
  payload: CreatePartyPayload,
): Promise<{ partyId: string; userId: string }> {
  const hostName = validateName(payload.hostName);
  const party = await prisma.party.create({
    data: {
      code: await generateUniquePin(),
      maxSongs: clampMaxSongs(payload.maxSongs),
      gamePhase: "HOSTING",
      users: {
        create: {
          name: hostName,
          avatarSeed: payload.hostAvatarSeed || hostName,
          isHost: true,
        },
      },
    },
    include: { users: true },
  });
  return { partyId: party.id, userId: party.users[0]!.id };
}

async function joinParty(
  payload: JoinPartyPayload,
): Promise<{ partyId: string; userId: string }> {
  const name = validateName(payload.name);
  const party = await prisma.party.findUnique({
    where: { code: (payload.code ?? "").trim() },
  });
  if (!party) throw new GameError("No party found with that code.");
  if ((party.gamePhase as GamePhase) !== "HOSTING") {
    throw new GameError("This party has already started — you can't join now.");
  }
  const user = await prisma.user.create({
    data: {
      name,
      avatarSeed: payload.avatarSeed || name,
      isHost: false,
      partyId: party.id,
    },
  });
  return { partyId: party.id, userId: user.id };
}

async function updateConfig(payload: ConfigUpdatePayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);

  const incoming = payload.config;
  const data: Prisma.PartyUpdateInput = {};

  // maxSongs is the only field allowed during SUBMITTING (players may already have
  // queued songs, so the host can adjust the limit mid-submission).
  if (incoming.maxSongs !== undefined) {
    requirePhase(party, "HOSTING", "SUBMITTING");
    data.maxSongs = clampMaxSongs(incoming.maxSongs);
  }

  const hasToggleChanges =
    incoming.hideSong !== undefined ||
    incoming.hideSubmitterIdentities !== undefined ||
    incoming.hideLeaderboardUntilEnd !== undefined;

  if (hasToggleChanges) {
    requirePhase(party, "HOSTING");

    if (incoming.hideLeaderboardUntilEnd !== undefined) {
      data.hideLeaderboardUntilEnd = incoming.hideLeaderboardUntilEnd;
    }

    if (incoming.hideSong !== undefined) data.hideSong = incoming.hideSong;
    if (incoming.hideSubmitterIdentities !== undefined) {
      data.hideSubmitterIdentities = incoming.hideSubmitterIdentities;
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.party.update({ where: { id: party.id }, data });
  }
}

/* -------------------------------------------------------------------------- */
/* Phase B — Submitting                                                       */
/* -------------------------------------------------------------------------- */

async function startSubmitting(payload: ActorPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);
  requirePhase(party, "HOSTING");
  await prisma.party.update({
    where: { id: party.id },
    data: { gamePhase: "SUBMITTING" },
  });
}

async function removeSong(payload: RemoveSongPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  await requireUserInParty(payload.partyId, payload.userId);
  requirePhase(party, "SUBMITTING");

  const item = await prisma.queueItem.findFirst({
    where: { id: payload.queueItemId, partyId: party.id },
  });
  if (!item) throw new GameError("Song not found.");
  if (item.addedByUserId !== payload.userId) {
    throw new GameError("You can only remove your own songs.");
  }

  await prisma.queueItem.delete({ where: { id: item.id } });
}

async function addSong(payload: AddSongPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  const user = await requireUserInParty(payload.partyId, payload.userId);
  requirePhase(party, "SUBMITTING");
  validateTrack(payload.track);

  const existingCount = await prisma.queueItem.count({
    where: { partyId: party.id, addedByUserId: user.id },
  });
  if (existingCount >= party.maxSongs) {
    throw new GameError(
      `You've reached the limit of ${party.maxSongs} song${party.maxSongs === 1 ? "" : "s"}.`,
    );
  }

  console.log(`[addSong] Fetching BPM for track: ${payload.track.spotifyTrackId} (${payload.track.title})`);
  const bpm = await getTrackBpm(payload.track.spotifyTrackId);
  console.log(`[addSong] Got BPM: ${bpm} for track: ${payload.track.spotifyTrackId}`);

  await prisma.queueItem.create({
    data: {
      partyId: party.id,
      addedByUserId: user.id,
      spotifyTrackId: payload.track.spotifyTrackId,
      title: payload.track.title,
      artist: payload.track.artist,
      albumArtUrl: payload.track.albumArtUrl,
      previewUrl: payload.track.previewUrl ?? null,
      bpm,
    },
  });
  console.log(`[addSong] Successfully created queue item with BPM: ${bpm}`);
}

/* -------------------------------------------------------------------------- */
/* Phase C — Ranking / Guessing                                               */
/* -------------------------------------------------------------------------- */

async function startRounds(payload: ActorPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);
  requirePhase(party, "SUBMITTING");

  const firstTrack = await prisma.queueItem.findFirst({
    where: { partyId: party.id },
    orderBy: { createdAt: "asc" },
  });
  if (!firstTrack) {
    throw new GameError("Add at least one song before starting the rounds.");
  }

  await prisma.party.update({
    where: { id: party.id },
    data: { gamePhase: "RANKING", currentTrackId: firstTrack.id },
  });
}

async function loadActiveTrack(party: Party, queueItemId: string) {
  if (queueItemId !== party.currentTrackId) {
    throw new GameError("You can only act on the track that is currently playing.");
  }
  const item = await prisma.queueItem.findUnique({ where: { id: queueItemId } });
  if (!item || item.partyId !== party.id) throw new GameError("Track not found.");
  if (item.revealed) throw new GameError("This round has already been revealed.");
  return item;
}

async function castVote(payload: CastVotePayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  const user = await requireUserInParty(payload.partyId, payload.userId);
  requirePhase(party, "RANKING");

  if (
    !Number.isInteger(payload.rating) ||
    payload.rating < MIN_RATING ||
    payload.rating > MAX_RATING
  ) {
    throw new GameError(`Rating must be a whole number from ${MIN_RATING} to ${MAX_RATING}.`);
  }

  const item = await loadActiveTrack(party, payload.queueItemId);

  // Ghost voting: a submitter MAY rate their own track so they don't expose
  // their identity by sitting idle. The vote is still recorded (and surfaced
  // as round activity), but it must never move the song's ranking total —
  // `calculateRoundScore` likewise discards it from the points math.
  const isGhostRating = item.addedByUserId === user.id;

  // Race-safe rating: inside one transaction we read the previous rating,
  // compute the delta, and apply it to the running total with `increment`.
  // Concurrent socket hits therefore never clobber `totalRatingScore`.
  await prisma.$transaction(async (tx) => {
    const existing = await tx.roundSubmission.findUnique({
      where: { queueItemId_userId: { queueItemId: item.id, userId: user.id } },
    });

    await tx.roundSubmission.upsert({
      where: { queueItemId_userId: { queueItemId: item.id, userId: user.id } },
      create: {
        partyId: party.id,
        queueItemId: item.id,
        userId: user.id,
        rating: payload.rating,
      },
      update: { rating: payload.rating },
    });

    if (!isGhostRating) {
      const delta = payload.rating - (existing?.rating ?? UNRATED);
      if (delta !== 0) {
        await tx.queueItem.update({
          where: { id: item.id },
          data: { totalRatingScore: { increment: delta } },
        });
      }
    }
  });
}


async function revealRound(
  payload: ActorPayload,
  connectedUserIds: string[],
): Promise<RoundResult> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);
  requirePhase(party, "RANKING");

  if (!party.currentTrackId) throw new GameError("There is no active round to reveal.");

  const item = await prisma.queueItem.findUnique({
    where: { id: party.currentTrackId },
    include: { addedBy: true, submissions: { include: { voter: true } } },
  });
  if (!item) throw new GameError("Active track not found.");
  if (item.revealed) throw new GameError("This round has already been revealed.");

  const score = calculateRoundScore({
    submitterId: item.addedByUserId,
    guessingEnabled: false,
    submissions: item.submissions.map((s) => ({
      userId: s.userId,
      rating: s.rating,
      guessedUserId: null,
    })),
    connectedUserIds,
  });

  // Mark revealed, give the track its Sonic Signature song-ranking bonus, and
  // apply every User.score point award — all atomically.
  await prisma.$transaction([
    prisma.queueItem.update({
      where: { id: item.id },
      data: {
        revealed: true,
        ...(score.songRankingBonus > 0
          ? { totalRatingScore: { increment: score.songRankingBonus } }
          : {}),
      },
    }),
    ...score.pointAwards.map((award) =>
      prisma.user.update({
        where: { id: award.userId },
        data: { score: { increment: award.points } },
      }),
    ),
  ]);

  return {
    queueItemId: item.id,
    title: item.title,
    artist: item.artist,
    albumArtUrl: item.albumArtUrl,
    submitterId: item.addedByUserId,
    submitterName: item.addedBy.name,
    // Reflect the post-bonus value persisted above.
    totalRatingScore: item.totalRatingScore + score.songRankingBonus,
    ratingsCount: score.ratingsCount,
    averageRating: score.averageRating,
    sonicSignatureAwarded: score.sonicSignatureAwarded,
    pointAwards: score.pointAwards,
  };
}

/**
 * Advance to the next track. If the current track hasn't been scored yet,
 * score it before advancing. Returns `advanced: false` when the last track
 * has been scored — the caller then runs `finalReveal`.
 */
async function nextSong(
  payload: ActorPayload,
  connectedUserIds: string[],
): Promise<{ advanced: boolean }> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);
  requirePhase(party, "RANKING");

  if (!party.currentTrackId) throw new GameError("Rounds haven't started yet.");

  const current = await prisma.queueItem.findUnique({
    where: { id: party.currentTrackId },
    include: { addedBy: true, submissions: { include: { voter: true } } },
  });
  if (!current) throw new GameError("Active track not found.");

  // Score the current track if not already revealed
  if (!current.revealed) {
    const score = calculateRoundScore({
      submitterId: current.addedByUserId,
      guessingEnabled: false,
      submissions: current.submissions.map((s) => ({
        userId: s.userId,
        rating: s.rating,
        guessedUserId: null,
      })),
      connectedUserIds,
    });

    // Mark revealed, give the track its Sonic Signature bonus, and apply point awards
    await prisma.$transaction([
      prisma.queueItem.update({
        where: { id: current.id },
        data: {
          revealed: true,
          ...(score.songRankingBonus > 0
            ? { totalRatingScore: { increment: score.songRankingBonus } }
            : {}),
        },
      }),
      ...score.pointAwards.map((award) =>
        prisma.user.update({
          where: { id: award.userId },
          data: { score: { increment: award.points } },
        }),
      ),
    ]);
  } else {
    // Already revealed, just mark it
    await prisma.queueItem.update({
      where: { id: current.id },
      data: { revealed: true },
    });
  }

  const next = await prisma.queueItem.findFirst({
    where: { partyId: party.id, revealed: false },
    orderBy: { createdAt: "asc" },
  });

  if (next) {
    await prisma.party.update({
      where: { id: party.id },
      data: { currentTrackId: next.id },
    });
    return { advanced: true };
  }

  return { advanced: false };
}

/**
 * Authorize a host playback action (play/pause). The play/pause state itself
 * is ephemeral coordination held in the realtime runtime, not the database, so
 * this only performs the host + phase guard.
 */
async function authorizePlayback(payload: ActorPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);
  requirePhase(party, "RANKING");
}

/* -------------------------------------------------------------------------- */
/* Phase D — Reveal                                                           */
/* -------------------------------------------------------------------------- */

async function computeFinalResults(partyId: string): Promise<FinalResults> {
  const [queue, users] = await Promise.all([
    prisma.queueItem.findMany({
      where: { partyId },
      include: { addedBy: true, submissions: true },
      orderBy: [{ totalRatingScore: "desc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({
      where: { partyId },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  const songRankings: SongRankingEntry[] = queue.map((track, index) => {
    const nonGhostRatings = track.submissions.filter((s) => s.userId !== track.addedByUserId);
    const ratingsCount = nonGhostRatings.length;
    const averageRating = ratingsCount > 0 ? track.totalRatingScore / ratingsCount : 0;

    return {
      rank: index + 1,
      queueItemId: track.id,
      title: track.title,
      artist: track.artist,
      albumArtUrl: track.albumArtUrl,
      spotifyTrackId: track.spotifyTrackId,
      totalRatingScore: track.totalRatingScore,
      ratingsCount,
      averageRating,
      submitterId: track.addedByUserId,
      submitterName: track.addedBy.name,
    };
  });

  const leaderboard: LeaderboardEntry[] = users.map((user, index) => ({
    rank: index + 1,
    userId: user.id,
    name: user.name,
    avatarSeed: user.avatarSeed,
    score: user.score,
  }));

  return { songRankings, leaderboard, winningSong: songRankings[0] ?? null };
}

/** Transition into REVEAL: unlock all metadata and compute final standings. */
async function finalReveal(partyId: string): Promise<FinalResults> {
  await prisma.$transaction([
    prisma.queueItem.updateMany({ where: { partyId }, data: { revealed: true } }),
    prisma.party.update({
      where: { id: partyId },
      data: { gamePhase: "REVEAL", currentTrackId: null },
    }),
  ]);
  return computeFinalResults(partyId);
}

/** Host permanently ends the game and deletes all party data. */
async function terminateParty(payload: ActorPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);

  await prisma.$transaction([
    prisma.roundSubmission.deleteMany({ where: { partyId: party.id } }),
    prisma.queueItem.deleteMany({ where: { partyId: party.id } }),
    prisma.user.deleteMany({ where: { partyId: party.id } }),
    prisma.party.delete({ where: { id: party.id } }),
  ]);
}

/**
 * "Return to Lobby": keep all submitted songs but reset all votes, scores, and
 * revealed flags so the game can be replayed from the lobby. New players can
 * join because the party re-enters HOSTING.
 */
async function returnToLobby(payload: ActorPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);
  requirePhase(party, "SUBMITTING", "RANKING", "REVEAL");

  await prisma.$transaction([
    prisma.roundSubmission.deleteMany({ where: { partyId: party.id } }),
    prisma.queueItem.updateMany({
      where: { partyId: party.id },
      data: { revealed: false, totalRatingScore: 0 },
    }),
    prisma.user.updateMany({ where: { partyId: party.id }, data: { score: 0 } }),
    prisma.party.update({
      where: { id: party.id },
      data: { gamePhase: "HOSTING", currentTrackId: null },
    }),
  ]);
}

/**
 * "Play Again": wipe the round data, zero every score, and drop the party back
 * to HOSTING — without disturbing the connected players, so the same room
 * rolls straight into a fresh match.
 */
async function playAgain(payload: ActorPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);

  await prisma.$transaction([
    prisma.roundSubmission.deleteMany({ where: { partyId: party.id } }),
    prisma.queueItem.deleteMany({ where: { partyId: party.id } }),
    prisma.user.updateMany({ where: { partyId: party.id }, data: { score: 0 } }),
    prisma.party.update({
      where: { id: party.id },
      data: { gamePhase: "HOSTING", currentTrackId: null },
    }),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Read model                                                                 */
/* -------------------------------------------------------------------------- */

async function getRawPartyState(partyId: string): Promise<RawPartyState> {
  const party = await prisma.party.findUnique({
    where: { id: partyId },
    include: {
      users: { orderBy: { createdAt: "asc" } },
      queue: { orderBy: { createdAt: "asc" } },
      submissions: true,
    },
  });
  if (!party) throw new GameError("Party not found.");
  return party;
}

export const partyService = {
  createParty,
  joinParty,
  updateConfig,
  startSubmitting,
  addSong,
  removeSong,
  startRounds,
  castVote,
  authorizePlayback,
  revealRound,
  nextSong,
  finalReveal,
  computeFinalResults,
  returnToLobby,
  playAgain,
  terminateParty,
  getRawPartyState,
  requireUserInParty,
};
