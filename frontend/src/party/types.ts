/**
 * Frontend mirror of the backend Socket.IO contract
 * (`backend/src/types/events.ts`) plus the frontend-only reducer state model.
 *
 * Keep the wire types in sync with the backend when the contract changes.
 */

/* -------------------------------------------------------------------------- */
/* Domain                                                                     */
/* -------------------------------------------------------------------------- */

export type GamePhase = "HOSTING" | "SUBMITTING" | "RANKING" | "REVEAL";

/* -------------------------------------------------------------------------- */
/* Acknowledgement envelope                                                   */
/* -------------------------------------------------------------------------- */

export type AckResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/* -------------------------------------------------------------------------- */
/* Wire snapshots                                                             */
/* -------------------------------------------------------------------------- */

export interface ParticipantSnapshot {
  id: string;
  name: string;
  avatarSeed: string;
  isHost: boolean;
  online: boolean;
  score: number | null;
}

export interface QueueItemSnapshot {
  id: string;
  spotifyTrackId: string;
  previewUrl: string | null;
  title: string | null;
  artist: string | null;
  albumArtUrl: string | null;
  addedByUserId: string | null;
  totalRatingScore: number;
  revealed: boolean;
  isOwn: boolean;
  bpm: number | null;
}

export interface PartyConfigSnapshot {
  maxSongs: number;
  hideSong: boolean;
  hideSubmitterIdentities: boolean;
  hideLeaderboardUntilEnd: boolean;
}

export interface SubmissionProgress {
  submitted: number;
  total: number;
  perUser: { userId: string; count: number }[];
}

export interface ViewerVoteSnapshot {
  queueItemId: string;
  rating: number;
}

/**
 * Presence-only interaction status for the active round — "has acted" booleans,
 * never the value. Powers the ghost-voting "everyone looks active" display.
 */
export interface RoundActivityEntry {
  userId: string;
  hasRated: boolean;
}

export interface PartySnapshot {
  id: string;
  code: string;
  gamePhase: GamePhase;
  currentTrackId: string | null;
  config: PartyConfigSnapshot;
}

export interface PartyStateSnapshot {
  viewerUserId: string;
  party: PartySnapshot;
  participants: ParticipantSnapshot[];
  queue: QueueItemSnapshot[];
  submissionProgress: SubmissionProgress;
  playback: { isPlaying: boolean; startedAt?: number };
  roundActivity: RoundActivityEntry[];
  myVotes: ViewerVoteSnapshot[];
}

/* -------------------------------------------------------------------------- */
/* Round + final results                                                      */
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
  ratingsCount: number;
  averageRating: number;
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

export interface ActorPayload {
  partyId: string;
  userId: string;
}

export interface ConfigUpdatePayload extends ActorPayload {
  config: Partial<PartyConfigSnapshot>;
}

export interface TrackInput {
  spotifyTrackId: string;
  title: string;
  artist: string;
  albumArtUrl: string;
  previewUrl: string | null;
  bpm: number | null;
}

export interface AddSongPayload extends ActorPayload {
  track: TrackInput;
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
/* Typed event maps for socket.io-client                                      */
/* -------------------------------------------------------------------------- */

export interface ServerToClientEvents {
  "party:state": (state: PartyStateSnapshot) => void;
  "submission:progress": (progress: SubmissionProgress) => void;
  "playback:state": (state: { isPlaying: boolean; startedAt?: number }) => void;
  "round:result": (result: RoundResult) => void;
  "game:results": (results: FinalResults) => void;
  "error": (error: { message: string }) => void;
  "room:closed": () => void;
}

export interface ClientToServerEvents {
  "party:create": (payload: CreatePartyPayload, ack: (r: AckResult<SessionResult>) => void) => void;
  "party:join": (payload: JoinPartyPayload, ack: (r: AckResult<SessionResult>) => void) => void;
  "session:register": (payload: SessionRegisterPayload, ack: (r: AckResult<SessionResult>) => void) => void;
  "config:update": (payload: ConfigUpdatePayload, ack: (r: AckResult<null>) => void) => void;
  "phase:startSubmitting": (payload: ActorPayload, ack: (r: AckResult<null>) => void) => void;
  "song:add": (payload: AddSongPayload, ack: (r: AckResult<null>) => void) => void;
  "song:remove": (payload: RemoveSongPayload, ack: (r: AckResult<null>) => void) => void;
  "phase:startRounds": (payload: ActorPayload, ack: (r: AckResult<null>) => void) => void;
  "round:castVote": (payload: CastVotePayload, ack: (r: AckResult<null>) => void) => void;
  "playback:play": (payload: ActorPayload, ack: (r: AckResult<null>) => void) => void;
  "playback:pause": (payload: ActorPayload, ack: (r: AckResult<null>) => void) => void;
  "round:reveal": (payload: ActorPayload, ack: (r: AckResult<null>) => void) => void;
  "round:next": (payload: ActorPayload, ack: (r: AckResult<null>) => void) => void;
  "game:returnToLobby": (payload: ActorPayload, ack: (r: AckResult<null>) => void) => void;
  "game:playAgain": (payload: ActorPayload, ack: (r: AckResult<null>) => void) => void;
  "room:terminate": (payload: ActorPayload) => void;
}

/* -------------------------------------------------------------------------- */
/* Frontend reducer state model                                               */
/* -------------------------------------------------------------------------- */

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected";

/** Lifecycle of a single optimistic selection. */
export type VoteStatus = "idle" | "pending" | "confirmed" | "error";

/** The viewer's local rating for one song, including in-flight status. */
export interface LocalVote {
  /** 0 = not yet rated. */
  rating: number;
  ratingStatus: VoteStatus;
}

export interface Session {
  partyId: string;
  userId: string;
}

/**
 * The single unified state object. The reducer is the only thing that may
 * produce a new version of it.
 */
export interface PartyState {
  connection: ConnectionStatus;
  session: Session | null;
  party: PartySnapshot | null;
  participants: ParticipantSnapshot[];
  queue: QueueItemSnapshot[];
  submissionProgress: SubmissionProgress | null;
  playback: { isPlaying: boolean; startedAt?: number };
  /** Who has rated on the current track — presence only, no values. */
  roundActivity: RoundActivityEntry[];
  /** Keyed by queueItemId — the optimistic vote layer. */
  myVotes: Record<string, LocalVote>;
  lastRoundResult: RoundResult | null;
  finalResults: FinalResults | null;
  error: string | null;
  notification: string | null;
}

export type PartyAction =
  | { type: "CONNECTION_CHANGED"; status: ConnectionStatus }
  | { type: "SESSION_ESTABLISHED"; session: Session }
  | { type: "PARTY_STATE"; snapshot: PartyStateSnapshot }
  | { type: "SUBMISSION_PROGRESS"; progress: SubmissionProgress }
  | { type: "PLAYBACK_STATE"; isPlaying: boolean; startedAt?: number }
  | { type: "ROUND_RESULT"; result: RoundResult }
  | { type: "FINAL_RESULTS"; results: FinalResults }
  | { type: "ERROR"; message: string | null }
  | { type: "NOTIFICATION"; message: string }
  | { type: "OPTIMISTIC_RATING"; queueItemId: string; rating: number }
  | { type: "RATING_SETTLED"; queueItemId: string }
  | { type: "RATING_ROLLBACK"; queueItemId: string; previous: LocalVote | undefined }
  | { type: "RESET" };
