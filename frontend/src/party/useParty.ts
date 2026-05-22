import { useContext } from "react";
import { NeroPartyContext, type NeroPartyContextValue } from "./NeroPartyContext";

/**
 * Access the unified Nero Party state and actions.
 *
 * Returns the single reducer-managed state object, a few derived selectors
 * (`me`, `currentTrack`, `isHost`), and every party action — including the
 * optimistic `castVote` / `submitGuess`. Must be used inside a
 * `<NeroPartyProvider>`.
 */
export function useParty(): NeroPartyContextValue {
  const context = useContext(NeroPartyContext);
  if (!context) {
    throw new Error("useParty must be used within a <NeroPartyProvider>.");
  }
  return context;
}
