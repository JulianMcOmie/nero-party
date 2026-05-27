import { useState } from "react";
import { useParty } from "../party/NeroPartyContext";
import { FlameIcon } from "./icons";

export function Header() {
  const { state, me, isHost, leaveParty, terminateRoom } = useParty();
  const [confirming, setConfirming] = useState(false);
  const code = state.party?.code ?? "—";
  const name = me?.name ?? "—";

  const copyCode = () => {
    if (state.party?.code) {
      navigator.clipboard.writeText(state.party.code).catch(() => {});
    }
  };

  const hostLabel = "Close Room";

  function handleHostAction() {
    setConfirming(true);
  }

  function handleConfirm() {
    setConfirming(false);
    if (isHost) {
      terminateRoom();
    } else {
      leaveParty();
    }
  }

  function handleCancel() {
    setConfirming(false);
  }

  return (
    <div className="px-6 pt-6">
      <header className="mx-auto w-[80%] flex items-center justify-between rounded-full border border-border bg-header px-6 py-3 relative">
        <div className="flex items-center gap-2 text-foreground">
          <FlameIcon className="h-8 w-8" />
          <span className="text-2xl">nero party</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-sm">
          <button
            type="button"
            onClick={copyCode}
            aria-label={`Copy room code ${code}`}
            className="text-foreground"
          >
            Room {code}
          </button>
          <span className="mx-2 text-muted-foreground">·</span>
          <span className="text-foreground">{name}</span>
        </div>

        {confirming ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sure?</span>
            <button
              type="button"
              onClick={handleConfirm}
              className="font-medium text-muted-foreground transition-all hover:scale-110 hover:text-foreground"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-muted-foreground transition-all hover:scale-110 hover:text-foreground"
            >
              No
            </button>
          </div>
        ) : isHost ? (
          <button
            type="button"
            onClick={handleHostAction}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            {hostLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Leave Room
          </button>
        )}
      </header>
    </div>
  );
}
