/**
 * End-to-end socket smoke test for the Nero Party core.
 *
 * Spawns the backend, drives a full 3-player game over real WebSocket
 * connections, and asserts the state machine + scoring behave correctly —
 * including the consolidated `User.score` and ghost voting/guessing rules.
 *
 * Run with: `npm run test:e2e`
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { io } from "socket.io-client";

const BACKEND_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const URL = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error("FAIL: " + message);
  passed++;
  console.log("  ok -", message);
}

/* --- socket helpers ------------------------------------------------------- */

function emit(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(event, payload, (err, res) => {
      if (err) return reject(new Error("timeout: " + event));
      if (!res || !res.ok) {
        return reject(new Error("rejected " + event + ": " + (res && res.error)));
      }
      resolve(res.data);
    });
  });
}

function makeClient() {
  return new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ["websocket"] });
    const box = { socket, state: null, roundResult: null, finalResults: null };
    socket.on("party:state", (st) => (box.state = st));
    socket.on("round:result", (r) => (box.roundResult = r));
    socket.on("game:results", (r) => (box.finalResults = r));
    socket.on("connect", () => resolve(box));
    socket.on("connect_error", reject);
  });
}

async function waitForServer(timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(URL + "/health");
      if (res.ok) return;
    } catch {
      /* not listening yet */
    }
    await sleep(300);
  }
  throw new Error("Backend did not become healthy in time.");
}

/* --- the scenario --------------------------------------------------------- */

