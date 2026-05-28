# Nero Party

A real-time music listening party game. Players join a room, submit songs, listen together, and rate each song. A winning song — and a winning submitter — is crowned at the end.

## Video Walkthrough

https://youtu.be/18xGukn8pVw

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
5. Players **rate** each song (1–5 stars) while it plays
6. Once everyone has rated, the host moves to the next song
7. After all songs, the **final rankings** are revealed — winning song and winning submitter

## Scoring

Points are tracked on two axes:

**Player score** (determines the winner):
- The submitter earns the full sum of star ratings their track receives each round
- e.g. three votes of 4, 3, 5 → +12 points

**Song score** (determines the winning track):
- The total sum of star ratings the track received across all rounds

The submitter's own rating on their track is always discarded.

## Party Settings (host-configurable)

| Setting | Description |
|---|---|
| Max songs per player | How many songs each player can submit (1–20) |
| Hide song | Players hear the song but can't see the title or artist while rating |

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
