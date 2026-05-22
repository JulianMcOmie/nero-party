import React, { useState } from "react";
import { useParty } from "./party/NeroPartyContext";

export default function App() {
  const { state, createParty, joinParty } = useParty();

  // Local form state for hosting a new room.
  const [hostName, setHostName] = useState("");
  const [maxSongs, setMaxSongs] = useState(5);

  // Local form state for a player joining an existing room.
  const [roomPin, setRoomPin] = useState("");
  const [playerName, setPlayerName] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Handle host creation. The avatar seed is derived from the host name.
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = hostName.trim();
    if (!name) return;
    setIsSubmitting(true);
    await createParty(name, name, maxSongs);
    setIsSubmitting(false);
  };

  // 2. Handle a player joining. The avatar seed is derived from the nickname.
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomPin.trim();
    const name = playerName.trim();
    if (code.length !== 3 || !name) return;
    setIsSubmitting(true);
    await joinParty(code, name, name);
    setIsSubmitting(false);
  };

  // --- TEMP ROUTING ---
  // Once a session exists the player is in a room. Render the placeholder
  // connected screen for now; expand this block as more screens are built.
  if (state.session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6">
        <div className="p-8 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-2 text-indigo-400">Connected to Party!</h1>
          <p className="text-slate-400 mb-2">
            Current Phase:{" "}
            <code className="bg-slate-950 px-2 py-1 rounded text-pink-400">
              {state.party?.gamePhase ?? "…"}
            </code>
          </p>
          <p className="text-sm text-slate-500">
            Room Code:{" "}
            <span className="font-bold tracking-widest text-slate-300">
              {state.party?.code ?? "—"}
            </span>
          </p>
          <div className="animate-pulse mt-4 text-xs text-indigo-300">
            Ready to build the Lobby View next...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-slate-100 p-6">
      {/* App Header */}
      <header className="mb-10 text-center">
        <h1 className="text-5xl font-black tracking-wider bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          NERO PARTY
        </h1>
        <p className="text-slate-400 mt-2 font-medium tracking-wide">
          The Blind Audio Multiplayer Game
        </p>
      </header>

      <main className="max-w-md w-full space-y-6">
        {/* Global Network Error Banner */}
        {state.error && (
          <div className="p-4 bg-red-900/50 border border-red-500 text-red-200 text-sm rounded-lg text-center font-medium">
            ⚠️ {state.error}
          </div>
        )}

        {/* CARD 1: THE HOST OPTION */}
        <div className="p-6 bg-slate-800 rounded-xl shadow-xl border border-slate-700/60 transition hover:border-indigo-500/40">
          <h2 className="text-xl font-bold text-slate-200 mb-1 text-center">Start a New Game</h2>
          <p className="text-sm text-slate-400 mb-4 text-center">
            Create a private room, configure the rules, and broadcast the stream.
          </p>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Host Name
              </label>
              <input
                type="text"
                maxLength={32}
                placeholder="Enter your name"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Max Songs Per Player
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={maxSongs}
                onChange={(e) => setMaxSongs(Number(e.target.value))}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !hostName.trim()}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 transform active:scale-[0.98]"
            >
              {isSubmitting ? "Generating Room..." : "Create Party Room"}
            </button>
          </form>
        </div>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink mx-4 text-xs text-slate-500 uppercase tracking-widest font-bold">OR</span>
          <div className="flex-grow border-t border-slate-700"></div>
        </div>

        {/* CARD 2: THE PLAYER OPTION */}
        <div className="p-6 bg-slate-800 rounded-xl shadow-xl border border-slate-700/60 transition hover:border-purple-500/40">
          <h2 className="text-xl font-bold text-slate-200 mb-1 text-center">Join Existing Party</h2>
          <p className="text-sm text-slate-400 mb-4 text-center">
            Enter the 3-digit code shown on the host's monitor.
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                3-Digit Room PIN
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={3}
                placeholder="123"
                value={roomPin}
                onChange={(e) => setRoomPin(e.target.value.replace(/\D/g, ""))}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-center tracking-widest text-lg font-bold text-purple-400 focus:outline-none focus:border-purple-500 transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Your Nickname
              </label>
              <input
                type="text"
                maxLength={16}
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-purple-500 transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || roomPin.length !== 3 || !playerName.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-700 disabled:to-slate-700 text-white font-semibold rounded-lg shadow-md transition-all duration-200 transform active:scale-[0.98] mt-2"
            >
              {isSubmitting ? "Joining..." : "Enter Room"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
