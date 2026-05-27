import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { env } from "./env.js";
import { registerSocketHandlers } from "./realtime/handlers.js";
import { searchTracks } from "./services/deezerService.js";
import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./types/events.js";

const app = express();
const server = createServer(app);

const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Music search proxy (Deezer)
app.get("/api/spotify/search", async (req, res) => {
  const q = (req.query.q as string | undefined)?.trim();
  if (!q) {
    res.status(400).json({ error: "q is required" });
    return;
  }
  try {
    const tracks = await searchTracks(q);
    res.json(tracks);
  } catch (err) {
    console.error("[deezer]", err);
    res.status(502).json({ error: "Search failed" });
  }
});

// Real-time party state machine
registerSocketHandlers(io);

server.listen(env.PORT, () => {
  console.log(`Server running on http://localhost:${env.PORT}`);
});
