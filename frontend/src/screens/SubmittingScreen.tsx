import { useState, useEffect } from "react";
import { useParty } from "../party/NeroPartyContext";
import { Header } from "../components/Header";
import { useSpotifySearch } from "../lib/spotifyClient";
import type { TrackInput } from "../party/types";

function SearchPanel({ onAdd }: { onAdd: (track: TrackInput) => void }) {
  const [query, setQuery] = useState("");
  const { results, loading } = useSpotifySearch(query);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for a song…"
        className="w-full rounded-md bg-border px-3 py-2 text-sm focus:outline-none"
      />

      {loading && (
        <p className="text-xs text-muted-foreground">Searching…</p>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="text-xs text-muted-foreground">No results</p>
      )}

      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((track) => (
            <li key={track.spotifyTrackId}>
              <button
                type="button"
                onClick={() => {
                  onAdd(track);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 rounded-md border border-border bg-input/40 px-3 py-2 text-left hover:bg-white/10 transition-all duration-200"
              >
                {track.albumArtUrl ? (
                  <img
                    src={track.albumArtUrl}
                    alt=""
                    className="h-10 w-10 rounded object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-sm">{track.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {track.artist}
                  </div>
                </div>
                {!track.previewUrl && (
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    No preview
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DOT_SEQ = [0, 1, 2, 3, 3, 3, 3, 3, 3];

export default function SubmittingScreen() {
  const [dotIdx, setDotIdx] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const dots = DOT_SEQ[dotIdx]!;
  useEffect(() => {
    const id = setInterval(() => setDotIdx((i) => (i + 1) % DOT_SEQ.length), 120);
    return () => clearInterval(id);
  }, []);
  const { state, isHost, addSong, removeSong, startRounds, returnToLobby } = useParty();

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { startRounds(); return; }
    const id = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, startRounds]);
  const party = state.party;
  if (!party) return null;
  const maxSongs = party.config.maxSongs;

  const myQueueItems = state.queue.filter((q) => q.isOwn);
  const mySubmittedCount = myQueueItems.length;
  const canSubmitMore = mySubmittedCount < maxSongs;

  const countByUser = new Map<string, number>();
  state.submissionProgress?.perUser.forEach((p) =>
    countByUser.set(p.userId, p.count),
  );

  const everyoneHasOne = state.participants
    .filter((p) => p.online)
    .every((p) => (countByUser.get(p.id) ?? 0) >= 1);

  const isUnder = mySubmittedCount < 1;
  const isOver = mySubmittedCount > maxSongs;
  const countColor = isUnder || isOver ? "text-muted-foreground" : "text-foreground";
  const countTip = isUnder
    ? "Submit at least one song to play"
    : isOver
      ? `Remove ${mySubmittedCount - maxSongs} song${mySubmittedCount - maxSongs === 1 ? "" : "s"} — you're over the limit`
      : `Submit up to ${maxSongs} song${maxSongs === 1 ? "" : "s"}`;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Three-column layout */}
        <div className="flex-1 flex flex-col">
          <div className="mx-auto w-[75%] px-6 py-8 flex-1 flex gap-8">
            {/* Left sidebar: room */}
            <aside className="flex-0 w-40 shrink-0">
              {isHost && (
                <button
                  type="button"
                  onClick={returnToLobby}
                  className="mb-4 block text-sm text-muted-foreground hover:text-foreground transition-colors duration-300"
                >
                  ← Return to lobby
                </button>
              )}
              <h3 className="mb-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold">room</h3>
              <div className="divide-y divide-border border-y border-border">
                {state.participants.filter((p) => p.online).map((p) => {
                  const count = countByUser.get(p.id) ?? 0;
                  const ready = count >= 1;
                  return (
                    <div
                      key={p.id}
                      className="text-xs py-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-foreground truncate">{p.name}</span>
                        <span className={`shrink-0 tabular-nums text-xs ${ready ? "text-foreground" : "text-muted-foreground"}`}>
                          {count}/{maxSongs}
                        </span>
                      </div>
                      {p.isHost && (
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          host
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Center: Main content */}
            <div className="flex-1 min-w-0 space-y-8">
            <button
              type="button"
              className="mb-4 block text-sm text-muted-foreground hover:text-foreground transition-colors duration-300 invisible"
            >
              ← return to lobby
            </button>
            <h1 className="text-3xl font-semibold text-center -mt-4">Song Selection</h1>
            <section
              className="rounded-2xl border border-border bg-card p-6 max-w-lg mx-auto"
              style={{
                backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><line x1="0" y1="0" x2="60" y2="60" stroke="rgba(128,128,128,0.04)" stroke-width="0.8"/><line x1="0" y1="15" x2="60" y2="75" stroke="rgba(128,128,128,0.04)" stroke-width="0.8"/><line x1="0" y1="30" x2="60" y2="90" stroke="rgba(128,128,128,0.04)" stroke-width="0.8"/><line x1="0" y1="45" x2="60" y2="105" stroke="rgba(128,128,128,0.04)" stroke-width="0.8"/><line x1="15" y1="0" x2="75" y2="60" stroke="rgba(128,128,128,0.04)" stroke-width="0.8"/><line x1="30" y1="0" x2="90" y2="60" stroke="rgba(128,128,128,0.04)" stroke-width="0.8"/><line x1="45" y1="0" x2="105" y2="60" stroke="rgba(128,128,128,0.04)" stroke-width="0.8"/></svg>'), linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), linear-gradient(45deg, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 100%)`,
                boxShadow: 'inset 0 0 30px rgba(255,255,255,0.04)'
              }}
            >
              <div className="mb-4 relative flex items-center justify-center">
                <h2 className="text-base">Submit your songs here</h2>
                <div className="absolute right-0">
                <div className="group relative cursor-default rounded px-2 py-0.5 transition-colors hover:bg-border">
                  <span className={`text-sm ${countColor}`}>
                    {mySubmittedCount} / {maxSongs}
                  </span>
                  {countTip && (
                    <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                      {countTip}
                    </span>
                  )}
                </div>
                </div>
              </div>

              {myQueueItems.length > 0 && (
                <ul className="mb-4 space-y-1">
                  {myQueueItems.map((q, idx) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-input/30 transition-colors duration-200 rounded"
                    >
                      <span className="text-4xl text-muted-foreground w-12 shrink-0 tabular-nums font-semibold">{idx + 1}.</span>
                      {q.albumArtUrl ? (
                        <img
                          src={q.albumArtUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{q.title ?? "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {q.artist ?? "—"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSong(q.id)}
                        aria-label="Remove song"
                        className="shrink-0 flex h-8 w-8 items-center justify-center rounded border border-border text-muted-foreground hover:bg-border hover:text-destructive transition-colors duration-300 text-xl cursor-default"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {canSubmitMore ? (
                <SearchPanel onAdd={addSong} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  You've added the maximum {maxSongs} songs.
                </p>
              )}
            </section>

            <div className="flex justify-center">
              {isHost ? (
                <div className="relative group">
                  <button
                    type="button"
                    onClick={() => setCountdown(3)}
                    disabled={!everyoneHasOne}
                    className="btn-interactive rounded-full border border-border bg-card px-8 py-3 text-sm disabled:opacity-50 hover:bg-card/70 transition-colors duration-300"
                  >
                    Start rounds
                  </button>
                  {!everyoneHasOne && (
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 z-10 mb-2 w-max rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                      Waiting for everyone to submit at least one song
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {mySubmittedCount > 0
                    ? <>Waiting for the host to start the rounds<span style={{ display: 'inline-block', width: '1.5ch', textAlign: 'left' }}>{'.'.repeat(dots)}</span></>
                    : "Submit at least one song to get started."}
                </p>
              )}
            </div>
            </div>

            {/* Right sidebar */}
            <aside className="flex-0 w-40 shrink-0">
              <div className="space-y-2">
              </div>
            </aside>
          </div>
        </div>
      </main>

      {countdown !== null && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <p className="text-muted-foreground text-lg mb-4 tracking-wide">Game Starts in</p>
          <div className="h-36 flex items-center justify-center">
            {countdown > 0 && (
              <div
                key={countdown}
                className="text-9xl font-bold"
                style={{ animation: 'countdown-pop 1s ease-out forwards' }}
              >
                {countdown}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
