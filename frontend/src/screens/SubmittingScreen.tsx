import { useState } from "react";
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
        placeholder="search for a song…"
        className="w-full rounded-md bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {loading && (
        <p className="text-xs text-muted-foreground">searching…</p>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <p className="text-xs text-muted-foreground">no results</p>
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
                className="flex w-full items-center gap-3 rounded-md border border-border bg-input/40 px-3 py-2 text-left hover:bg-input"
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
                    no preview
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

export default function SubmittingScreen() {
  const { state, isHost, addSong, removeSong, startRounds, returnToLobby } = useParty();
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
  const countColor = isUnder || isOver ? "text-destructive" : "text-success";
  const countTip = isUnder
    ? "Submit at least one song to play."
    : isOver
      ? `Remove ${mySubmittedCount - maxSongs} song${mySubmittedCount - maxSongs === 1 ? "" : "s"} — you're over the limit.`
      : null;

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
                  className="mb-4 block text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← return to lobby
                </button>
              )}
              <h3 className="mb-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold">room</h3>
              <div className="space-y-2">
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
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base">your song submissions</h2>
                <div className="group relative cursor-default rounded px-2 py-0.5 transition-colors hover:bg-input/50">
                  <span className={`text-sm ${countColor}`}>
                    {mySubmittedCount} / {maxSongs}
                  </span>
                  {countTip && (
                    <span className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-52 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                      {countTip}
                    </span>
                  )}
                </div>
              </div>

              {myQueueItems.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {myQueueItems.map((q) => (
                    <li
                      key={q.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-input/50 px-3 py-2"
                    >
                      {q.albumArtUrl ? (
                        <img
                          src={q.albumArtUrl}
                          alt=""
                          className="h-8 w-8 rounded object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted" />
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
                        className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
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
                  you've added the maximum {maxSongs} songs.
                </p>
              )}
            </section>

            <div className="flex justify-center">
              {isHost ? (
                <button
                  type="button"
                  onClick={startRounds}
                  disabled={!everyoneHasOne}
                  className="btn-interactive rounded-full border border-border bg-card px-8 py-3 text-sm disabled:opacity-50"
                >
                  {everyoneHasOne
                    ? "start rounds"
                    : "waiting for everyone to submit at least one…"}
                </button>
              ) : (
                <p className={`text-sm text-muted-foreground ${mySubmittedCount > 0 ? "animate-breathe" : ""}`}>
                  {mySubmittedCount > 0
                    ? "waiting for the host to start the rounds…"
                    : "submit at least one song to get started."}
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
    </div>
  );
}
