import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "../party/types";

const SOCKET_URL = "http://localhost:3000";

/** Strongly-typed Socket.IO client — events and payloads are checked end to end. */
export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const socket: TypedSocket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
});
