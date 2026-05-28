import { useEffect, useRef, useState } from "react";
import { useParty } from "../party/NeroPartyContext";
import { Header } from "../components/Header";
import { StarRating } from "../components/StarRating";
import { PlayIcon, PauseIcon, CheckIcon } from "../components/icons";
import { BouncingCircle } from "../components/BouncingCircle";

export default function RankingScreen() {
  const {
    state, me, isHost, currentTrack,
    castVote, play, pause, nextSong, returnToLobby,
  } = useParty();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Rating state
  const [selectedRating, setSelectedRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // Shared tooltip settings
  const TOOLTIP_DELAY_MS = 350;
  const TOOLTIP_FADE_DURATION = 'duration-[5000ms]';
  const BUTTON_SCALE = 'scale-105';

  // Unified button hover state
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

  // Reset audio when track changes
  useEffect(() => {
    const audio = (audioRef.current ??= new Audio());
    audio.pause();
    audio.src = "";
    return () => { audio.pause(); audio.src = ""; };
  }, [currentTrack?.id]);

  // Reset rating state on track change
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
          loading round…
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

  const showMetadata = !config.hideSong;

  console.log("[RankingScreen] currentTrack:", currentTrack?.title, "bpm:", currentTrack?.bpm);

  const onlineParticipants = state.participants.filter((p) => p.online);
  const allOnlineHaveRated = onlineParticipants.every((p) => {
    const a = activityByUser.get(p.id);
    return a?.hasRated;
  });

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 flex flex-col">
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
              ← return to lobby
            </button>
            <h3 className="mb-4 text-xs text-muted-foreground uppercase tracking-widest font-semibold">room</h3>
            <div className="space-y-2">
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
                  </div>
                );
              })}
            </div>
            </aside>

            {/* Center: Song and rating */}
            <div className="flex-1 flex flex-col items-center justify-start pt-8">
            {/* Song count */}
            <div className="mb-6 text-xs text-muted-foreground">song {queueIdx + 1} of {totalRounds}</div>

            {/* Song cover */}
            <div className="mb-3 relative h-64 w-64">
              <div className="h-full w-full flex items-center justify-center rounded-lg bg-input/50">
                {showMetadata && currentTrack.albumArtUrl ? (
                  <img src={currentTrack.albumArtUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                ) : (
                  <div className="text-6xl text-muted-foreground/50">
                    {showMetadata ? "♪" : "?"}
                  </div>
                )}
              </div>
            </div>

            {/* Title, artist, and play button */}
            {isHost ? (
              <div className="mb-4 flex items-start gap-4">
                {/* Play/Pause button (host only) */}
                <div className="relative mt-0 flex-shrink-0">
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

                {/* Title and artist (if visible) - centered */}
                {showMetadata && (
                  <div className="text-center flex-1">
                    <h2 className="text-lg font-semibold mb-1">{currentTrack.title ?? "—"}</h2>
                    <p className="text-sm text-muted-foreground">{currentTrack.artist ?? "—"}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mb-4">
                {/* Title and artist (if visible) - centered for non-hosts */}
                {showMetadata && (
                  <div className="text-center">
                    <h2 className="text-lg font-semibold mb-1">{currentTrack.title ?? "—"}</h2>
                    <p className="text-sm text-muted-foreground">{currentTrack.artist ?? "—"}</p>
                  </div>
                )}
              </div>
            )}

            {/* Rating */}
            <div className="relative flex flex-col items-center gap-4">
              <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 text-2xl text-white whitespace-nowrap" style={{ opacity: 0.7, letterSpacing: '0.04em' }}>
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
                    }
                  }}
                />
              )}
            </div>

            {/* Waiting indicator for players */}
            {!isHost && (
              <div className="mt-12 text-center">
                <div className="text-sm text-muted-foreground mb-2">
                  {allOnlineHaveRated
                    ? "waiting for the host to continue…"
                    : "waiting for votes..."}
                </div>
                <BouncingCircle width={200} height={15} />
              </div>
            )}

            {/* Host reveal button */}
            {isHost && (
              <div className="mt-12">
                <button
                  type="button"
                  onClick={async () => {
                    console.log("Next song button clicked");
                    console.log("currentTrack:", currentTrack);
                    console.log("isLast:", isLast);
                    console.log("queueIdx:", queueIdx);
                    try {
                      const result = nextSong();
                      console.log("nextSong returned:", result);
                      if (result instanceof Promise) {
                        result.catch(err => console.error("Promise rejected:", err));
                      }
                    } catch (error) {
                      console.error("Error calling nextSong:", error);
                    }
                  }}
                  className="px-6 py-2 btn-hover-fade border border-border rounded text-sm font-medium"
                >
                  {isLast ? "reveal final results" : "next song →"}
                </button>
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
            <div className="space-y-2 text-xs max-h-96 overflow-y-auto">
              {state.queue.map((item) => {
                const isCurrent = item.id === currentTrack.id;
                return (
                  <div
                    key={item.id}
                    className={`py-2 px-2 rounded transition-colors ${
                      isCurrent
                        ? "bg-input/50 text-foreground font-medium"
                        : "text-muted-foreground"
                    }`}
                  >
                    {showMetadata || item.isOwn ? (
                      <div>
                        <div className="font-medium line-clamp-1">{item.title ?? "Untitled"}</div>
                        <div className="text-muted-foreground line-clamp-1">{item.artist ?? "Unknown"}</div>
                      </div>
                    ) : (
                      <div className="text-muted-foreground italic">hidden song</div>
                    )}
                  </div>
                );
              })}
            </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

