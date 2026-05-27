import type { GamePhase } from "./domain.js";

/**
 * The full Socket.IO contract for Nero Party.
 *
 * Every client->server event uses an acknowledgement callback returning an
 * `AckResult`. This gives the frontend a definitive success/failure signal,
 * which the optimistic UI layer relies on to confirm or roll back.
 *
 * The frontend mirrors these types in `frontend/src/party/types.ts`. Keep the
 * two in sync when changing the contract.
 */

/* -------------------------------------------------------------------------- */
/* Acknowledgement envelope                                                   */
/* -------------------------------------------------------------------------- */

export type AckResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type Ack<T> = (result: AckResult<T>) => void;

/* -------------------------------------------------------------------------- */
/* Wire snapshots (what clients actually receive — already sanitized)         */
/* -------------------------------------------------------------------------- */

export interface ParticipantSnapshot {
  id: string;
  name: string;
  avatarSeed: string;
  isHost: boolean;
  online: boolean;
  /** null when `hideLeaderboardUntilEnd` is active and the game is not in REVEAL. */
  score: number | null;
}

export interface QueueItemSnapshot {
  id: string;
  /** Always present — needed for playback even in blind-listening mode. */
  spotifyTrackId: string;
  /** Always present — the 30-second preview clip URL, null if Spotify has none. */
  previewUrl: string | null;
  /** null when `hideSong` is active and the track is unrevealed (and not yours). */
  title: string | null;
  artist: string | null;
  albumArtUrl: string | null;
  /** null when `hideSubmitterIdentities` is active and unrevealed (and not yours). */
  addedByUserId: string | null;
  totalRatingScore: number;
  revealed: boolean;
  /** True when the viewer submitted this track — owners always see their own data. */
  isOwn: boolean;
}

export interface PartyConfigSnapshot {
  maxSongs: number;
  hideSong: boolean;
  hideSubmitterIdentities: boolean;
  hideLeaderboardUntilEnd: boolean;
}

export interface SubmissionProgress {
  /** Total tracks added to the queue so far. */
  submitted: number;
  /** Target total: participants x maxSongs. */
  total: number;
  /** Per-participant counts, so the UI can show "your 2/4" as well as the room total. */
  perUser: { userId: string; count: number }[];
}

/** The viewer's own rating for a track — echoed back for reconnection. */
export interface ViewerVoteSnapshot {
  queueItemId: string;
  rating: number;
}

/**
 * Per-participant interaction status for the active round. This is presence
 * only — it never carries the rating value. It lets a submitter "ghost vote"
 * and blend in rather than exposing their identity by conspicuously sitting idle.
 */
export interface RoundActivityEntry {
  userId: string;
  hasRated: boolean;
}

/** The single unified state object pushed on every `party:state` event. */
export interface PartyStateSnapshot {
  viewerUserId: string;
  party: {
    id: string;
    code: string;
    gamePhase: GamePhase;
    currentTrackId: string | null;
    config: PartyConfigSnapshot;
  };
  participants: ParticipantSnapshot[];
  queue: QueueItemSnapshot[];
  submissionProgress: SubmissionProgress;
  playback: { isPlaying: boolean };
  /** Who has rated on the current track — empty outside the RANKING phase. */
  roundActivity: RoundActivityEntry[];
  /** The viewer's own votes — lets the optimistic layer reconcile after reconnect. */
  myVotes: ViewerVoteSnapshot[];
}

/* -------------------------------------------------------------------------- */
/* Round + final result payloads                                              */
/* -------------------------------------------------------------------------- */

export interface PointAward {
  userId: string;
  points: number;
  reason: "sonic_signature" | "song_rating";
}

export interface RoundResult {
  queueItemId: string;
  title: string;
  artist: string;
  albumArtUrl: string;
  submitterId: string;
  submitterName: string;
  totalRatingScore: number;
  ratingsCount: number;
  averageRating: number;
  sonicSignatureAwarded: boolean;
  pointAwards: PointAward[];
}

export interface SongRankingEntry {
  rank: number;
  queueItemId: string;
  title: string;
  artist: string;
  albumArtUrl: string;
  spotifyTrackId: string;
  totalRatingScore: number;
  submitterId: string;
  submitterName: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarSeed: string;
  score: number;
}

export interface FinalResults {
  songRankings: SongRankingEntry[];
  leaderboard: LeaderboardEntry[];
  winningSong: SongRankingEntry | null;
}

/* -------------------------------------------------------------------------- */
/* Client -> Server payloads                                                  */
/* -------------------------------------------------------------------------- */

export interface CreatePartyPayload {
  hostName: string;
  hostAvatarSeed: string;
  maxSongs: number;
}

export interface JoinPartyPayload {
  code: string;
  name: string;
  avatarSeed: string;
}

export interface SessionRegisterPayload {
  partyId: string;
  userId: string;
}

/** Identifies the actor for any party-scoped action. */
export interface ActorPayload {
  partyId: string;
  userId: string;
}

export interface ConfigUpdatePayload extends ActorPayload {
  config: Partial<PartyConfigSnapshot>;
}

export interface AddSongPayload extends ActorPayload {
  track: {
    spotifyTrackId: string;
    title: string;
    artist: string;
    albumArtUrl: string;
    previewUrl: string | null;
  };
}

export interface RemoveSongPayload extends ActorPayload {
  queueItemId: string;
}

export interface CastVotePayload extends ActorPayload {
  queueItemId: string;
  rating: number;
}


export interface SessionResult {
  party: PartyStateSnapshot;
  user: ParticipantSnapshot;
}

/* -------------------------------------------------------------------------- */
/* Typed event maps for the Socket.IO server                                  */
/* -------------------------------------------------------------------------- */

export interface ClientToServerEvents {
  "party:create": (payload: CreatePartyPayload, ack: Ack<SessionResult>) => void;
  "party:join": (payload: JoinPartyPayload, ack: Ack<SessionResult>) => void;
  "session:register": (payload: SessionRegisterPayload, ack: Ack<SessionResult>) => void;

  "config:update": (payload: ConfigUpdatePayload, ack: Ack<null>) => void;

  "phase:startSubmitting": (payload: ActorPayload, ack: Ack<null>) => void;
  "song:add": (payload: AddSongPayload, ack: Ack<null>) => void;
  "song:remove": (payload: RemoveSongPayload, ack: Ack<null>) => void;

  "phase:startRounds": (payload: ActorPayload, ack: Ack<null>) => void;
  "round:castVote": (payload: CastVotePayload, ack: Ack<null>) => void;

  "playback:play": (payload: ActorPayload, ack: Ack<null>) => void;
  "playback:pause": (payload: ActorPayload, ack: Ack<null>) => void;
  "round:reveal": (payload: ActorPayload, ack: Ack<null>) => void;
  "round:next": (payload: ActorPayload, ack: Ack<null>) => void;

  "game:returnToLobby": (payload: ActorPayload, ack: Ack<null>) => void;
  "game:playAgain": (payload: ActorPayload, ack: Ack<null>) => void;
  "room:terminate": (payload: ActorPayload) => void;
}

export interface ServerToClientEvents {
  "party:state": (state: PartyStateSnapshot) => void;
  "submission:progress": (progress: SubmissionProgress) => void;
  "playback:state": (state: { isPlaying: boolean; startedAt?: number }) => void;
  "round:result": (result: RoundResult) => void;
  "game:results": (results: FinalResults) => void;
  "error": (error: { message: string }) => void;
  "room:closed": () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

/** Per-socket session binding, set once the socket is associated with a user. */
export interface SocketData {
  userId?: string;
  partyId?: string;
}
