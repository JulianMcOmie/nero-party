import React, { useState } from "react";
import { useParty } from "../party/NeroPartyContext";
import { FlameIcon } from "../components/icons";

type Mode = null | "host" | "join";

export default function HomeScreen() {
  const { state, createParty, joinParty } = useParty();

  const [mode, setMode] = useState<Mode>(null);
  const [hostName, setHostName] = useState("");
  const [roomPin, setRoomPin] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = hostName.trim();
    if (!name) return;
    setSubmitting(true);
    await createParty(name, name, 3);
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomPin.trim();
    const name = playerName.trim();
    if (code.length !== 3 || !name) return;
    setSubmitting(true);
    await joinParty(code, name, name);
    setSubmitting(false);
  };

  function selectMode(next: Mode) {
    setMode((prev) => (prev === next ? null : next));
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-6 pb-12 text-foreground pt-[18vh]">
      <div className="mb-10 flex flex-col items-center gap-2">
        <FlameIcon className="h-10 w-10" />
        <span className="text-3xl">nero party</span>
        <span className="text-sm text-muted-foreground">a listening party</span>
      </div>

      {state.notification && (
        <div className="mb-6 w-full max-w-sm rounded-md border border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground">
          {state.notification}
        </div>
      )}

      {state.error && (
        <div className="mb-6 w-full max-w-sm rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="w-full max-w-sm">
        {/* Mode selector — stays in place; form expands below */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => selectMode("host")}
            className={`btn-interactive flex-1 rounded-full border px-6 py-3 text-sm ${
              mode === "host"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground"
            }`}
          >
            Host a party
          </button>
          <button
            type="button"
            onClick={() => selectMode("join")}
            className={`btn-interactive flex-1 rounded-full border px-6 py-3 text-sm ${
              mode === "join"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-foreground"
            }`}
          >
            Join a party
          </button>
        </div>

        {/* Fixed-height area so the buttons above never shift */}
        <div className="mt-5 min-h-[200px]">
          {mode === "host" && (
            <form onSubmit={handleCreate} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">your name</span>
                <input
                  type="text"
                  maxLength={32}
                  value={hostName}
                  onChange={(e) => setHostName(e.target.value)}
                  autoFocus
                  className="w-full rounded-md bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={submitting || !hostName.trim()}
                className="btn-interactive w-full rounded-full border border-border bg-card px-6 py-2.5 text-sm disabled:opacity-50"
              >
                {submitting ? "creating…" : "create party"}
              </button>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={handleJoin} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">room code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={3}
                  placeholder="000"
                  value={roomPin}
                  onChange={(e) => setRoomPin(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  className="w-full rounded-md bg-input py-2 px-3 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted-foreground">your name</span>
                <input
                  type="text"
                  maxLength={16}
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full rounded-md bg-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </label>
              <button
                type="submit"
                disabled={submitting || roomPin.length !== 3 || !playerName.trim()}
                className="btn-interactive w-full rounded-full border border-border bg-card px-6 py-2.5 text-sm disabled:opacity-50"
              >
                {submitting ? "joining…" : "join party"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
