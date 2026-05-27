import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { socket } from "../lib/socket";
import { initialPartyState, partyReducer } from "./partyReducer";
import type {
  AckResult,
  ClientToServerEvents,
  FinalResults,
  ParticipantSnapshot,
  PartyConfigSnapshot,
  PartyState,
  PartyStateSnapshot,
  QueueItemSnapshot,
  RoundResult,
  Session,
  SessionResult,
  SubmissionProgress,
  TrackInput,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Session persistence (survives a page reload)                               */
/* -------------------------------------------------------------------------- */

const SESSION_KEY = "nero-party:session";

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.partyId === "string" && typeof parsed.userId === "string") {
      return { partyId: parsed.partyId, userId: parsed.userId };
    }
    return null;
  } catch {
    return null;
  }
}

function storeSession(session: Session): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

/* -------------------------------------------------------------------------- */
/* Promise wrapper around an acknowledged socket emit                          */
/* -------------------------------------------------------------------------- */

/**
 * Emit an event and resolve/reject from its acknowledgement. A built-in
 * `.timeout()` guarantees the promise always settles — the optimistic layer
 * relies on this so a vote can never get stuck "pending" forever.
 */
function request<T = null>(
  event: keyof ClientToServerEvents,
  payload: unknown,
  timeoutMs = 6000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // socket.io's typed `.timeout().emit()` overloads can't be expressed
    // generically; the cast is contained entirely within this helper.
    (socket.timeout(timeoutMs) as unknown as {
      emit: (
        event: string,
        payload: unknown,
        ack: (err: unknown, res: AckResult<T> | undefined) => void,
      ) => void;
    }).emit(event, payload, (err, res) => {
      if (err) {
        reject(new Error("The server took too long to respond."));
        return;
      }
      if (!res) {
        reject(new Error("No response from the server."));
        return;
      }
      if (!res.ok) {
        reject(new Error(res.error));
        return;
      }
      resolve(res.data);
    });
  });
}

/* -------------------------------------------------------------------------- */
/* Context value                                                              */
/* -------------------------------------------------------------------------- */

export interface NeroPartyContextValue {
  state: PartyState;
  /** The current participant, resolved from the session. */
  me: ParticipantSnapshot | null;
  /** The QueueItem currently being ranked, if any. */
  currentTrack: QueueItemSnapshot | null;
  isHost: boolean;

  // Phase A — hosting. createParty/joinParty resolve when the request settles
  // (they never reject — failures surface on `state.error`), so callers can
  // `await` them to drive a local submitting state.
  createParty: (hostName: string, hostAvatarSeed: string, maxSongs: number) => Promise<void>;
  joinParty: (code: string, name: string, avatarSeed: string) => Promise<void>;
  updateConfig: (config: Partial<PartyConfigSnapshot>) => void;

  // Phase B — submitting
  startSubmitting: () => void;
  addSong: (track: TrackInput) => void;
  removeSong: (queueItemId: string) => void;

  // Phase C — ranking / guessing
  startRounds: () => void;
  castVote: (queueItemId: string, rating: number) => void;
  submitGuess: (queueItemId: string, guessedUserId: string) => void;
  play: () => void;
  pause: () => void;
  revealRound: () => void;
  nextSong: () => void;

  // Phase D — reveal
  returnToLobby: () => void;
  playAgain: () => void;

  // Misc
  clearError: () => void;
  leaveParty: () => void;
  terminateRoom: () => void;
}

export const NeroPartyContext = createContext<NeroPartyContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/* Provider                                                                   */
/* -------------------------------------------------------------------------- */

