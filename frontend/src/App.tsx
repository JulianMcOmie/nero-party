import { useParty } from "./party/NeroPartyContext";
import HomeScreen from "./screens/HomeScreen";
import LobbyScreen from "./screens/LobbyScreen";
import SubmittingScreen from "./screens/SubmittingScreen";
import RankingScreen from "./screens/RankingScreen";
import RevealScreen from "./screens/RevealScreen";
import { FloatingNotes } from "./components/FloatingNotes";
import { AnimatedCharacterBackground } from "./components/AnimatedCharacterBackground";

/**
 * Phase router. The reducer state is the source of truth:
 *  - no session                 → HomeScreen (create / join)
 *  - session.party.gamePhase    → matching phase screen
 */
export default function App() {
  const { state } = useParty();
  const isPlaying = state.playback?.isPlaying ?? false;

  const curtain = (key: string) => (
    <div
      key={key}
      className="fixed inset-0 bg-background pointer-events-none"
      style={{ animation: 'fadeOut 0.5s ease-out forwards', zIndex: 100 }}
    />
  );

  const screen = () => {
    if (!state.session) return <>{<HomeScreen />}{curtain('home')}</>;

    if (!state.party) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
          connecting…
        </div>
      );
    }

    const phase = state.party.gamePhase;
    return (
      <>
        {(() => {
          switch (phase) {
            case "HOSTING":    return <LobbyScreen />;
            case "SUBMITTING": return <SubmittingScreen />;
            case "RANKING":    return <RankingScreen />;
            case "REVEAL":     return <RevealScreen />;
            default:           return null;
          }
        })()}
        {curtain(phase)}
      </>
    );
  };

  return (
    <>
      <FloatingNotes isPlaying={isPlaying} />
      <AnimatedCharacterBackground isPlaying={isPlaying} />
      {screen()}
    </>
  );
}
