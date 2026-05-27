import { useParty } from "./party/NeroPartyContext";
import HomeScreen from "./screens/HomeScreen";
import LobbyScreen from "./screens/LobbyScreen";
import SubmittingScreen from "./screens/SubmittingScreen";
import RankingScreen from "./screens/RankingScreen";
import RevealScreen from "./screens/RevealScreen";
import { FloatingNotes } from "./components/FloatingNotes";

/**
 * Phase router. The reducer state is the source of truth:
 *  - no session                 → HomeScreen (create / join)
 *  - session.party.gamePhase    → matching phase screen
 */
export default function App() {
  const { state } = useParty();

  if (!state.session) return <><FloatingNotes /><HomeScreen /></>;

  // Brief flash during reconnect / session:register before party state lands.
  if (!state.party) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        connecting…
      </div>
    );
  }

  return (
    <>
      <FloatingNotes />
      {(() => {
        switch (state.party.gamePhase) {
          case "HOSTING":    return <LobbyScreen />;
          case "SUBMITTING": return <SubmittingScreen />;
          case "RANKING":    return <RankingScreen />;
          case "REVEAL":     return <RevealScreen />;
          default:           return null;
        }
      })()}
    </>
  );
}