export function NeroPartyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(partyReducer, initialPartyState);

  // Async ack callbacks fire well after the dispatch that scheduled them, so
  // they must read the *latest* state — not the value captured at call time.
  const stateRef = useRef(state);
  stateRef.current = state;

  /* ----- Socket lifecycle + server event ingestion ------------------- */

  useEffect(() => {
    function handleConnect() {
      console.log("Socket connected, ID:", socket.id);
      dispatch({ type: "CONNECTION_CHANGED", status: "connected" });
      // Reconnect / reload: silently re-attach to the existing party.
      const stored = loadSession();
      if (!stored) return;
      console.log("Registering session for partyId:", stored.partyId);
      request<SessionResult>("session:register", stored)
        .then((res) => {
          dispatch({ type: "SESSION_ESTABLISHED", session: stored });
          dispatch({ type: "PARTY_STATE", snapshot: res.party });
        })
        .catch(() => {
          clearSession();
          dispatch({ type: "RESET" });
        });
    }

    function handleDisconnect() {
      dispatch({ type: "CONNECTION_CHANGED", status: "disconnected" });
    }

    function handlePartyState(snapshot: PartyStateSnapshot) {
      console.log("[handlePartyState] received snapshot, currentTrackId:", snapshot.party.currentTrackId);
      dispatch({ type: "PARTY_STATE", snapshot });
    }

    function handleProgress(progress: SubmissionProgress) {
      dispatch({ type: "SUBMISSION_PROGRESS", progress });
    }

    function handlePlayback(payload: { isPlaying: boolean; startedAt?: number }) {
      dispatch({ type: "PLAYBACK_STATE", isPlaying: payload.isPlaying, startedAt: payload.startedAt });
    }

    function handleRoundResult(result: RoundResult) {
      dispatch({ type: "ROUND_RESULT", result });
    }

    function handleResults(results: FinalResults) {
      dispatch({ type: "FINAL_RESULTS", results });
    }

    function handleServerError(payload: { message: string }) {
      dispatch({ type: "ERROR", message: payload.message });
    }

    function handleRoomClosed() {
      console.log("Received room:closed event");
      clearSession();
      dispatch({ type: "RESET" });
      dispatch({ type: "NOTIFICATION", message: "The game has ended." });
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("party:state", handlePartyState);
    socket.on("submission:progress", handleProgress);
    socket.on("playback:state", handlePlayback);
    socket.on("round:result", handleRoundResult);
    socket.on("game:results", handleResults);
    socket.on("error", handleServerError);
    socket.on("room:closed", handleRoomClosed);

    dispatch({ type: "CONNECTION_CHANGED", status: "connecting" });
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("party:state", handlePartyState);
      socket.off("submission:progress", handleProgress);
      socket.off("playback:state", handlePlayback);
      socket.off("round:result", handleRoundResult);
      socket.off("game:results", handleResults);
      socket.off("error", handleServerError);
      socket.off("room:closed", handleRoomClosed);
      socket.disconnect();
    };
  }, []);

  /* ----- Action: run something that needs an active session ---------- */

  const runWithSession = useCallback(
    async (run: (session: Session) => Promise<void>) => {
      console.log("[runWithSession] called");
      const session = stateRef.current.session;
      console.log("[runWithSession] session:", session);
      if (!session) {
        console.log("[runWithSession] no session, dispatching error");
        dispatch({ type: "ERROR", message: "You are not currently in a party." });
        return;
      }
      try {
        console.log("[runWithSession] calling run with session");
        await run(session);
        console.log("[runWithSession] run completed successfully");
      } catch (error) {
        console.error("[runWithSession] error:", error);
        dispatch({ type: "ERROR", message: errorMessage(error) });
      }
    },
    [],
  );

  /* ----- Phase A — hosting ------------------------------------------- */

  const createParty = useCallback(
    (hostName: string, hostAvatarSeed: string, maxSongs: number): Promise<void> => {
      return (async () => {
        try {
          if (!socket.connected) socket.connect();
          const res = await request<SessionResult>("party:create", {
            hostName,
            hostAvatarSeed,
            maxSongs,
          });
          const session: Session = {
            partyId: res.party.party.id,
            userId: res.user.id,
          };
          storeSession(session);
          dispatch({ type: "SESSION_ESTABLISHED", session });
          dispatch({ type: "PARTY_STATE", snapshot: res.party });
        } catch (error) {
          dispatch({ type: "ERROR", message: errorMessage(error) });
        }
      })();
    },
    [],
  );

  const joinParty = useCallback(
    (code: string, name: string, avatarSeed: string): Promise<void> => {
      return (async () => {
        try {
          if (!socket.connected) socket.connect();
          const res = await request<SessionResult>("party:join", {
            code,
            name,
            avatarSeed,
          });
          const session: Session = {
            partyId: res.party.party.id,
            userId: res.user.id,
          };
          storeSession(session);
          dispatch({ type: "SESSION_ESTABLISHED", session });
          dispatch({ type: "PARTY_STATE", snapshot: res.party });
        } catch (error) {
          dispatch({ type: "ERROR", message: errorMessage(error) });
        }
      })();
    },
    [],
  );

  const updateConfig = useCallback(
    (config: Partial<PartyConfigSnapshot>) => {
      void runWithSession((session) =>
        request("config:update", { ...session, config }),
      );
    },
    [runWithSession],
  );

  /* ----- Phase B — submitting ---------------------------------------- */

  const startSubmitting = useCallback(() => {
    void runWithSession((session) => request("phase:startSubmitting", session));
  }, [runWithSession]);

  const addSong = useCallback(
    (track: TrackInput) => {
      void runWithSession((session) =>
        request("song:add", { ...session, track }),
      );
    },
    [runWithSession],
  );

  const removeSong = useCallback(
    (queueItemId: string) => {
      void runWithSession((session) =>
        request("song:remove", { ...session, queueItemId }),
      );
    },
    [runWithSession],
  );

  /* ----- Phase C — ranking / guessing -------------------------------- */

  const startRounds = useCallback(() => {
    void runWithSession((session) => request("phase:startRounds", session));
  }, [runWithSession]);

  /**
   * Optimistic rating: the star selection lands in local state instantly,
   * then the server ack either confirms it or rolls it back to its previous
   * value. The previous value is captured *before* dispatch so the rollback
   * is exact.
   */
  const castVote = useCallback((queueItemId: string, rating: number) => {
    const session = stateRef.current.session;
    if (!session) {
      dispatch({ type: "ERROR", message: "You are not currently in a party." });
      return;
    }
    const previous = stateRef.current.myVotes[queueItemId];

    dispatch({ type: "OPTIMISTIC_RATING", queueItemId, rating });

    void (async () => {
      try {
        await request("round:castVote", { ...session, queueItemId, rating });
        dispatch({ type: "RATING_SETTLED", queueItemId });
      } catch (error) {
        // Defensive rollback — network timeout or a server rejection.
        dispatch({ type: "RATING_ROLLBACK", queueItemId, previous });
        dispatch({ type: "ERROR", message: errorMessage(error) });
      }
    })();
  }, []);

  /** Optimistic guess — same confirm/rollback contract as `castVote`. */
  const submitGuess = useCallback(
    (queueItemId: string, guessedUserId: string) => {
      const session = stateRef.current.session;
      if (!session) {
        dispatch({ type: "ERROR", message: "You are not currently in a party." });
        return;
      }
      const previous = stateRef.current.myVotes[queueItemId];

      dispatch({ type: "OPTIMISTIC_GUESS", queueItemId, guessedUserId });

      void (async () => {
        try {
          await request("round:submitGuess", {
            ...session,
            queueItemId,
            guessedUserId,
          });
          dispatch({ type: "GUESS_SETTLED", queueItemId });
        } catch (error) {
          dispatch({ type: "GUESS_ROLLBACK", queueItemId, previous });
          dispatch({ type: "ERROR", message: errorMessage(error) });
        }
      })();
    },
    [],
  );

  const play = useCallback(() => {
    void runWithSession((session) => request("playback:play", session));
  }, [runWithSession]);

  const pause = useCallback(() => {
    void runWithSession((session) => request("playback:pause", session));
  }, [runWithSession]);

  const revealRound = useCallback(() => {
    void runWithSession((session) => request("round:reveal", session));
  }, [runWithSession]);

  const nextSong = useCallback(() => {
    console.log("[nextSong] button clicked");
    void runWithSession((session) => {
      console.log("[nextSong] sending round:next request");
      return request("round:next", session);
    });
  }, [runWithSession]);

  /* ----- Phase D — reveal -------------------------------------------- */

  const returnToLobby = useCallback(() => {
    void runWithSession((session) => request("game:returnToLobby", session));
  }, [runWithSession]);

  const playAgain = useCallback(() => {
    void runWithSession((session) => request("game:playAgain", session));
  }, [runWithSession]);

  /* ----- Misc -------------------------------------------------------- */

  const clearError = useCallback(() => {
    dispatch({ type: "ERROR", message: null });
  }, []);

  const leaveParty = useCallback(() => {
    clearSession();
    dispatch({ type: "RESET" });
    socket.disconnect();
  }, []);

  const terminateRoom = useCallback(() => {
    const session = stateRef.current.session;
    if (!session) return;
    socket.emit("room:terminate", session);
    clearSession();
    dispatch({ type: "RESET" });
  }, []);

  /* ----- Derived selectors ------------------------------------------- */

  const me = useMemo<ParticipantSnapshot | null>(() => {
    if (!state.session) return null;
    return (
      state.participants.find((p) => p.id === state.session?.userId) ?? null
    );
  }, [state.participants, state.session]);

  const currentTrack = useMemo<QueueItemSnapshot | null>(() => {
    const id = state.party?.currentTrackId;
    if (!id) return null;
    return state.queue.find((q) => q.id === id) ?? null;
  }, [state.party?.currentTrackId, state.queue]);

  const value = useMemo<NeroPartyContextValue>(
    () => ({
      state,
      me,
      currentTrack,
      isHost: me?.isHost ?? false,
      createParty,
      joinParty,
      updateConfig,
      startSubmitting,
      addSong,
      removeSong,
      startRounds,
      castVote,
      submitGuess,
      play,
      pause,
      revealRound,
      nextSong,
      returnToLobby,
      playAgain,
      clearError,
      leaveParty,
      terminateRoom,
    }),
    [
      state,
      me,
      currentTrack,
      createParty,
      joinParty,
      updateConfig,
      startSubmitting,
      addSong,
      removeSong,
      startRounds,
      castVote,
      submitGuess,
      play,
      pause,
      revealRound,
      nextSong,
      returnToLobby,
      playAgain,
      clearError,
      leaveParty,
      terminateRoom,
    ],
  );

  return (
    <NeroPartyContext.Provider value={value}>
      {children}
    </NeroPartyContext.Provider>
  );
}

export function useParty() {
  const context = useContext(NeroPartyContext);
  if (!context) {
    throw new Error("useParty must be used within a NeroPartyProvider");
  }
  return context;
}
