import type { RemoteSocket, Server, Socket } from "socket.io";
import { toErrorMessage } from "../lib/errors.js";
import { partyService } from "../services/partyService.js";
import {
  computeSubmissionProgress,
  sanitizePartyState,
  toParticipantSnapshot,
} from "../services/sanitize.js";
import type {
  Ack,
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SessionResult,
  SocketData,
} from "../types/events.js";
import { runtime } from "./runtime.js";

type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;
type TypedRemoteSocket = RemoteSocket<ServerToClientEvents, SocketData>;

/**
 * Wraps a handler body: runs it, resolves the ack with the result, and
 * converts any thrown `GameError` (or unexpected error) into a structured
 * `{ ok: false }` ack. The frontend's optimistic layer depends on always
 * receiving exactly one definitive ack.
 */
async function handle<T>(
  ack: Ack<T> | undefined,
  body: () => Promise<T>,
): Promise<void> {
  try {
    const data = await body();
    if (typeof ack === "function") ack({ ok: true, data });
  } catch (error) {
    if (typeof ack === "function") {
      ack({ ok: false, error: toErrorMessage(error) });
    }
  }
}

/** Associate a freshly created/identified socket with its party + user. */
async function bindSession(
  socket: TypedSocket,
  partyId: string,
  userId: string,
): Promise<void> {
  socket.data.partyId = partyId;
  socket.data.userId = userId;
  await socket.join(partyId);
  runtime.bind(socket.id, partyId, userId);
}

/**
 * Push fresh, per-viewer sanitized state to every socket in the room. Each
 * viewer gets a snapshot stripped according to what *they* are allowed to see.
 */
async function broadcastPartyState(
  io: TypedServer,
  partyId: string,
): Promise<void> {
  let raw;
  try {
    raw = await partyService.getRawPartyState(partyId);
  } catch {
    return; // Party no longer exists — nothing to broadcast.
  }

  const onlineIds = new Set(runtime.onlineUserIds(partyId));
  const isPlaying = runtime.isPlaying(partyId);
  const sockets = (await io.in(partyId).fetchSockets()) as TypedRemoteSocket[];

  for (const member of sockets) {
    const viewerId = member.data.userId;
    if (!viewerId) continue;
    member.emit(
      "party:state",
      sanitizePartyState(raw, viewerId, onlineIds, isPlaying),
    );
  }
}

async function broadcastSubmissionProgress(
  io: TypedServer,
  partyId: string,
): Promise<void> {
  try {
    const raw = await partyService.getRawPartyState(partyId);
    io.to(partyId).emit("submission:progress", computeSubmissionProgress(raw));
  } catch {
    /* party gone */
  }
}

/** Build the create/join/register ack payload for a single user. */
async function buildSessionResult(
  partyId: string,
  userId: string,
): Promise<SessionResult> {
  const raw = await partyService.getRawPartyState(partyId);
  const snapshot = sanitizePartyState(
    raw,
    userId,
    new Set(runtime.onlineUserIds(partyId)),
    runtime.isPlaying(partyId),
  );
  return { party: snapshot, user: toParticipantSnapshot(snapshot, userId) };
}