async function runScenario() {
  const host = await makeClient();
  const p1 = await makeClient();
  const p2 = await makeClient();

  console.log("\n[Phase A] Hosting");
  const created = await emit(host.socket, "party:create", {
    hostName: "Host",
    hostAvatarSeed: "h",
    maxSongs: 1,
  });
  const partyId = created.party.party.id;
  const code = created.party.party.code;
  const hostId = created.user.id;
  assert(/^\d{3}$/.test(code), "3-digit numeric PIN generated (" + code + ")");

  await emit(host.socket, "config:update", {
    partyId,
    userId: hostId,
    config: { enableGuessingGame: true, hideSubmitterIdentities: false },
  });
  const j1 = await emit(p1.socket, "party:join", { code, name: "Alice", avatarSeed: "a" });
  const u1 = j1.user.id;
  const j2 = await emit(p2.socket, "party:join", { code, name: "Bob", avatarSeed: "b" });
  const u2 = j2.user.id;
  assert(
    j2.party.party.config.hideSubmitterIdentities === true,
    "enabling guessing game force-enables hideSubmitterIdentities (linked toggle)",
  );

  console.log("\n[Phase B] Submitting");
  await emit(host.socket, "phase:startSubmitting", { partyId, userId: hostId });
  await emit(host.socket, "song:add", {
    partyId, userId: hostId,
    track: { spotifyTrackId: "tH", title: "HostSong", artist: "X", albumArtUrl: "" },
  });
  await emit(p1.socket, "song:add", {
    partyId, userId: u1,
    track: { spotifyTrackId: "t1", title: "AliceSong", artist: "X", albumArtUrl: "" },
  });
  await emit(p2.socket, "song:add", {
    partyId, userId: u2,
    track: { spotifyTrackId: "t2", title: "BobSong", artist: "X", albumArtUrl: "" },
  });
  await sleep(150);

  let limitHit = false;
  try {
    await emit(p1.socket, "song:add", {
      partyId, userId: u1,
      track: { spotifyTrackId: "t1b", title: "x", artist: "X", albumArtUrl: "" },
    });
  } catch {
    limitHit = true;
  }
  assert(limitHit, "maxSongs=1 limit is enforced");

  const hostItemForP1 = p1.state.queue.find((q) => q.spotifyTrackId === "tH");
  assert(
    hostItemForP1 && hostItemForP1.addedByUserId === null,
    "submitter identity stripped from other players' stream",
  );
  const ownItemForP1 = p1.state.queue.find((q) => q.isOwn);
  assert(
    ownItemForP1 && ownItemForP1.addedByUserId === u1,
    "player still sees the identity of their own track",
  );
  assert(p1.state.submissionProgress.submitted === 3, "submission progress counts 3 songs");

  console.log("\n[Phase C] Ranking / Guessing");
  await emit(host.socket, "phase:startRounds", { partyId, userId: hostId });
  await sleep(150);

  const round1Track = host.state.party.currentTrackId;
  const hostQueueItem = host.state.queue.find((q) => q.spotifyTrackId === "tH");
  assert(round1Track === hostQueueItem.id, "round 1 active track is the first-added song");

  // Real players rate + correctly guess the host as submitter.
  await emit(p1.socket, "round:castVote", { partyId, userId: u1, queueItemId: round1Track, rating: 5 });
  await emit(p2.socket, "round:castVote", { partyId, userId: u2, queueItemId: round1Track, rating: 3 });
  await emit(p1.socket, "round:submitGuess", { partyId, userId: u1, queueItemId: round1Track, guessedUserId: hostId });
  await emit(p2.socket, "round:submitGuess", { partyId, userId: u2, queueItemId: round1Track, guessedUserId: hostId });
  await sleep(120);

  // Ghost voting/guessing: the submitter acts on their OWN track to blend in.
  let ghostAllowed = true;
  try {
    await emit(host.socket, "round:castVote", { partyId, userId: hostId, queueItemId: round1Track, rating: 5 });
    await emit(host.socket, "round:submitGuess", { partyId, userId: hostId, queueItemId: round1Track, guessedUserId: u1 });
  } catch {
    ghostAllowed = false;
  }
  await sleep(150);
  assert(ghostAllowed, "submitter can ghost-vote and ghost-guess on their own track");

  const hostActivity = p1.state.roundActivity.find((a) => a.userId === hostId);
  assert(
    hostActivity && hostActivity.hasRated && hostActivity.hasGuessed,
    "submitter's ghost activity is broadcast to the room as presence",
  );

  const tHForRoom = p2.state.queue.find((q) => q.spotifyTrackId === "tH");
  assert(
    tHForRoom && tHForRoom.totalRatingScore === 8,
    "ghost self-rating carries 0 weight in the song ranking total (5 + 3 = 8)",
  );

  await emit(host.socket, "round:reveal", { partyId, userId: hostId });
  await sleep(150);
  const rr = host.roundResult;
  assert(
    rr && rr.totalRatingScore === 9,
    "round result total = 8 ratings + 1 Sonic Signature song bonus = 9",
  );
  assert(rr.correctGuesserIds.length === 2, "only the 2 real guessers count");
  assert(
    !rr.correctGuesserIds.includes(hostId),
    "submitter's ghost guess is discarded from scoring",
  );
  assert(rr.sonicSignatureAwarded === true, "Sonic Signature awarded (100% >= 50%)");

  const tHRevealed = host.state.queue.find((q) => q.spotifyTrackId === "tH");
  assert(
    tHRevealed && tHRevealed.totalRatingScore === 9,
    "Sonic Signature adds +1 to the track's QueueItem.totalRatingScore (8 -> 9)",
  );

  const songRatingAward = rr.pointAwards.find((a) => a.reason === "song_rating");
  assert(
    songRatingAward && songRatingAward.userId === hostId && songRatingAward.points === 8,
    "submitter earns song-rating points equal to received ratings (8)",
  );
  const sonicAward = rr.pointAwards.find((a) => a.reason === "sonic_signature");
  assert(sonicAward && sonicAward.userId === hostId, "submitter earns the Sonic Signature point");
  const guessAwards = rr.pointAwards.filter((a) => a.reason === "correct_guess");
  assert(guessAwards.length === 2, "both correct guessers earn a point");

  // Advance through the remaining rounds to reach the final reveal.
  await emit(host.socket, "round:next", { partyId, userId: hostId });
  await sleep(100);
  await emit(host.socket, "round:reveal", { partyId, userId: hostId });
  await sleep(100);
  await emit(host.socket, "round:next", { partyId, userId: hostId });
  await sleep(100);
  await emit(host.socket, "round:reveal", { partyId, userId: hostId });
  await sleep(100);

  console.log("\n[Phase D] Reveal");
  await emit(host.socket, "round:next", { partyId, userId: hostId });
  await sleep(200);
  assert(host.finalResults != null, "final results broadcast after last round");
  assert(host.state.party.gamePhase === "REVEAL", "party transitioned to REVEAL phase");
  assert(host.finalResults.songRankings.length === 3, "song rankings include all 3 tracks");
  assert(
    host.finalResults.winningSong != null &&
      host.finalResults.winningSong.submitterId === hostId,
    "the host's track is crowned the winning song",
  );

  const hostRanking = host.finalResults.songRankings.find(
    (s) => s.submitterId === hostId,
  );
  assert(
    hostRanking && hostRanking.totalRatingScore === 9,
    "Sonic Signature song bonus persists into the final Song Rankings (9)",
  );

  const board = (id) => host.finalResults.leaderboard.find((e) => e.userId === id);
  assert(
    board(hostId).score === 9,
    "host User.score = 8 song ratings + 1 Sonic Signature (consolidated total)",
  );
  assert(board(u1).score === 1, "correct guesser's point lands on the unified leaderboard");

  console.log("\n[Play Again]");
  await emit(host.socket, "game:playAgain", { partyId, userId: hostId });
  await sleep(200);
  assert(host.state.party.gamePhase === "HOSTING", "Play Again reverts to HOSTING");
  assert(host.state.queue.length === 0, "Play Again wipes the queue");
  assert(host.state.participants.length === 3, "Play Again keeps connected players");
  assert(
    host.state.participants.every((p) => p.score === 0),
    "Play Again resets all scores to 0",
  );

  host.socket.close();
  p1.socket.close();
  p2.socket.close();
}

/* --- runner --------------------------------------------------------------- */

async function main() {
  const server = spawn("npm", ["run", "dev"], {
    cwd: BACKEND_ROOT,
    detached: true,
    stdio: "ignore",
  });

  let exitCode = 0;
  try {
    await waitForServer();
    await runScenario();
    console.log("\nAll " + passed + " assertions passed.");
  } catch (error) {
    console.error("\n" + (error && error.message ? error.message : error));
    exitCode = 1;
  } finally {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      /* server process already gone */
    }
  }
  process.exit(exitCode);
}

main();
