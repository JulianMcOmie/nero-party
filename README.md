# Nero Party

A real-time music listening party game. Players join a room, submit songs, listen together, rate each round, and optionally guess who submitted each track. A winning song — and a winning submitter — is crowned at the end.

## Video Walkthrough

https://youtu.be/kQ8NvcatMFo

## Setup

### Prerequisites

- Node.js 18+

No external API keys required — song search and 30-second previews are powered by the [Deezer API](https://developers.deezer.com/api), which is public and credential-free.

### 1. Install dependencies

```bash
npm install
```

This installs both the backend and frontend from the root.

### 2. Configure environment variables

```bash
cp .env.example .env
```

The default `.env` works out of the box. The only variable is the server port (defaults to `3000`).

### 3. Set up the database

```bash
cd backend && npx prisma migrate dev && cd ..
```

This creates a local SQLite database at `backend/prisma/dev.db`.

### 4. Start the dev servers

```bash
npm run dev
```

This starts both servers concurrently:
- **Backend** → `http://localhost:3000`
- **Frontend** → `http://localhost:5173`

Open `http://localhost:5173` in your browser.

---

## How to Play

1. **Host** creates a room and shares the 3-digit code
2. **Players** join with the code and a display name
3. Everyone submits songs (host sets a per-player limit)
4. **Host** starts the rounds — songs play one at a time via Deezer 30s previews
5. Players **rate** each song (1–5 stars) and optionally **guess** who submitted it
6. Host **reveals** each round — scores are calculated and the submitter is unmasked
7. After all songs, the **final leaderboard** is revealed with the winning song and player

## Scoring

Points are accumulated across rounds and tracked on two axes:

**Player score** (determines the winner):

| Event | Points |
|---|---|
| Someone rates your song | +sum of all star ratings received (e.g. three votes of 4, 3, 5 = +12) |
| You correctly guess the submitter | +1 |
| Sonic Signature (see below) | +1 bonus to the submitter |

**Song score** (determines the winning track):
- Accumulates the raw star ratings received across all rounds
- Gets a +1 bonus if the Sonic Signature fires

**Sonic Signature:** if ≥50% of eligible players (everyone except the submitter) correctly guess who submitted a song, that track earns its Sonic Signature — a signal that the song is distinctly "them." The submitter and the song both get a +1 bonus.

The submitter's own ratings and guesses on their track are always discarded.

## Party Settings (host-configurable)

| Setting | Description |
|---|---|
| Max songs per player | How many songs each player can submit |
| Hide song | Players hear but can't see the title/artist until the reveal |
| Hide submitter identities | Players don't know who submitted each song |
| Enable guessing game | Players guess the submitter each round — requires both hide settings (auto-enables them) |
| Hide leaderboard until final reveal | Scores stay secret during play |

## Project Structure

```
nero-party/
├── .env.example          # Environment variable template
├── backend/
│   ├── prisma/           # SQLite schema & migrations
│   └── src/
│       ├── realtime/     # Socket.IO event handlers
│       ├── services/     # Game logic (partyService, scoring, Deezer)
│       └── types/        # Shared event types
└── frontend/
    └── src/
        ├── components/   # Shared UI components
        ├── party/        # Socket context & state reducer
        ├── screens/      # One screen per game phase
        └── lib/          # Deezer search client
```

## Tech Stack

- **Backend:** Express.js, Socket.IO, Prisma, TypeScript
- **Frontend:** React, Vite, TailwindCSS, TypeScript
- **Database:** SQLite (local, no external service needed)
- **Music API:** Deezer (no credentials required)