export function registerSocketHandlers(io: TypedServer): void {
  io.on("connection", (socket: TypedSocket) => {
    /* ---------------------------------------------------------------- */
    /* Phase A — Hosting: create / join / re-register / configure       */
    /* ---------------------------------------------------------------- */

    socket.on("party:create", (payload, ack) => {
      void handle(ack, async () => {
        const { partyId, userId } = await partyService.createParty(payload);
        await bindSession(socket, partyId, userId);
        const result = await buildSessionResult(partyId, userId);
        await broadcastPartyState(io, partyId);
        return result;
      });
    });

    socket.on("party:join", (payload, ack) => {
      void handle(ack, async () => {
        const { partyId, userId } = await partyService.joinParty(payload);
        await bindSession(socket, partyId, userId);
        const result = await buildSessionResult(partyId, userId);
        await broadcastPartyState(io, partyId);
        return result;
      });
    });

    // Re-attach an existing user after a reload / reconnect.
    socket.on("session:register", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.requireUserInParty(payload.partyId, payload.userId);
        await bindSession(socket, payload.partyId, payload.userId);
        const result = await buildSessionResult(payload.partyId, payload.userId);
        await broadcastPartyState(io, payload.partyId);
        return result;
      });
    });

    socket.on("config:update", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.updateConfig(payload);
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    /* ---------------------------------------------------------------- */
    /* Phase B — Submitting                                             */
    /* ---------------------------------------------------------------- */

    socket.on("phase:startSubmitting", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.startSubmitting(payload);
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    socket.on("song:add", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.addSong(payload);
        await broadcastPartyState(io, payload.partyId);
        await broadcastSubmissionProgress(io, payload.partyId);
        return null;
      });
    });

    socket.on("song:remove", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.removeSong(payload);
        await broadcastPartyState(io, payload.partyId);
        await broadcastSubmissionProgress(io, payload.partyId);
        return null;
      });
    });

    /* ---------------------------------------------------------------- */
    /* Phase C — Ranking                                                */
    /* ---------------------------------------------------------------- */

    socket.on("phase:startRounds", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.startRounds(payload);
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    socket.on("round:castVote", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.castVote(payload);
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    socket.on("playback:play", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.authorizePlayback(payload);
        runtime.setPlaying(payload.partyId, true);
        io.to(payload.partyId).emit("playback:state", { isPlaying: true, startedAt: Date.now() });
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    socket.on("playback:pause", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.authorizePlayback(payload);
        runtime.setPlaying(payload.partyId, false);
        io.to(payload.partyId).emit("playback:state", { isPlaying: false });
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    socket.on("round:reveal", (payload, ack) => {
      void handle(ack, async () => {
        const connectedUserIds = runtime.onlineUserIds(payload.partyId);
        const result = await partyService.revealRound(payload, connectedUserIds);
        runtime.setPlaying(payload.partyId, false);
        io.to(payload.partyId).emit("playback:state", { isPlaying: false });
        io.to(payload.partyId).emit("round:result", result);
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    socket.on("round:next", (payload, ack) => {
      void handle(ack, async () => {
        const connectedUserIds = runtime.onlineUserIds(payload.partyId);
        const { advanced } = await partyService.nextSong(payload, connectedUserIds);
        runtime.setPlaying(payload.partyId, false);
        io.to(payload.partyId).emit("playback:state", { isPlaying: false });
        if (!advanced) {
          // Final song was revealed — transition straight into Phase D.
          const results = await partyService.finalReveal(payload.partyId);
          io.to(payload.partyId).emit("game:results", results);
        }
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    /* ---------------------------------------------------------------- */
    /* Phase D — Reveal: replay                                         */
    /* ---------------------------------------------------------------- */

    socket.on("game:returnToLobby", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.returnToLobby(payload);
        runtime.setPlaying(payload.partyId, false);
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    socket.on("game:playAgain", (payload, ack) => {
      void handle(ack, async () => {
        await partyService.playAgain(payload);
        runtime.setPlaying(payload.partyId, false);
        await broadcastPartyState(io, payload.partyId);
        return null;
      });
    });

    socket.on("room:terminate", (payload) => {
      void (async () => {
        try {
          await partyService.terminateParty(payload);
          const room = io.sockets.adapter.rooms.get(payload.partyId);
          console.log("Broadcasting room:closed to room:", payload.partyId);
          console.log("Sockets in room:", room);
          io.to(payload.partyId).emit("room:closed");
        } catch {
          // Party already gone or requester isn't host — nothing to broadcast.
        }
      })();
    });

    /* ---------------------------------------------------------------- */
    /* Presence                                                         */
    /* ---------------------------------------------------------------- */

    socket.on("disconnect", () => {
      const binding = runtime.unbind(socket.id);
      if (binding) {
        void broadcastPartyState(io, binding.partyId);
      }
    });
  });
}
