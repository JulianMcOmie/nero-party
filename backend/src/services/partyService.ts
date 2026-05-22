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
  RoundResult,
  SongRankingEntry,
  SubmitGuessPayload,
} from "../types/events.js";
import { calculateRoundScore } from "./scoring.js";

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

/** Generate a unique 4-digit numeric PIN, retrying on the rare collision. */
async function generateUniquePin(): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const code = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
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
  requirePhase(party, "HOSTING");

  const incoming = payload.config;
  const data: Prisma.PartyUpdateInput = {};

  if (incoming.maxSongs !== undefined) data.maxSongs = clampMaxSongs(incoming.maxSongs);
  if (incoming.hideSong !== undefined) data.hideSong = incoming.hideSong;
  if (incoming.hideSubmitterIdentities !== undefined) {
    data.hideSubmitterIdentities = incoming.hideSubmitterIdentities;
  }
  if (incoming.enableGuessingGame !== undefined) {
    data.enableGuessingGame = incoming.enableGuessingGame;
  }
  if (incoming.hideLeaderboardUntilEnd !== undefined) {
    data.hideLeaderboardUntilEnd = incoming.hideLeaderboardUntilEnd;
  }

  // Linked toggle constraint: a guessing game is meaningless if submitters are
  // visible, so enabling it forces `hideSubmitterIdentities` on — and keeps it
  // on even if the host tries to toggle it off in the same update.
  const guessingEnabled = incoming.enableGuessingGame ?? party.enableGuessingGame;
  if (guessingEnabled) data.hideSubmitterIdentities = true;

  await prisma.party.update({ where: { id: party.id }, data });
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

  await prisma.queueItem.create({
    data: {
      partyId: party.id,
      addedByUserId: user.id,
      spotifyTrackId: payload.track.spotifyTrackId,
      title: payload.track.title,
      artist: payload.track.artist,
      albumArtUrl: payload.track.albumArtUrl,
    },
  });
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

async function submitGuess(payload: SubmitGuessPayload): Promise<void> {
  const party = await requireParty(payload.partyId);
  const user = await requireUserInParty(payload.partyId, payload.userId);
  requirePhase(party, "RANKING");

  if (!party.enableGuessingGame) {
    throw new GameError("The guessing game isn't enabled for this party.");
  }

  // Ghost guessing: a submitter MAY guess on their own track to blend in —
  // `calculateRoundScore` discards the submitter's own guess from scoring.
  const item = await loadActiveTrack(party, payload.queueItemId);
  if (payload.guessedUserId === user.id) {
    throw new GameError("You can't guess yourself.");
  }

  const target = await prisma.user.findUnique({ where: { id: payload.guessedUserId } });
  if (!target || target.partyId !== party.id) {
    throw new GameError("That player isn't in this party.");
  }

  await prisma.roundSubmission.upsert({
    where: { queueItemId_userId: { queueItemId: item.id, userId: user.id } },
    create: {
      partyId: party.id,
      queueItemId: item.id,
      userId: user.id,
      rating: UNRATED,
      guessedUserId: payload.guessedUserId,
    },
    update: { guessedUserId: payload.guessedUserId },
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
    include: { addedBy: true, submissions: true },
  });
  if (!item) throw new GameError("Active track not found.");
  if (item.revealed) throw new GameError("This round has already been revealed.");

  const score = calculateRoundScore({
    submitterId: item.addedByUserId,
    guessingEnabled: party.enableGuessingGame,
    submissions: item.submissions.map((s) => ({
      userId: s.userId,
      rating: s.rating,
      guessedUserId: s.guessedUserId,
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
    correctGuesserIds: score.correctGuesserIds,
    sonicSignatureAwarded: score.sonicSignatureAwarded,
    pointAwards: score.pointAwards,
  };
}

/**
 * Advance to the next track. Requires the current round to be revealed first
 * so no round is ever skipped without being scored. Returns `advanced: false`
 * when the revealed track was the last one — the caller then runs `finalReveal`.
 */
async function nextSong(payload: ActorPayload): Promise<{ advanced: boolean }> {
  const party = await requireParty(payload.partyId);
  await requireHost(payload.partyId, payload.userId);
  requirePhase(party, "RANKING");

  if (!party.currentTrackId) throw new GameError("Rounds haven't started yet.");

  const current = await prisma.queueItem.findUnique({
    where: { id: party.currentTrackId },
  });
  if (!current) throw new GameError("Active track not found.");
  if (!current.revealed) {
    throw new GameError("Reveal the current round before moving on.");
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
      include: { addedBy: true },
      orderBy: [{ totalRatingScore: "desc" }, { createdAt: "asc" }],
    }),
    prisma.user.findMany({
      where: { partyId },
      orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  const songRankings: SongRankingEntry[] = queue.map((track, index) => ({
    rank: index + 1,
    queueItemId: track.id,
    title: track.title,
    artist: track.artist,
    albumArtUrl: track.albumArtUrl,
    spotifyTrackId: track.spotifyTrackId,
    totalRatingScore: track.totalRatingScore,
    submitterId: track.addedByUserId,
    submitterName: track.addedBy.name,
  }));

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
  startRounds,
  castVote,
  submitGuess,
  authorizePlayback,
  revealRound,
  nextSong,
  finalReveal,
  computeFinalResults,
  playAgain,
  getRawPartyState,
  requireUserInParty,
};
