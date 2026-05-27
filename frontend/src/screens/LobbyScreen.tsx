import { useParty } from "../party/NeroPartyContext";
import { Header } from "../components/Header";

export default function LobbyScreen() {
  const { state, isHost, updateConfig, startSubmitting } = useParty();
  const party = state.party;
  if (!party) return null;
  const config = party.config;

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 flex flex-col">
        {/* Three-column layout */}
        <div className="flex-1 flex flex-col">
          <div className="mx-auto w-[75%] px-6 py-8 flex-1 flex gap-8">
            {/* Left sidebar: room */}
            <aside className="flex-0 w-40 shrink-0">
              <h3 className="mb-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold">room</h3>
              <div className="space-y-2">
                {state.participants.filter((p) => p.online).map((p) => (
                  <div
                    key={p.id}
                    className="text-xs py-2"
                  >
                    <div className="font-medium text-foreground">{p.name}</div>
                    {p.isHost && (
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        host
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </aside>

            {/* Center: Main content */}
            <div className="flex-1 min-w-0 space-y-8">
            <section className="rounded-2xl border-2 border-dashed border-border bg-card/40 px-8 py-10 text-center">
              <h1 className="mb-1 text-2xl animate-breathe">waiting for players</h1>
              <p className="text-sm text-muted-foreground">
                share the room code{" "}
                <span className="text-foreground tracking-widest">{party.code}</span>{" "}
                to invite friends.
              </p>
            </section>

            {isHost && (
              <section className="rounded-2xl border border-border bg-card p-6 max-w-sm mx-auto">
                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">Max songs per player</span>
                      <InfoTip text="How many songs each player can submit" />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateConfig({ maxSongs: Math.max(1, config.maxSongs - 1) })}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border btn-hover-fade text-sm"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm tabular-nums">{config.maxSongs}</span>
                      <button
                        type="button"
                        onClick={() => updateConfig({ maxSongs: Math.min(20, config.maxSongs + 1) })}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border btn-hover-fade text-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <ToggleRow
                    label="Hide song"
                    hint="Players hear the song but can't see what it is until the reveal"
                    checked={config.hideSong}
                    onChange={(v) => updateConfig({ hideSong: v })}
                  />

                  <ToggleRow
                    label="Hide who submitted each song"
                    hint="Players won't know who submitted the song until the reveal"
                    checked={config.hideSubmitterIdentities}
                    onChange={(v) => updateConfig({ hideSubmitterIdentities: v })}
                  />

                  <ToggleRow
                    label="Hide leaderboard until the final reveal"
                    hint="Scores stay secret during play"
                    checked={config.hideLeaderboardUntilEnd}
                    onChange={(v) => updateConfig({ hideLeaderboardUntilEnd: v })}
                  />
                </div>
              </section>
            )}

            <div className="flex justify-center">
              {isHost ? (
                <button
                  type="button"
                  onClick={startSubmitting}
                  className="btn-interactive rounded-full border border-border bg-card px-8 py-3 text-sm hover:bg-card/70 transition-colors duration-300"
                >
                  start game
                </button>
              ) : (
                <p className="text-sm text-muted-foreground animate-breathe">
                  waiting for the host to start the game…
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

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-block">
      <span className="flex h-4 w-4 cursor-default items-center justify-center rounded-full border border-muted-foreground/40 text-[10px] leading-none text-muted-foreground select-none transition-colors hover:border-foreground/50 hover:text-foreground/70 hover:bg-input/50">
        ?
      </span>
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-xs -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{label}</span>
        {hint && <InfoTip text={hint} />}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-input transition-colors"
      >
        <span
          className={`absolute top-[3px] block h-5 w-5 rounded-full transition-all ${
            checked ? "left-[23px] bg-foreground" : "left-[3px] bg-muted-foreground"
          }`}
        />
      </button>
    </div>
  );
}
