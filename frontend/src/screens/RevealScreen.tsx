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

  const winner = results.songRankings[0];
  const rest = results.songRankings.slice(1);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="mx-auto w-full max-w-2xl space-y-10 px-6 py-10">
        <h2 className="text-center text-5xl font-bold tracking-tight" style={{ animation: 'fadeIn 0.6s ease-out forwards' }}>
          Final Rankings
        </h2>

        {winner && (
          <section
            className="flex flex-col items-center justify-center gap-4 py-8"
            style={{ animation: 'revealSlideUp 0.8s ease-out 0.3s both' }}
          >
            <div
              className="flex items-center justify-center h-48 w-48 rounded-lg"
              style={{
                overflow: 'visible',
                boxShadow: '0 0 25px rgba(255, 255, 255, 0.08), 0 0 40px rgba(255, 255, 255, 0.03)',
              }}
            >
              {winner.albumArtUrl ? (
                <img src={winner.albumArtUrl} alt="" className="h-full w-full rounded-lg object-cover" />
              ) : (
                <div className="text-6xl text-muted-foreground/50">♪</div>
              )}
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold">{winner.title}</h3>
              <p className="text-sm text-muted-foreground mb-2">
                {winner.artist} · by {winner.submitterName}
              </p>
              <p className="text-2xl font-bold text-foreground">{(winner.averageRating ?? 0).toFixed(1)}</p>
            </div>
          </section>
        )}

        {rest.length > 0 && (
          <section className="space-y-2">
            <ul className="space-y-2">
              {rest.map((s, idx) => (
                <li
                  key={s.queueItemId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-input/40 px-3 py-2"
                  style={{ animation: `revealSlideUp 0.35s ease-out ${1.3 + idx * 0.12}s both` }}
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
                  <div className="text-sm">{(s.averageRating ?? 0).toFixed(1)}</div>
                </li>
              ))}
            </ul>
          </section>
        )}

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
