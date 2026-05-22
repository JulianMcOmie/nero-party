import type {
  LocalVote,
  PartyAction,
  PartyState,
  PartyStateSnapshot,
  ViewerVoteSnapshot,
} from "./types";

export const initialPartyState: PartyState = {
  connection: "idle",
  session: null,
  party: null,
  participants: [],
  queue: [],
  submissionProgress: null,
  playback: { isPlaying: false },
  roundActivity: [],
  myVotes: {},
  lastRoundResult: null,
  finalResults: null,
  error: null,
};

/**
 * Fold a server `party:state` snapshot into the local optimistic vote map.
 *
 * The server is the source of truth, EXCEPT for selections that are still
 * in-flight (`pending`): clobbering those would make the UI flicker back to a
 * stale value mid-request. Pending entries are preserved; everything else
 * adopts the server's value. This is also what makes a false-timeout
 * self-heal — once the rollback clears the `pending` flag, the next snapshot
 * reconciles the row to the truth the server already broadcast.
 */
function reconcileVotes(
  local: Record<string, LocalVote>,
  serverVotes: ViewerVoteSnapshot[],
): Record<string, LocalVote> {
  const next: Record<string, LocalVote> = {};

  for (const vote of serverVotes) {
    next[vote.queueItemId] = {
      rating: vote.rating,
      guessedUserId: vote.guessedUserId,
      ratingStatus: vote.rating > 0 ? "confirmed" : "idle",
      guessStatus: vote.guessedUserId ? "confirmed" : "idle",
    };
  }

  for (const [queueItemId, localVote] of Object.entries(local)) {
    const ratingPending = localVote.ratingStatus === "pending";
    const guessPending = localVote.guessStatus === "pending";
    if (!ratingPending && !guessPending) continue;

    const server = next[queueItemId];
    next[queueItemId] = {
      rating: ratingPending ? localVote.rating : server?.rating ?? localVote.rating,
      guessedUserId: guessPending
        ? localVote.guessedUserId
        : server?.guessedUserId ?? localVote.guessedUserId,
      ratingStatus: ratingPending
        ? "pending"
        : server?.ratingStatus ?? localVote.ratingStatus,
      guessStatus: guessPending
        ? "pending"
        : server?.guessStatus ?? localVote.guessStatus,
    };
  }

  return next;
}

function applySnapshot(
  state: PartyState,
  snapshot: PartyStateSnapshot,
): PartyState {
  return {
    ...state,
    party: snapshot.party,
    participants: snapshot.participants,
    queue: snapshot.queue,
    submissionProgress: snapshot.submissionProgress,
    playback: snapshot.playback,
    roundActivity: snapshot.roundActivity,
    myVotes: reconcileVotes(state.myVotes, snapshot.myVotes),
    // A fresh round (Play Again / next song) clears stale result banners.
    lastRoundResult:
      snapshot.party.gamePhase === "HOSTING" ? null : state.lastRoundResult,
    finalResults:
      snapshot.party.gamePhase === "REVEAL" ? state.finalResults : null,
  };
}

/** An empty optimistic vote row. */
function emptyVote(): LocalVote {
  return {
    rating: 0,
    guessedUserId: null,
    ratingStatus: "idle",
    guessStatus: "idle",
  };
}

/**
 * The single, rigid reducer for all party state. Every transition is a pure
 * function of `(state, action)` — no side effects, no async.
 */
export function partyReducer(
  state: PartyState,
  action: PartyAction,
): PartyState {
  switch (action.type) {
    case "CONNECTION_CHANGED":
      return { ...state, connection: action.status };

    case "SESSION_ESTABLISHED":
      return { ...state, session: action.session, error: null };

    case "PARTY_STATE":
      return applySnapshot(state, action.snapshot);

    case "SUBMISSION_PROGRESS":
      return { ...state, submissionProgress: action.progress };

    case "PLAYBACK_STATE":
      return { ...state, playback: { isPlaying: action.isPlaying } };

    case "ROUND_RESULT":
      return { ...state, lastRoundResult: action.result };

    case "FINAL_RESULTS":
      return { ...state, finalResults: action.results };

    case "ERROR":
      return { ...state, error: action.message };

    /* ----- Optimistic rating ----------------------------------------- */

    case "OPTIMISTIC_RATING": {
      const current = state.myVotes[action.queueItemId] ?? emptyVote();
      return {
        ...state,
        myVotes: {
          ...state.myVotes,
          [action.queueItemId]: {
            ...current,
            rating: action.rating,
            ratingStatus: "pending",
          },
        },
      };
    }

    case "RATING_SETTLED": {
      const current = state.myVotes[action.queueItemId];
      if (!current) return state;
      return {
        ...state,
        myVotes: {
          ...state.myVotes,
          [action.queueItemId]: { ...current, ratingStatus: "confirmed" },
        },
      };
    }

    case "RATING_ROLLBACK": {
      const next = { ...state.myVotes };
      if (action.previous) {
        next[action.queueItemId] = { ...action.previous };
      } else {
        delete next[action.queueItemId];
      }
      return { ...state, myVotes: next };
    }

    /* ----- Optimistic guess ------------------------------------------ */

    case "OPTIMISTIC_GUESS": {
      const current = state.myVotes[action.queueItemId] ?? emptyVote();
      return {
        ...state,
        myVotes: {
          ...state.myVotes,
          [action.queueItemId]: {
            ...current,
            guessedUserId: action.guessedUserId,
            guessStatus: "pending",
          },
        },
      };
    }

    case "GUESS_SETTLED": {
      const current = state.myVotes[action.queueItemId];
      if (!current) return state;
      return {
        ...state,
        myVotes: {
          ...state.myVotes,
          [action.queueItemId]: { ...current, guessStatus: "confirmed" },
        },
      };
    }

    case "GUESS_ROLLBACK": {
      const next = { ...state.myVotes };
      if (action.previous) {
        next[action.queueItemId] = { ...action.previous };
      } else {
        delete next[action.queueItemId];
      }
      return { ...state, myVotes: next };
    }

    case "RESET":
      return { ...initialPartyState, connection: state.connection };

    default:
      return state;
  }
}
