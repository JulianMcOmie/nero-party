import { useEffect, useRef, useState } from "react";
import { useParty } from "../party/NeroPartyContext";
import { Header } from "../components/Header";
import { StarRating } from "../components/StarRating";
import { PlayIcon, PauseIcon, CheckIcon } from "../components/icons";
import { WaveParticles } from "../components/WaveParticles";
import { AnimatedCharacterBackground } from "../components/AnimatedCharacterBackground";

export default function RankingScreen() {
  const {
    state, me, isHost, currentTrack,
    castVote, play, pause, nextSong, returnToLobby,
  } = useParty();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Animated ellipsis: 0→1→2→3, pause, repeat
  const DOT_SEQ = [0, 1, 2, 3, 3, 3, 3, 3, 3];
  const [dotIdx, setDotIdx] = useState(0);
  const dots = DOT_SEQ[dotIdx]!;
  useEffect(() => {
    const id = setInterval(() => setDotIdx((i) => (i + 1) % DOT_SEQ.length), 120);
    return () => clearInterval(id);
  }, []);

  // Game start countdown intro overlay
  const [introCountdown, setIntroCountdown] = useState<number>(3);
  const [introFading, setIntroFading] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  useEffect(() => {
    if (introCountdown > 0) {
      const id = setTimeout(() => setIntroCountdown((c) => c - 1), 1000);
      return () => clearTimeout(id);
    }
    setIntroFading(true);
    const id = setTimeout(() => setShowIntro(false), 500);
    return () => clearTimeout(id);
  }, [introCountdown]);

  // Rating state
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [revealedTrackId, setRevealedTrackId] = useState<string | null>(null);

  // Shared tooltip settings
  const TOOLTIP_DELAY_MS = 350;
  const TOOLTIP_FADE_DURATION = 'duration-[5000ms]';
  const BUTTON_SCALE = 'scale-105';

  // Play/pause button hover state
  const [buttonHovered, setButtonHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout>();

  const handleButtonMouseEnter = () => {
    setButtonHovered(true);
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, TOOLTIP_DELAY_MS);
  };

  const handleButtonMouseLeave = () => {
    setButtonHovered(false);
    setShowTooltip(false);
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
  };

  // Next-song button tooltip — delay so it doesn't fire immediately after click
  const [showNextSongTooltip, setShowNextSongTooltip] = useState(false);
  const nextSongTooltipRef = useRef<NodeJS.Timeout>();

  const handleNextSongMouseEnter = () => {
    nextSongTooltipRef.current = setTimeout(() => {
      setShowNextSongTooltip(true);
    }, TOOLTIP_DELAY_MS);
  };

  const handleNextSongMouseLeave = () => {
    setShowNextSongTooltip(false);
    if (nextSongTooltipRef.current) clearTimeout(nextSongTooltipRef.current);
  };

  const handleNextSongClick = () => {
    setShowNextSongTooltip(false);
    if (nextSongTooltipRef.current) clearTimeout(nextSongTooltipRef.current);
    nextSong();
  };

  // Reset audio when track changes
  useEffect(() => {
    const audio = (audioRef.current ??= new Audio());
    audio.pause();
    audio.src = "";
    return () => { audio.pause(); audio.src = ""; };
  }, [currentTrack?.id]);

  // Reset rating + reveal state on track change
  useEffect(() => {
    const vote = currentTrack ? state.myVotes[currentTrack.id] : undefined;
    const hasRating = (vote?.rating ?? 0) > 0;
    setSelectedRating(vote?.rating ?? 0);
    setRatingSubmitted(hasRating);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  // Play/pause in sync with host control
  useEffect(() => {
    const audio = (audioRef.current ??= new Audio());
    const previewUrl = currentTrack?.previewUrl;
    if (!previewUrl) return;
    if (state.playback.isPlaying) {
      audio.src = previewUrl;
      const elapsed = state.playback.startedAt
        ? (Date.now() - state.playback.startedAt) / 1000
        : 0;
      audio.currentTime = Math.min(Math.max(elapsed, 0), 29);
      void audio.play().catch((err) => console.error("[playback] play failed:", err));
    } else {
      audio.pause();
    }
  }, [state.playback.isPlaying, state.playback.startedAt, currentTrack?.previewUrl]);

  // Submit rating immediately when selected
  const handleSubmitRating = (rating: number) => {
    if (!currentTrack) return;
    setSelectedRating(rating);
    castVote(currentTrack.id, rating);
    setRatingSubmitted(true);
  };

  // Reset tooltip on click
  const handlePlayPauseClick = () => {
    setShowTooltip(false);
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    if (state.playback.isPlaying) {
      pause();
    } else {
      play();
    }
  };

  // ── Loading guard ──────────────────────────────────────────────────────────
  const party = state.party;
  if (!party || !currentTrack) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Header />
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Loading round…
        </div>
      </div>
    );
  }

  const config = party.config;
  const isMine = currentTrack.isOwn;

  const queueIdx = state.queue.findIndex((q) => q.id === currentTrack.id);
  const isLast = queueIdx >= 0 && queueIdx === state.queue.length - 1;
  const totalRounds = state.queue.length;

  const activityByUser = new Map(state.roundActivity.map((a) => [a.userId, a]));

  const songRevealed = currentTrack?.id != null && currentTrack.id === revealedTrackId;
  const showMetadata = !config.hideSong || songRevealed;

  console.log("[RankingScreen] currentTrack:", currentTrack?.title, "bpm:", currentTrack?.bpm);

  const onlineParticipants = state.participants.filter((p) => p.online);
  const allOnlineHaveRated = onlineParticipants.every((p) => {
    const a = activityByUser.get(p.id);
    return a?.hasRated;
  });

  return (
    <>
    <div className="flex min-h-screen flex-col bg-background text-foreground relative">
      <AnimatedCharacterBackground isPlaying={state.playback.isPlaying} />
      <Header />

      <main className="flex-1 flex flex-col relative">
        {/* Three-column layout */}
        <div className="flex-1 flex flex-col">
          <div className="mx-auto w-[75%] px-6 py-2 flex-1 flex gap-8">
            {/* Left sidebar: Room participants */}
            <aside className="flex-0 w-40 shrink-0 pt-8">
            <button
              type="button"
              onClick={returnToLobby}
              className={`mb-4 block text-sm transition-colors ${
                isHost
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-muted-foreground hover:text-foreground invisible"
              }`}
            >
              ← Return to lobby
            </button>
            <h3 className="mb-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold">room</h3>
            <div className="divide-y divide-border border-y border-border">
              {state.participants.filter((p) => p.online).map((p) => {
                const a = activityByUser.get(p.id);
                const hasRated = a?.hasRated;
                return (
                  <div key={p.id} className="text-xs py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="truncate font-medium text-foreground">{p.name}</span>
                      {hasRated && (
                        <CheckIcon className="h-3 w-3 text-foreground flex-shrink-0 !scale-100 !opacity-100" style={{ animation: 'none', transition: 'none' }} />
                      )}
                    </div>
                    {p.isHost && (
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">host</div>
                    )}
                  </div>
                );
              })}
            </div>
            </aside>

            {/* Center: Song and rating */}
            <div className="flex-1 flex flex-col items-center justify-start pt-8">
            {/* Song count */}
            <div className="mb-6 text-xs text-muted-foreground">Song {queueIdx + 1} of {totalRounds}</div>

            {/* Song cover with wave particles */}
            <div
              className="mb-6 relative h-64 w-64 flex items-center justify-center"
              style={{
                overflow: 'visible',
                boxShadow: state.playback.isPlaying
                  ? '0 0 25px rgba(255, 255, 255, 0.08), 0 0 40px rgba(255, 255, 255, 0.03)'
                  : 'none',
                transition: 'box-shadow 0.3s ease-in-out',
              }}
            >
              <WaveParticles isPlaying={state.playback.isPlaying} />
              <div className="h-full w-full flex items-center justify-center rounded-lg bg-input/50 relative overflow-hidden">
                {showMetadata && (
                  currentTrack.albumArtUrl ? (
                    <img
                      src={currentTrack.albumArtUrl}
                      alt=""
                      className="h-full w-full rounded-lg object-cover"
                      style={{ animation: 'fadeIn 1s ease-out forwards' }}
                    />
                  ) : (
                    <div className="text-6xl text-muted-foreground/50">♪</div>
                  )
                )}
                {/* "?" shown until song is revealed */}
                {config.hideSong && !songRevealed && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-6xl text-muted-foreground/50">?</span>
                  </div>
                )}
              </div>
            </div>

            {/* Title, artist, and play button */}
            {isHost ? (
              <div className="mb-4 flex justify-center">
                <div className="relative">
                  {/* Play/Pause button (host only) — absolutely positioned so it doesn't affect title centering */}
                  <div className="absolute right-full top-0 mr-3">
                    <button
                      type="button"
                      onClick={handlePlayPauseClick}
                      onMouseEnter={handleButtonMouseEnter}
                      onMouseLeave={handleButtonMouseLeave}
                      aria-label={state.playback.isPlaying ? "Pause" : "Play"}
                      className={`flex h-14 w-14 items-center justify-center rounded-full border border-border btn-hover-fade transition-all duration-300 ${
                        buttonHovered ? BUTTON_SCALE : 'scale-100'
                      }`}
                    >
                      {state.playback.isPlaying
                        ? <PauseIcon className="h-6 w-6" />
                        : <PlayIcon className="h-6 w-6" />}
                    </button>
                    {showTooltip && (
                      <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#3a3a3a] rounded px-2 py-1 whitespace-nowrap opacity-0 animate-pulse`} style={{ animation: 'fadeIn 100ms ease-in forwards', zIndex: 50 }}>
                        <span className="text-base font-medium text-white">{state.playback.isPlaying ? 'pause' : 'play'}</span>
                      </div>
                    )}
                  </div>

                  {/* Title and artist — fades in when song reveals */}
                  {showMetadata && (
                    <div
                      className="text-center"
                      style={{ animation: 'fadeIn 0.7s ease-out forwards' }}
                    >
                      <h2 className="text-lg font-semibold mb-1 whitespace-nowrap">{currentTrack.title ?? "—"}</h2>
                      <p className="text-sm text-muted-foreground whitespace-nowrap">{currentTrack.artist ?? "—"}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mb-4">
                {/* Title and artist — fades in when song reveals */}
                {showMetadata && (
                  <div
                    className="text-center"
                    style={{ animation: 'fadeIn 0.7s ease-out forwards' }}
                  >
                    <h2 className="text-lg font-semibold mb-1">{currentTrack.title ?? "—"}</h2>
                    <p className="text-sm text-muted-foreground">{currentTrack.artist ?? "—"}</p>
                  </div>
                )}
              </div>
            )}

            {/* Rating */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-4">
                <span className="text-2xl text-white whitespace-nowrap" style={{ opacity: 0.7, letterSpacing: '0.04em' }}>
                  Your Rating:
                </span>
                {ratingSubmitted ? (
                  <StarRating value={selectedRating} onChange={() => {}} disabled />
                ) : (
                  <StarRating
                    value={selectedRating}
                    onChange={(rating) => setSelectedRating(rating)}
                    onConfirm={() => {
                      if (currentTrack) {
                        castVote(currentTrack.id, selectedRating);
                        setRatingSubmitted(true);
                        if (config.hideSong) setRevealedTrackId(currentTrack.id);
                      }
                    }}
                  />
                )}
              </div>
            </div>

            {/* Waiting indicator for players */}
            {!isHost && (
              <div className="mt-12 w-full text-center text-sm text-muted-foreground relative">
                {allOnlineHaveRated
                  ? "Waiting for the host to continue"
                  : "Waiting for votes"}
                <span className="absolute" style={{ width: '3.5ch', textAlign: 'left' }}>
                  {'.'.repeat(dots)}
                </span>
              </div>
            )}

            {/* Host reveal button */}
            {isHost && (
              <div className="mt-12 flex justify-center">
                <div
                  className="relative"
                  onMouseEnter={!allOnlineHaveRated ? handleNextSongMouseEnter : undefined}
                  onMouseLeave={!allOnlineHaveRated ? handleNextSongMouseLeave : undefined}
                >
                  <button
                    type="button"
                    onClick={allOnlineHaveRated ? handleNextSongClick : undefined}
                    disabled={!allOnlineHaveRated}
                    className="btn-interactive rounded-full border border-border bg-card px-8 py-3 text-sm disabled:opacity-50 hover:bg-card/70 transition-colors duration-300"
                  >
                    {isLast ? "Reveal final results" : "Next song →"}
                  </button>
                  {showNextSongTooltip && (
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 z-10 mb-2 w-max rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-md">
                      Waiting for everyone to vote
                    </span>
                  )}
                </div>
              </div>
            )}
            </div>

            {/* Right sidebar: Queue */}
            <aside className="flex-0 w-40 shrink-0 pt-8">
            <button
              type="button"
              className="mb-4 block text-sm text-muted-foreground hover:text-foreground transition-colors invisible"
            >
              ← return to lobby
            </button>
            <h3 className="mb-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold">queue</h3>
            <div className="divide-y divide-border border-y border-border text-xs max-h-96 overflow-y-auto">
              {state.queue
                .filter((item) => !item.revealed && item.id !== currentTrack.id)
                .map((item) => (
                  <div key={item.id} className="py-2 px-2 text-muted-foreground">
                    {showMetadata || item.isOwn ? (
                      <div>
                        <div className="font-medium line-clamp-1">{item.title ?? "Untitled"}</div>
                        <div className="line-clamp-1">{item.artist ?? "Unknown"}</div>
                      </div>
                    ) : (
                      <div className="italic">Hidden song</div>
                    )}
                  </div>
                ))}
            </div>
            </aside>
          </div>
        </div>
      </main>
    </div>

    {showIntro && (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
        style={introFading ? { animation: 'fadeOut 0.5s ease-out forwards' } : undefined}
      >
        <p className="text-muted-foreground text-lg mb-4 tracking-wide">Game Starts in</p>
        <div className="h-36 flex items-center justify-center">
          {introCountdown > 0 && (
            <div
              key={introCountdown}
              className="text-9xl font-bold"
              style={{ animation: 'countdown-pop 1s ease-out forwards' }}
            >
              {introCountdown}
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
}

