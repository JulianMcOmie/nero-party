import { useParty } from "../party/NeroPartyContext";
import { Header } from "../components/Header";

export default function RevealScreen() {
  const { state, isHost, playAgain } = useParty();
  const results = state.finalResults;

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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto w-full max-w-3xl space-y-10 px-6 py-10">
        <section className="rounded-2xl border border-border bg-card p-6">
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

        <div className="flex justify-center">
          {isHost ? (
            <button
              type="button"
              onClick={playAgain}
              className="btn-interactive rounded-full border border-border bg-card px-8 py-3 text-sm hover:bg-card/70 transition-colors duration-300"
            >
              play again
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">waiting for the host…</p>
          )}
        </div>
      </main>
    </div>
  );
}
