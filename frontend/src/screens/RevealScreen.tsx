import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useParty } from "../party/NeroPartyContext";
import { Header } from "../components/Header";
import { Avatar } from "../components/Avatar";

type RevealPhase = "waiting" | "song" | "bronze" | "silver" | "gold" | "full";

export default function RevealScreen() {
  const { state, isHost, playAgain, returnToLobby } = useParty();
  const results = state.finalResults;
  const [phase, setPhase] = useState<RevealPhase>("waiting");

  useEffect(() => {
    if (!results) { setPhase("waiting"); return; }
    const timers = [
      setTimeout(() => setPhase("song"),   600),
      setTimeout(() => setPhase("bronze"), 3000),
      setTimeout(() => setPhase("silver"), 5000),
      setTimeout(() => {
        setPhase("gold");
        void confetti({
          particleCount: 200,
          spread: 80,
          origin: { y: 0.5 },
          colors: ["#FFD700", "#FFA500", "#FF6347", "#7DF9FF", "#50C878"],
        });
      }, 7000),
      setTimeout(() => setPhase("full"), 9500),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!results]);

  if (!results) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          loading final results…
        </div>
      </div>
    );
  }

  const gold   = results.leaderboard[0];
  const silver = results.leaderboard[1];
  const bronze = results.leaderboard[2];

  const showSong   = phase !== "waiting";
  const showBronze = ["bronze", "silver", "gold", "full"].includes(phase);
  const showSilver = ["silver", "gold", "full"].includes(phase);
  const showGold   = ["gold", "full"].includes(phase);
  const showFull   = phase === "full";

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto w-full max-w-3xl space-y-10 px-6 py-10">
        {/* Winning song */}
        {showSong && results.winningSong && (
          <div className="animate-fade-up text-center">
            <p className="mb-4 text-xs uppercase tracking-widest text-muted-foreground">
              winning song
            </p>
            <div className="inline-block rounded-2xl border-2 border-dashed border-success/60 bg-card px-8 py-8 shadow-lg">
              {results.winningSong.albumArtUrl && (
                <img
                  src={results.winningSong.albumArtUrl}
                  alt=""
                  className="mx-auto mb-4 h-40 w-40 rounded-xl object-cover shadow-md"
                />
              )}
              <h1 className="mb-1 text-2xl">{results.winningSong.title}</h1>
              <p className="mb-1 text-sm text-muted-foreground">{results.winningSong.artist}</p>
              <p className="text-xs text-muted-foreground">
                submitted by {results.winningSong.submitterName}
              </p>
              <p className="mt-3 text-sm">{results.winningSong.totalRatingScore} pts</p>
            </div>
          </div>
        )}

        {/* Podium — always in DOM once bronze phase begins so layout is stable */}
        {showBronze && (
          <div>
            <p className="mb-6 text-center text-xs uppercase tracking-widest text-muted-foreground">
              final standings
            </p>

            {/* Mobile: vertical stack; Desktop: horizontal podium (items-end) */}
            <div className="flex flex-col items-center gap-6 md:flex-row md:items-end md:justify-center md:gap-4">
              {/* Silver — 2nd place (left on desktop) */}
              {silver && (
                <div
                  className={`flex flex-col items-center transition-all duration-700 md:order-1 ${
                    showSilver ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                  }`}
                >
                  <div className="mb-2 text-2xl">🥈</div>
                  <div className="w-32 rounded-xl border border-border bg-card px-4 py-4 text-center">
                    <Avatar name={silver.name} seed={silver.avatarSeed} size="md" />
                    <p className="mt-2 text-sm font-medium truncate">{silver.name}</p>
                    <p className="text-xs text-muted-foreground">{silver.score} pts</p>
                  </div>
                  <div className="h-14 w-full rounded-b-sm bg-border/40 hidden md:block" />
                </div>
              )}

              {/* Gold — 1st place (center on desktop) */}
              {gold && (
                <div
                  className={`flex flex-col items-center transition-all duration-700 md:order-2 ${
                    showGold ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                  }`}
                >
                  <div className="mb-2 text-3xl">🥇</div>
                  <div className="w-40 rounded-xl border-2 border-yellow-400/60 bg-card px-5 py-5 text-center shadow-lg shadow-yellow-400/10">
                    <Avatar name={gold.name} seed={gold.avatarSeed} size="lg" />
                    <p className="mt-2 text-base font-semibold truncate">{gold.name}</p>
                    <p className="text-sm text-muted-foreground">{gold.score} pts</p>
                  </div>
                  <div className="h-24 w-full rounded-b-sm bg-border/40 hidden md:block" />
                </div>
              )}

              {/* Bronze — 3rd place (right on desktop) */}
              {bronze && (
                <div
                  className="animate-pop-in flex flex-col items-center md:order-3"
                >
                  <div className="mb-2 text-2xl">🥉</div>
                  <div className="w-28 rounded-xl border border-border bg-card px-3 py-3 text-center">
                    <Avatar name={bronze.name} seed={bronze.avatarSeed} size="md" />
                    <p className="mt-2 text-xs font-medium truncate">{bronze.name}</p>
                    <p className="text-xs text-muted-foreground">{bronze.score} pts</p>
                  </div>
                  <div className="h-6 w-full rounded-b-sm bg-border/40 hidden md:block" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Full leaderboard + song rankings — after ceremony */}
        {showFull && (
          <>
            {results.leaderboard.length > 0 && (
              <section className="animate-fade-up rounded-2xl border border-border bg-card p-6">
                <h2 className="mb-4 text-base">full leaderboard</h2>
                <ul className="space-y-3">
                  {results.leaderboard.map((u) => {
                    const songs = results.songRankings.filter(
                      (s) => s.submitterId === u.userId,
                    );
                    return (
                      <li key={u.userId}>
                        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-input/40 px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-center text-sm text-muted-foreground">{u.rank}</span>
                            <Avatar name={u.name} seed={u.avatarSeed} size="sm" />
                            <span className="text-sm">{u.name}</span>
                          </div>
                          <div className="text-sm">{u.score} pts</div>
                        </div>
                        {songs.length > 0 && (
                          <ul className="mt-1 ml-9 space-y-0.5">
                            {songs.map((s) => (
                              <li
                                key={s.queueItemId}
                                className="flex items-center justify-between gap-2 text-xs text-muted-foreground/70"
                              >
                                <span className="truncate">{s.title}</span>
                                <span className="shrink-0">{s.totalRatingScore} pts</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            <section className="animate-fade-up rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-4 text-base">song rankings</h2>
              <ul className="space-y-2">
                {results.songRankings.map((s) => (
                  <li
                    key={s.queueItemId}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-input/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-sm text-muted-foreground">{s.rank}</span>
                      {s.albumArtUrl && (
                        <img src={s.albumArtUrl} alt="" className="h-8 w-8 rounded object-cover" />
                      )}
                      <div>
                        <div className="text-sm">{s.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.artist} · by {s.submitterName}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm">{s.totalRatingScore} pts</div>
                  </li>
                ))}
              </ul>
            </section>

            <div className="animate-fade-up flex justify-center">
              {isHost ? (
                <button
                  type="button"
                  onClick={playAgain}
                  className="btn-interactive rounded-full border border-border bg-card px-8 py-3 text-sm"
                >
                  play again
                </button>
              ) : (
                <p className="text-sm text-muted-foreground animate-breathe">waiting for the host…</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
